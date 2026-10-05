"""Geographic normalization and distance computations for CivicFix / NagarSetu."""

import math
from typing import Optional, Tuple


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> Optional[float]:
    """Computes great-circle distance between two GPS coordinates in meters using the Haversine formula."""
    try:
        lat1, lon1, lat2, lon2 = float(lat1), float(lon1), float(lat2), float(lon2)
    except (ValueError, TypeError):
        return None

    # Earth radius in meters
    r = 6371000.0

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)

    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))

    return r * c


def calculate_geographic_similarity(distance_meters: Optional[float], max_distance_threshold: float = 300.0) -> float:
    """Computes a normalized geographic proximity score between 0.0 and 1.0.

    - Exactly same location (0m): 1.0
    - Within 50m: ~0.95
    - Within 100m: ~0.85
    - Beyond max_distance_threshold: 0.0
    """
    if distance_meters is None or distance_meters < 0:
        return 0.0

    if distance_meters > max_distance_threshold:
        return 0.0

    # Exponential decay over threshold
    similarity = math.exp(-2.5 * (distance_meters / max_distance_threshold))
    return max(0.0, min(1.0, round(similarity, 4)))


def validate_coordinates(lat: Optional[float], lng: Optional[float]) -> Tuple[bool, Optional[float], Optional[float]]:
    """Validates whether coordinates are valid WGS84 coordinates."""
    if lat is None or lng is None:
        return False, None, None
    try:
        lat_f = float(lat)
        lng_f = float(lng)
        if -90.0 <= lat_f <= 90.0 and -180.0 <= lng_f <= 180.0:
            return True, lat_f, lng_f
        return False, None, None
    except (ValueError, TypeError):
        return False, None, None
