"""Master Civic AI Triage Service.

Unifies NLP classification, severity estimation, department routing,
duplicate detection, explainable priority scoring, and SLA estimation.
Outputs the exact schema specified in Section 23 of the prompt.
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Optional

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from ml.features.text_features import clean_civic_text, extract_urgency_indicators
from ml.features.geo_features import extract_location_importance
from ml.features.temporal_features import extract_temporal_features
from ml.inference.classify_complaint import classify_text
from ml.inference.predict_severity import predict_severity
from ml.inference.predict_department import predict_department
from ml.inference.detect_duplicates import detect_duplicates
from ml.inference.calculate_priority import calculate_priority_score
from ml.inference.classify_image import classify_image_evidence


def calculate_sla_hours(severity: str, category: str) -> int:
    """Calculates SLA target hours based on severity and category overrides."""
    sev_upper = str(severity).upper()
    cat_upper = str(category).upper()

    if cat_upper in ("SEWERAGE", "WATER_LEAKAGE") and sev_upper in ("CRITICAL", "HIGH"):
        return 4 if sev_upper == "CRITICAL" else 12

    if sev_upper == "CRITICAL":
        return 4
    elif sev_upper == "HIGH":
        return 24
    elif sev_upper == "MEDIUM":
        return 72
    else:
        return 168


def triage_complaint(payload: Dict) -> Dict:
    """Executes the full end-to-end AI triage pipeline for an incoming complaint."""
    title = str(payload.get("title", "")).strip()
    description = str(payload.get("description", "")).strip()
    user_category = str(payload.get("category", "")).strip()
    latitude = payload.get("latitude") or payload.get("lat")
    longitude = payload.get("longitude") or payload.get("lng")
    address = str(payload.get("address", "")).strip()
    image_url = payload.get("image_url") or payload.get("imageUrl") or ""
    candidate_complaints = payload.get("candidate_complaints", [])

    full_text = f"{title} {description}".strip()

    # 1. Category Classification
    cat_result = classify_text(full_text, user_hint=user_category)
    canonical_cat = cat_result["category"]
    cat_conf = cat_result["confidence"]

    # 2. Image Evidence Classification (if provided)
    img_result = classify_image_evidence(image_url, category_hint=canonical_cat)
    has_photo = img_result["has_image"]

    # 3. Severity Estimation
    temporal = extract_temporal_features()
    sev_result = predict_severity(
        full_text,
        category=canonical_cat,
        has_photo_evidence=has_photo,
        is_monsoon_season=temporal["is_monsoon_season"]
    )
    canonical_sev = sev_result["severity"]
    sev_conf = sev_result["confidence"]

    # 4. Department Routing
    dept_result = predict_department(canonical_cat, category_confidence=cat_conf)
    target_dept = dept_result["department"]
    dept_conf = dept_result["confidence"]

    # 5. Duplicate Detection
    dup_result = detect_duplicates(
        incoming_text=full_text,
        incoming_lat=latitude,
        incoming_lng=longitude,
        incoming_category=canonical_cat,
        candidate_complaints=candidate_complaints
    )
    dup_prob = dup_result["duplicate_probability"]
    dup_group = dup_result["duplicate_group_id"]

    # 6. Location & Urgency features for Explainable Priority
    geo_feat = extract_location_importance(address)
    urgency_feat = extract_urgency_indicators(full_text)

    # 7. Priority Scoring
    priority_result = calculate_priority_score(
        severity=canonical_sev,
        location_importance=geo_feat["importance_score"],
        duplicate_count=1 if dup_result["is_duplicate"] else 0,
        safety_risk_level=urgency_feat["safety_risk_level"],
        has_photo_evidence=has_photo,
        is_monsoon_season=temporal["is_monsoon_season"],
        near_institution=geo_feat["is_near_sensitive_site"]
    )

    # 8. SLA Calculation
    sla_hours = calculate_sla_hours(canonical_sev, canonical_cat)

    # Format exactly as requested in Section 23
    return {
        "category": {
            "value": canonical_cat,
            "confidence": cat_conf,
            "source": cat_result["source"]
        },
        "severity": {
            "value": canonical_sev,
            "confidence": sev_conf,
            "hazard_score": sev_result["hazard_score"]
        },
        "department": {
            "value": target_dept,
            "confidence": dept_conf,
            "reason": dept_result["reason"]
        },
        "duplicate_probability": dup_prob,
        "is_duplicate": dup_result["is_duplicate"],
        "duplicate_group_id": dup_group,
        "priority": {
            "score": priority_result["priority_score"],
            "level": priority_result["priority_level"],
            "reasons": priority_result["priority_reasons"]
        },
        "sla": {
            "hours": sla_hours,
            "status": "ON_TRACK"
        },
        "image_analysis": img_result,
        "model_version": "1.0.0"
    }


def main():
    """CLI / Standard I/O invocation handler."""
    raw_input = ""
    if len(sys.argv) > 1:
        raw_input = " ".join(sys.argv[1:]).strip()
    else:
        raw_input = sys.stdin.read().strip()

    # Handle Windows PowerShell string quoting
    if raw_input.startswith("'") and raw_input.endswith("'"):
        raw_input = raw_input[1:-1].strip()

    try:
        try:
            payload = json.loads(raw_input) if raw_input else {}
        except Exception:
            import ast
            payload = ast.literal_eval(raw_input) if raw_input else {}

        result = triage_complaint(payload)
        print(json.dumps(result, indent=2))
    except Exception as e:
        # Fallback safe error response
        fallback_res = {
            "category": {"value": "OTHER", "confidence": 0.40, "source": "system_error_fallback"},
            "severity": {"value": "MEDIUM", "confidence": 0.50, "hazard_score": 25},
            "department": {"value": "General Civic Department", "confidence": 0.60, "reason": "Administrative manual triage required."},
            "duplicate_probability": 0.0,
            "is_duplicate": False,
            "duplicate_group_id": None,
            "priority": {"score": 50, "level": "MEDIUM", "reasons": ["AI analysis fallback engaged: manual triage required"]},
            "sla": {"hours": 72, "status": "ON_TRACK"},
            "error": str(e)
        }
        print(json.dumps(fallback_res, indent=2))



if __name__ == "__main__":
    main()
