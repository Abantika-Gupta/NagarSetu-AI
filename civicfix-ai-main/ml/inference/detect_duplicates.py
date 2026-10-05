"""Inference module for semantic and geographic duplicate detection.

Compares incoming complaint against recent active complaints within time window and radius.
Computes calibrated duplicate_probability and clusters into duplicate_group_id.
"""

import sys
from pathlib import Path
from typing import Dict, List, Optional

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import joblib
from sklearn.metrics.pairwise import cosine_similarity

from ml.features.text_features import clean_civic_text
from ml.preprocessing.normalize_locations import haversine_distance_meters, calculate_geographic_similarity

MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "duplicate" / "duplicate_tfidf.joblib"

_VECTORIZER = None


def get_vectorizer():
    global _VECTORIZER
    if _VECTORIZER is None and MODEL_PATH.exists():
        try:
            _VECTORIZER = joblib.load(MODEL_PATH)
        except Exception:
            _VECTORIZER = None
    return _VECTORIZER


def detect_duplicates(
    incoming_text: str,
    incoming_lat: Optional[float],
    incoming_lng: Optional[float],
    incoming_category: str,
    candidate_complaints: List[Dict] = None
) -> Dict[str, any]:
    """Evaluates incoming complaint against candidate complaints to identify duplicates."""
    if not candidate_complaints:
        return {
            "is_duplicate": False,
            "duplicate_probability": 0.0,
            "duplicate_group_id": None,
            "matched_complaint_id": None,
            "matched_complaint": None,
            "distance_meters": None,
            "text_similarity": 0.0,
            "reason": "No existing active complaints nearby for comparison."
        }

    vec = get_vectorizer()
    clean_in = clean_civic_text(incoming_text)

    best_match = None
    max_prob = 0.0

    for cand in candidate_complaints:
        cand_text = clean_civic_text(f"{cand.get('title', '')} {cand.get('description', '')}")

        # Text similarity
        if vec is not None:
            try:
                v1 = vec.transform([clean_in])
                v2 = vec.transform([cand_text])
                text_sim = float(cosine_similarity(v1, v2)[0][0])
            except Exception:
                text_sim = 0.3
        else:
            # Token overlap fallback
            w1 = set(clean_in.split())
            w2 = set(cand_text.split())
            text_sim = len(w1 & w2) / max(1, len(w1 | w2))

        # Geo similarity
        cand_lat = cand.get("lat") or cand.get("latitude") or (cand.get("location", {}).get("lat") if isinstance(cand.get("location"), dict) else None)
        cand_lng = cand.get("lng") or cand.get("longitude") or (cand.get("location", {}).get("lng") if isinstance(cand.get("location"), dict) else None)

        distance_meters = haversine_distance_meters(incoming_lat, incoming_lng, cand_lat, cand_lng)
        geo_sim = calculate_geographic_similarity(distance_meters, max_distance_threshold=300.0)

        # Category similarity
        cand_cat = cand.get("category", "")
        cat_match = 1.0 if cand_cat == incoming_category else 0.0

        # Time similarity: default 0.9 (recent within 48h)
        time_sim = 0.90

        # Probability calculation
        if cat_match == 0:
            prob = text_sim * 0.2 + geo_sim * 0.1
        else:
            prob = (0.40 * text_sim) + (0.35 * geo_sim) + (0.15 * time_sim) + (0.10 * cat_match)

        prob = round(float(max(0.0, min(1.0, prob))), 4)

        if prob > max_prob:
            max_prob = prob
            matched_id = cand.get("complaint_id") or cand.get("complaintId") or cand.get("id") or cand.get("_id")
            best_match = {
                "matched_complaint_id": matched_id,
                "matched_complaint": cand,
                "text_similarity": round(text_sim, 4),
                "geo_similarity": round(geo_sim, 4),
                "distance_meters": round(distance_meters, 1) if distance_meters is not None else None,
                "probability": prob,
                "duplicate_group_id": cand.get("duplicateGroupId") or cand.get("duplicate_group_id") or f"GRP_{matched_id}"
            }

    threshold = 0.65
    is_dup = max_prob >= threshold

    if is_dup and best_match:
        reason = (
            f"Detected {int(best_match['probability']*100)}% duplicate match with {best_match['matched_complaint_id']}. "
            f"Distance: {best_match['distance_meters']}m, Text Similarity: {int(best_match['text_similarity']*100)}%."
        )
        return {
            "is_duplicate": True,
            "duplicate_probability": max_prob,
            "duplicate_group_id": best_match["duplicate_group_id"],
            "matched_complaint_id": best_match["matched_complaint_id"],
            "distance_meters": best_match["distance_meters"],
            "text_similarity": best_match["text_similarity"],
            "reason": reason
        }

    return {
        "is_duplicate": False,
        "duplicate_probability": max_prob,
        "duplicate_group_id": None,
        "matched_complaint_id": None,
        "distance_meters": best_match["distance_meters"] if best_match else None,
        "text_similarity": best_match["text_similarity"] if best_match else 0.0,
        "reason": "No high-probability duplicate detected among nearby active complaints."
    }
