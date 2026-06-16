"""Convert ephemeris rows to CZML format for CesiumJS 3D rendering."""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone


def _parse_gmat_time_iso(t_str: str) -> str:
    """Convert GMAT time string to ISO 8601."""
    try:
        dt = datetime.strptime(t_str.strip(), "%d %b %Y %H:%M:%S.%f")
    except ValueError:
        dt = datetime.strptime(t_str.strip(), "%d %b %Y %H:%M:%S.000")
    return dt.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def _km_to_m(v: float) -> float:
    return v * 1000.0


def ephemeris_to_czml(rows: list[dict], spacecraft_name: str = "Spacecraft") -> list[dict]:
    """Convert ephemeris rows to a CZML document (list of packets)."""
    if not rows:
        return []

    start_iso = _parse_gmat_time_iso(rows[0]["t"])
    end_iso = _parse_gmat_time_iso(rows[-1]["t"])
    interval = f"{start_iso}/{end_iso}"

    # CZML header packet
    header = {
        "id": "document",
        "name": "Mission Agent — Orbit",
        "version": "1.0",
        "clock": {
            "interval": interval,
            "currentTime": start_iso,
            "multiplier": 60,
            "range": "LOOP_STOP",
            "step": "SYSTEM_CLOCK_MULTIPLIER",
        },
    }

    # Cartesian positions: [t_offset_sec, x, y, z, ...]
    t0_str = rows[0]["t"]
    try:
        t0 = datetime.strptime(t0_str.strip(), "%d %b %Y %H:%M:%S.%f").replace(tzinfo=timezone.utc)
    except ValueError:
        t0 = datetime.strptime(t0_str.strip(), "%d %b %Y %H:%M:%S.000").replace(tzinfo=timezone.utc)

    cartesian: list[float] = []
    for row in rows:
        try:
            dt = datetime.strptime(row["t"].strip(), "%d %b %Y %H:%M:%S.%f").replace(tzinfo=timezone.utc)
        except ValueError:
            dt = datetime.strptime(row["t"].strip(), "%d %b %Y %H:%M:%S.000").replace(tzinfo=timezone.utc)
        offset = (dt - t0).total_seconds()
        cartesian.extend([offset, _km_to_m(row["x"]), _km_to_m(row["y"]), _km_to_m(row["z"])])

    sc_packet = {
        "id": spacecraft_name,
        "name": spacecraft_name,
        "availability": interval,
        "label": {
            "text": spacecraft_name,
            "font": "bold 13pt Inter, sans-serif",
            "style": "FILL_AND_OUTLINE",
            "outlineWidth": 2,
            "horizontalOrigin": "LEFT",
            "pixelOffset": {"cartesian2": [14, 0]},
            "fillColor": {"rgba": [255, 255, 255, 255]},
            "outlineColor": {"rgba": [0, 0, 0, 200]},
            "showBackground": True,
            "backgroundColor": {"rgba": [0, 0, 0, 80]},
            "backgroundPadding": {"cartesian2": [4, 2]},
        },
        "point": {
            "color": {"rgba": [249, 115, 22, 255]},   # accent orange
            "outlineColor": {"rgba": [255, 255, 255, 220]},
            "outlineWidth": 2,
            "pixelSize": 12,
        },
        "path": {
            "material": {"solidColor": {"color": {"rgba": [249, 115, 22, 200]}}},
            "width": 2.5,
            "leadTime": 5400,
            "trailTime": 5400,
            "resolution": 60,
        },
        "position": {
            "interpolationAlgorithm": "LAGRANGE",
            "interpolationDegree": 5,
            "referenceFrame": "INERTIAL",
            "epoch": start_iso,
            "cartesian": cartesian,
        },
    }

    return [header, sc_packet]


def czml_to_json(czml: list[dict]) -> str:
    return json.dumps(czml)
