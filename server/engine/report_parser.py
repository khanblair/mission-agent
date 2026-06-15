"""Parse GMAT report files into structured Python dicts."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any


def parse_ephemeris(path: Path) -> list[dict[str, float]]:
    """Parse ephemeris report → list of {t, x, y, z, vx, vy, vz}."""
    if not path.exists():
        return []

    rows: list[dict[str, float]] = []
    lines = path.read_text().splitlines()

    for line in lines[1:]:  # skip header
        parts = line.split()
        if len(parts) < 8:
            continue
        try:
            # Date is first 4 tokens: "DD Mon YYYY HH:MM:SS.mmm"
            t_str = " ".join(parts[:4])
            x, y, z, vx, vy, vz = [float(v) for v in parts[4:10]]
            rows.append({"t": t_str, "x": x, "y": y, "z": z, "vx": vx, "vy": vy, "vz": vz})
        except (ValueError, IndexError):
            continue
    return rows


def parse_orbit_elements(path: Path) -> list[dict[str, Any]]:
    """Parse orbital elements report → list of {t, alt, ecc, inc, raan, aop, ta}."""
    if not path.exists():
        return []

    rows = []
    lines = path.read_text().splitlines()
    for line in lines[1:]:
        parts = line.split()
        if len(parts) < 10:
            continue
        try:
            t_str = " ".join(parts[:4])
            alt, ecc, inc, raan, aop, ta = [float(v) for v in parts[4:10]]
            rows.append({"t": t_str, "alt": alt, "ecc": ecc, "inc": inc, "raan": raan, "aop": aop, "ta": ta})
        except (ValueError, IndexError):
            continue
    return rows


def parse_contact_report(path: Path) -> list[dict[str, Any]]:
    """Parse ground station contact report → list of {station, start, stop, duration_min, max_elevation}."""
    if not path.exists():
        return []

    contacts = []
    lines = path.read_text().splitlines()
    for line in lines:
        m = re.match(
            r"(\w+)\s+([\d\s:\.A-Za-z]+?)\s+([\d\s:\.A-Za-z]+?)\s+([\d.]+)\s+([\d.]+)", line
        )
        if m:
            contacts.append({
                "station": m.group(1),
                "start": m.group(2).strip(),
                "stop": m.group(3).strip(),
                "duration_min": float(m.group(4)),
                "max_elevation_deg": float(m.group(5)),
            })
    return contacts


def summarize_orbit(elements: list[dict]) -> dict[str, Any]:
    """Compute summary statistics from a list of orbital element snapshots."""
    if not elements:
        return {}
    alts = [r["alt"] for r in elements]
    eccs = [r["ecc"] for r in elements]
    incs = [r["inc"] for r in elements]
    return {
        "alt_mean_km": round(sum(alts) / len(alts), 2),
        "alt_min_km": round(min(alts), 2),
        "alt_max_km": round(max(alts), 2),
        "ecc_mean": round(sum(eccs) / len(eccs), 6),
        "inc_deg": round(sum(incs) / len(incs), 4),
        "period_min": round(2 * 3.14159 * ((6371 + sum(alts) / len(alts)) ** 1.5) / (398600.4418 ** 0.5) / 60, 2),
    }
