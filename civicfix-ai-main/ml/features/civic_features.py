"""Unified civic feature aggregator for real-time model scoring.

Strictly excludes any post-resolution fields.
"""

from typing import Dict, Optional
from ml.features.text_features import clean_civic_text, extract_urgency_indicators
from ml.features.geo_features import extract_location_importance
from ml.features.temporal_features import extract_temporal_features


def build_realtime_feature_record(
    title: str,
    description: str,
    address: str = "",
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    has_photo_evidence: bool = False,
    duplicate_count: int = 0,
    ward: str = "",
) -> Dict[str, any]:
    """Builds a strictly real-time feature dictionary for complaint triage."""
    combined_text = f"{title} {description}".strip()
    cleaned = clean_civic_text(combined_text)

    urgency_feat = extract_urgency_indicators(cleaned)
    geo_feat = extract_location_importance(address)
    temporal_feat = extract_temporal_features()

    return {
        "text": cleaned,
        "raw_title": title,
        "raw_description": description,
        "address": address,
        "latitude": latitude,
        "longitude": longitude,
        "has_photo_evidence": bool(has_photo_evidence),
        "duplicate_count": max(0, int(duplicate_count)),
        "ward": ward or "General",
        # Urgency & safety
        "hazard_score": urgency_feat["hazard_score"],
        "safety_risk_level": urgency_feat["safety_risk_level"],
        "critical_matches": urgency_feat["critical_matches"],
        "high_matches": urgency_feat["high_matches"],
        "medium_matches": urgency_feat["medium_matches"],
        # Geo
        "location_importance_score": geo_feat["importance_score"],
        "is_near_sensitive_site": geo_feat["is_near_sensitive_site"],
        "detected_landmarks": geo_feat["detected_landmarks"],
        # Temporal
        "is_monsoon_season": temporal_feat["is_monsoon_season"],
        "is_night": temporal_feat["is_night"],
        "time_of_day": temporal_feat["time_of_day"],
    }
