"""Run a GMAT script (real or mock) and return output paths."""
from __future__ import annotations

import asyncio
import logging
import math
import shutil
import subprocess
import uuid
from pathlib import Path

import numpy as np

from ..config import settings
from .gmat_engine import is_mock, load_engine, _find_gmat_bin

logger = logging.getLogger(__name__)


class RunResult:
    def __init__(self, run_id: str, output_dir: Path, mock: bool = False):
        self.run_id = run_id
        self.output_dir = output_dir
        self.mock = mock
        self.ephemeris_path = output_dir / "ephemeris.txt"
        self.orbit_elements_path = output_dir / "orbit_elements.txt"
        self.contact_report_path = output_dir / "contact_report.txt"
        self.script_path = output_dir / "mission.script"


async def run_script(script: str) -> RunResult:
    """Execute a GMAT script and return paths to outputs."""
    load_engine()

    run_id = str(uuid.uuid4())
    output_dir = settings.workspaces_dir / run_id
    output_dir.mkdir(parents=True, exist_ok=True)

    if is_mock():
        return await _run_mock(script, run_id, output_dir)
    else:
        return await _run_gmat(script, run_id, output_dir)


async def _run_gmat(script: str, run_id: str, output_dir: Path) -> RunResult:
    """Run via GMAT subprocess."""
    result = RunResult(run_id, output_dir)

    patched = _patch_report_paths(script, output_dir)
    result.script_path.write_text(patched)

    gmat_bin = _find_gmat_bin()
    binary = gmat_bin / settings.gmat_binary if gmat_bin else Path(settings.gmat_binary)
    console_binary = gmat_bin / "GmatConsole" if gmat_bin else Path("GmatConsole")

    exe = console_binary if console_binary.exists() else binary

    cmd = [str(exe), "--minimize", "--run", "--exit", str(result.script_path)]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(output_dir),
        )
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(), timeout=settings.gmat_timeout
        )
        if proc.returncode != 0:
            raise RuntimeError(f"GMAT exited {proc.returncode}: {stderr.decode()[:500]}")
    except asyncio.TimeoutError:
        raise RuntimeError(f"GMAT run timed out after {settings.gmat_timeout}s")

    return result


def _patch_report_paths(script: str, output_dir: Path) -> str:
    """Rewrite relative Filename paths in a GMAT script to absolute paths."""
    import re

    def replacer(m: re.Match) -> str:
        filename = m.group(1)
        abs_path = output_dir / filename
        return f"Filename = '{abs_path}'"

    return re.sub(r"Filename\s*=\s*'([^']+)'", replacer, script)


async def _run_mock(script: str, run_id: str, output_dir: Path) -> RunResult:
    """Generate realistic Keplerian propagation data without GMAT."""
    result = RunResult(run_id, output_dir, mock=True)
    result.script_path.write_text(script)

    params = _extract_params_from_script(script)
    _write_mock_ephemeris(result.ephemeris_path, params)
    _write_mock_orbit_elements(result.orbit_elements_path, params)

    return result


def _extract_params_from_script(script: str) -> dict:
    """Naively extract key orbital parameters from a GMAT script string."""
    import re

    def grab(key: str, default: float) -> float:
        m = re.search(rf"\.{key}\s*=\s*([\d.eE+\-]+)", script)
        return float(m.group(1)) if m else default

    return {
        "sma": grab("SMA", 6928.0),
        "ecc": grab("ECC", 0.001),
        "inc": math.radians(grab("INC", 28.5)),
        "raan": math.radians(grab("RAAN", 0.0)),
        "aop": math.radians(grab("AOP", 0.0)),
        "ta": math.radians(grab("TA", 0.0)),
        "duration_days": grab("ElapsedDays", 1.0),
    }


def _write_mock_ephemeris(path: Path, p: dict) -> None:
    MU = 398600.4418  # km³/s²
    a, e, inc, raan, aop = p["sma"], p["ecc"], p["inc"], p["raan"], p["aop"]
    ta0 = p["ta"]
    n = math.sqrt(MU / a**3)  # mean motion rad/s
    T = 2 * math.pi / n  # period seconds
    duration_s = p["duration_days"] * 86400.0
    steps = min(int(duration_s / 60), 1440 * 3)  # 1-min steps, max 3 days

    lines = ["UTCGregorian                   X                      Y                      Z                      VX                     VY                     VZ\n"]
    from datetime import datetime, timedelta

    epoch = datetime(2024, 1, 1)
    for i in range(steps):
        t = i * 60.0
        M = n * t + _ta_to_ma(ta0, e)
        ta = _solve_kepler(M, e)
        r = a * (1 - e**2) / (1 + e * math.cos(ta))
        xp = r * math.cos(ta)
        yp = r * math.sin(ta)
        vp = math.sqrt(MU / (a * (1 - e**2)))
        vxp = -vp * math.sin(ta)
        vyp = vp * (e + math.cos(ta))
        x, y, z = _pqw_to_eci(xp, yp, 0, inc, raan, aop)
        vx, vy, vz = _pqw_to_eci(vxp, vyp, 0, inc, raan, aop)
        ts = (epoch + timedelta(seconds=t)).strftime("%d %b %Y %H:%M:%S.000")
        lines.append(f"{ts}   {x:22.10f}   {y:22.10f}   {z:22.10f}   {vx:22.10f}   {vy:22.10f}   {vz:22.10f}\n")

    path.write_text("".join(lines))


def _write_mock_orbit_elements(path: Path, p: dict) -> None:
    MU = 398600.4418
    a, e = p["sma"], p["ecc"]
    alt = a - 6371.0
    inc_deg = math.degrees(p["inc"])
    lines = [
        "UTCGregorian                   Altitude               ECC                    INC                    RAAN                   AOP                    TA\n",
        f"01 Jan 2024 00:00:00.000       {alt:.4f}               {e:.6f}               {inc_deg:.4f}               {math.degrees(p['raan']):.4f}               {math.degrees(p['aop']):.4f}               {math.degrees(p['ta']):.4f}\n",
    ]
    path.write_text("".join(lines))


def _ta_to_ma(ta: float, e: float) -> float:
    E = 2 * math.atan(math.sqrt((1 - e) / (1 + e)) * math.tan(ta / 2))
    return E - e * math.sin(E)


def _solve_kepler(M: float, e: float, tol: float = 1e-10) -> float:
    E = M
    for _ in range(50):
        dE = (M - E + e * math.sin(E)) / (1 - e * math.cos(E))
        E += dE
        if abs(dE) < tol:
            break
    return 2 * math.atan2(math.sqrt(1 + e) * math.sin(E / 2), math.sqrt(1 - e) * math.cos(E / 2))


def _pqw_to_eci(xp: float, yp: float, zp: float, inc: float, raan: float, aop: float) -> tuple:
    ci, si = math.cos(inc), math.sin(inc)
    cr, sr = math.cos(raan), math.sin(raan)
    cw, sw = math.cos(aop), math.sin(aop)
    R = [
        [cr * cw - sr * sw * ci, -cr * sw - sr * cw * ci, sr * si],
        [sr * cw + cr * sw * ci, -sr * sw + cr * cw * ci, -cr * si],
        [sw * si, cw * si, ci],
    ]
    x = R[0][0] * xp + R[0][1] * yp + R[0][2] * zp
    y = R[1][0] * xp + R[1][1] * yp + R[1][2] * zp
    z = R[2][0] * xp + R[2][1] * yp + R[2][2] * zp
    return x, y, z
