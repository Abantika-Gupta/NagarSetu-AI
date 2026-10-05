"""Geographic feature engineering for civic complaints.

Calculates ward population proxies, proximity to sensitive civic assets
(schools, hospitals, transit hubs), and spatial cluster densities.
"""

from typing import Dict, Optional, Tuple
from ml.preprocessing.normalize_locations import haversine_distance_meters, calculate_geographic_similarity

# High-priority civic institutions and arterial transit nodes proxy
SENSITIVE_LANDMARKS = [
    "school", "vidyalaya", "college", "university",
    "hospital", "clinic", "dispensary", "aspatal",
    "station", "railway", "metro", "bus stand", "depot",
    "flyover", "highway", "main road", "chowk", "junction"
]


def extract_location_importance(address: str, ward_population_density: Optional[float] = None) -> Dict[str, any]:
    """Calculates location importance score (0-100) and detects sensitive institutions from address/landmark."""
    address_lower = (address or "").lower()
    detected_landmarks = [lm for lm in SENSITIVE_LANDMARKS if lm in address_lower]

    importance_score = 40  # baseline
    if detected_landmarks:
        importance_score += min(45, len(detected_landmarks) * 20)

    if ward_population_density and ward_population_density > 25000:
        importance_score += 15

    return {
        "importance_score": min(100, importance_score),
        "detected_landmarks": detected_landmarks,
        "is_near_sensitive_site": len(detected_landmarks) > 0,
    }
