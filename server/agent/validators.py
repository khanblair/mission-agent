"""Physics and syntax guardrails — run before and after every GMAT execution."""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ValidationResult:
    ok: bool
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def add_warning(self, msg: str) -> None:
        self.warnings.append(msg)

    def add_error(self, msg: str) -> None:
        self.errors.append(msg)
        self.ok = False

    def to_dict(self) -> dict[str, Any]:
        return {"ok": self.ok, "warnings": self.warnings, "errors": self.errors}


# ── Pre-run: validate the script before execution ─────────────────────────────

def validate_script(script: str) -> ValidationResult:
    result = ValidationResult(ok=True)

    _check_structure(script, result)
    _check_orbital_params(script, result)
    _check_reports(script, result)

    return result


def _check_structure(script: str, r: ValidationResult) -> None:
    if "BeginMissionSequence" not in script:
        r.add_error("Script is missing 'BeginMissionSequence'")
    if not re.search(r"Create\s+Spacecraft", script):
        r.add_error("Script has no spacecraft defined")
    if not re.search(r"Create\s+Propagator", script):
        r.add_error("Script has no propagator defined")


def _check_orbital_params(script: str, r: ValidationResult) -> None:
    sma = _getf(script, "SMA")
    ecc = _getf(script, "ECC")
    inc = _getf(script, "INC")

    if sma is not None:
        alt = sma - 6371
        if sma < 6471:  # < 100 km altitude
            r.add_error(f"SMA {sma:.1f} km implies altitude {alt:.1f} km — below atmosphere (< 100 km)")
        elif alt < 200:
            r.add_warning(f"Altitude {alt:.1f} km is very low — orbital lifetime will be very short")
        elif alt > 100000:
            r.add_warning(f"SMA {sma:.1f} km — very high orbit, verify this is intentional")

    if ecc is not None:
        if ecc < 0 or ecc >= 1:
            r.add_error(f"Eccentricity {ecc} is outside valid range [0, 1)")
        if ecc > 0.9:
            r.add_warning(f"Eccentricity {ecc} is very high — highly elliptical orbit")

    if inc is not None:
        if inc < 0 or inc > 180:
            r.add_error(f"Inclination {inc}° outside [0°, 180°]")


def _check_reports(script: str, r: ValidationResult) -> None:
    if "ephemeris.txt" not in script and "EphRpt" not in script:
        r.add_warning("No ephemeris report defined — 3D visualization will not be available")


def _getf(script: str, key: str) -> float | None:
    m = re.search(rf"\.{key}\s*=\s*([\d.eE+\-]+)", script)
    return float(m.group(1)) if m else None


# ── Post-run: validate results after execution ────────────────────────────────

def validate_results(orbit_summary: dict[str, Any], groundtrack: list[dict]) -> ValidationResult:
    result = ValidationResult(ok=True)

    if not orbit_summary:
        result.add_warning("No orbit summary available — check engine output")
        return result

    alt_mean = orbit_summary.get("alt_mean_km", 0)
    alt_min = orbit_summary.get("alt_min_km", 0)

    if alt_min < 80:
        result.add_error(f"Minimum altitude {alt_min:.1f} km is below reentry threshold — orbit decayed")
    elif alt_min < 150:
        result.add_warning(f"Minimum altitude {alt_min:.1f} km is very low — orbit may be unstable")

    if not groundtrack:
        result.add_warning("No ground track data — ephemeris may be empty")

    return result


# ── SSO inclination calculator ────────────────────────────────────────────────

def sso_inclination(altitude_km: float) -> float:
    """Compute sun-synchronous inclination for a given circular orbit altitude."""
    MU = 398600.4418
    J2 = 1.08263e-3
    RE = 6371.0
    a = RE + altitude_km
    n = math.sqrt(MU / a**3)  # rad/s
    precession_rate = math.radians(360.0 / 365.25 / 86400)  # rad/s (nodal drift rate)
    cos_inc = precession_rate * (2 * a**2) / (-3 * n * J2 * RE**2)
    if abs(cos_inc) > 1:
        raise ValueError(f"No SSO solution at altitude {altitude_km} km (cos_inc={cos_inc:.3f})")
    return math.degrees(math.acos(cos_inc))


# ── Hohmann delta-v calculator ────────────────────────────────────────────────

def hohmann_dv(r1_km: float, r2_km: float) -> dict[str, float]:
    """Compute delta-v for a Hohmann transfer between two circular orbits (km)."""
    MU = 398600.4418
    r1 = r1_km + 6371
    r2 = r2_km + 6371
    v1 = math.sqrt(MU / r1)
    v2 = math.sqrt(MU / r2)
    a_transfer = (r1 + r2) / 2
    v_trans1 = math.sqrt(MU * (2 / r1 - 1 / a_transfer))
    v_trans2 = math.sqrt(MU * (2 / r2 - 1 / a_transfer))
    dv1 = abs(v_trans1 - v1)
    dv2 = abs(v2 - v_trans2)
    tof = math.pi * math.sqrt(a_transfer**3 / MU) / 3600  # hours
    return {
        "dv1_km_s": round(dv1, 4),
        "dv2_km_s": round(dv2, 4),
        "total_dv_km_s": round(dv1 + dv2, 4),
        "transfer_time_hours": round(tof, 3),
    }
