"""Convert ECI position + time to geodetic lat/lon for ground track rendering."""
from __future__ import annotations

import math
from datetime import datetime, timezone


_J2000_UNIX = 946727935.816  # Unix timestamp of J2000.0
_OMEGA_EARTH = 7.2921150e-5  # Earth rotation rate rad/s
_GMST_J2000 = 1.7533685892  # GMST at J2000 in radians


def _parse_gmat_time(t_str: str) -> float:
    """Convert GMAT 'DD Mon YYYY HH:MM:SS.mmm' to Unix timestamp."""
    try:
        dt = datetime.strptime(t_str.strip(), "%d %b %Y %H:%M:%S.%f")
    except ValueError:
        dt = datetime.strptime(t_str.strip(), "%d %b %Y %H:%M:%S.000")
    return dt.replace(tzinfo=timezone.utc).timestamp()


def eci_to_latlon(x_km: float, y_km: float, z_km: float, unix_t: float) -> tuple[float, float, float]:
    """Convert ECI (km) to geodetic (lat_deg, lon_deg, alt_km)."""
    seconds_from_j2000 = unix_t - _J2000_UNIX
    gmst = _GMST_J2000 + _OMEGA_EARTH * seconds_from_j2000
    gmst = gmst % (2 * math.pi)

    cos_g, sin_g = math.cos(gmst), math.sin(gmst)
    x_ecef = cos_g * x_km + sin_g * y_km
    y_ecef = -sin_g * x_km + cos_g * y_km
    z_ecef = z_km

    r_xy = math.sqrt(x_ecef**2 + y_ecef**2)
    lon_rad = math.atan2(y_ecef, x_ecef)
    lat_rad = math.atan2(z_ecef, r_xy)
    alt_km = math.sqrt(x_km**2 + y_km**2 + z_km**2) - 6371.0

    lat_deg = math.degrees(lat_rad)
    lon_deg = math.degrees(lon_rad)

    return lat_deg, lon_deg, alt_km


def ephemeris_to_groundtrack(rows: list[dict]) -> list[dict[str, float]]:
    """Convert list of ephemeris rows to ground track points."""
    track = []
    for row in rows:
        try:
            unix_t = _parse_gmat_time(row["t"])
            lat, lon, alt = eci_to_latlon(row["x"], row["y"], row["z"], unix_t)
            track.append({"lat": round(lat, 5), "lon": round(lon, 5), "alt": round(alt, 2), "t": row["t"]})
        except Exception:
            continue
    return track


def split_groundtrack_segments(track: list[dict]) -> list[list[dict]]:
    """Split ground track at antimeridian crossings to avoid line wrap-around."""
    if not track:
        return []

    segments: list[list[dict]] = [[track[0]]]
    for i in range(1, len(track)):
        prev_lon = track[i - 1]["lon"]
        curr_lon = track[i]["lon"]
        if abs(curr_lon - prev_lon) > 180:
            segments.append([])
        segments[-1].append(track[i])
    return [s for s in segments if s]
