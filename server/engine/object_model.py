"""Read and write mission resource fields from/to a GMAT script string."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Spacecraft:
    name: str = "SC"
    epoch: str = "01 Jan 2024 00:00:00.000"
    sma: float = 6928.0
    ecc: float = 0.001
    inc: float = 28.5
    raan: float = 0.0
    aop: float = 0.0
    ta: float = 0.0
    dry_mass: float = 100.0
    cd: float = 2.2
    cr: float = 1.8
    drag_area: float = 1.0
    srp_area: float = 1.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "epoch": self.epoch,
            "sma_km": self.sma,
            "altitude_km": round(self.sma - 6371.0, 2),
            "ecc": self.ecc,
            "inc_deg": self.inc,
            "raan_deg": self.raan,
            "aop_deg": self.aop,
            "ta_deg": self.ta,
            "dry_mass_kg": self.dry_mass,
        }


@dataclass
class GroundStation:
    name: str = "GS"
    latitude: float = 0.0
    longitude: float = 0.0
    altitude: float = 0.0
    min_elevation: float = 5.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "latitude_deg": self.latitude,
            "longitude_deg": self.longitude,
            "altitude_km": self.altitude,
            "min_elevation_deg": self.min_elevation,
        }


@dataclass
class MissionResources:
    spacecraft: list[Spacecraft] = field(default_factory=list)
    ground_stations: list[GroundStation] = field(default_factory=list)
    duration_days: float = 1.0
    propagator: str = "RungeKutta89"

    def to_dict(self) -> dict[str, Any]:
        return {
            "spacecraft": [s.to_dict() for s in self.spacecraft],
            "ground_stations": [gs.to_dict() for gs in self.ground_stations],
            "duration_days": self.duration_days,
            "propagator": self.propagator,
        }


def _get(script: str, key: str, default: str = "") -> str:
    m = re.search(rf"\.{key}\s*=\s*'?([^';\n]+)'?", script)
    return m.group(1).strip() if m else default


def _getf(script: str, key: str, default: float = 0.0) -> float:
    m = re.search(rf"\.{key}\s*=\s*([\d.eE+\-]+)", script)
    return float(m.group(1)) if m else default


def parse_script(script: str) -> MissionResources:
    """Extract mission resources from a GMAT script."""
    resources = MissionResources()

    sc_names = re.findall(r"Create\s+Spacecraft\s+(\w+)", script)
    for name in sc_names:
        sc = Spacecraft(
            name=name,
            epoch=_get(script, "Epoch", "01 Jan 2024 00:00:00.000"),
            sma=_getf(script, "SMA", 6928.0),
            ecc=_getf(script, "ECC", 0.001),
            inc=_getf(script, "INC", 28.5),
            raan=_getf(script, "RAAN", 0.0),
            aop=_getf(script, "AOP", 0.0),
            ta=_getf(script, "TA", 0.0),
            dry_mass=_getf(script, "DryMass", 100.0),
        )
        resources.spacecraft.append(sc)

    gs_names = re.findall(r"Create\s+GroundStation\s+(\w+)", script)
    for name in gs_names:
        gs = GroundStation(name=name)
        resources.ground_stations.append(gs)

    m_days = re.search(r"ElapsedDays\s*=\s*([\d.]+)", script)
    if m_days:
        resources.duration_days = float(m_days.group(1))

    return resources
