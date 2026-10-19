from math import radians, sin, cos, sqrt, atan2
from typing import Optional

# Known city centers with approximate coordinates
KNOWN_CITIES = [
    {"name": "Tangier",     "lat": 35.7595,  "lon": -5.8340},
    {"name": "Marrakech",   "lat": 31.6295,  "lon": -7.9811},
    {"name": "Casablanca",  "lat": 33.5731,  "lon": -7.5898},
    {"name": "Fes",         "lat": 34.0181,  "lon": -5.0078},
    {"name": "Rabat",       "lat": 33.9716,  "lon": -6.8498},
    {"name": "Cairo",       "lat": 30.0444,  "lon": 31.2357},
    {"name": "Paris",       "lat": 48.8566,  "lon":  2.3522},
    {"name": "Rome",        "lat": 41.9028,  "lon": 12.4964},
    {"name": "Barcelona",   "lat": 41.3851,  "lon":  2.1734},
    {"name": "Istanbul",    "lat": 41.0082,  "lon": 28.9784},
    {"name": "Dubai",       "lat": 25.2048,  "lon": 55.2708},
]

# Maximum distance (km) to claim a known city; beyond this, return "Unknown"
CITY_THRESHOLD_KM = 150


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def derive_city_from_latlon(latitude: float, longitude: float) -> str:
    """Return the nearest known city name, or 'Unknown' if beyond threshold."""
    best_name = "Unknown"
    best_dist = float("inf")

    for city in KNOWN_CITIES:
        dist = _haversine_km(latitude, longitude, city["lat"], city["lon"])
        if dist < best_dist:
            best_dist = dist
            best_name = city["name"]

    return best_name if best_dist <= CITY_THRESHOLD_KM else "Unknown"
