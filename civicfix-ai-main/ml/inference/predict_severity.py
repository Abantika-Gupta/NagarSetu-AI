"""Inference module for real-time civic complaint severity estimation.

Predicts severity: LOW, MEDIUM, HIGH, CRITICAL.
Uses hazard indicators, photo evidence, category, and environmental risk.
"""

import sys
from pathlib import Path
from typing import Dict

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import joblib
import pandas as pd

from ml.features.text_features import clean_civic_text, extract_urgency_indicators

MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "severity" / "severity_model.joblib"

_CACHED_MODEL = None


def get_severity_model():
    global _CACHED_MODEL
    if _CACHED_MODEL is None and MODEL_PATH.exists():
        try:
            _CACHED_MODEL = joblib.load(MODEL_PATH)
        except Exception:
            _CACHED_MODEL = None
    return _CACHED_MODEL


def predict_severity(
    text: str,
    category: str = "OTHER",
    has_photo_evidence: bool = False,
    is_monsoon_season: bool = False
) -> Dict[str, any]:
    """Estimates complaint severity and confidence score."""
    cleaned = clean_civic_text(text)
    urgency_feat = extract_urgency_indicators(cleaned)
    hazard_score = urgency_feat["hazard_score"]

    model = get_severity_model()
    if model is not None:
        try:
            input_df = pd.DataFrame([{
                "clean_text": cleaned,
                "category": category,
                "hazard_score": hazard_score,
                "is_monsoon_season": int(is_monsoon_season)
            }])
            probs = model.predict_proba(input_df)[0]
            max_idx = probs.argmax()
            pred_severity = model.classes_[max_idx]
            confidence = round(float(probs[max_idx]), 4)

            # Safety override: if strong critical hazard detected (e.g. open manhole near school or live shock wire)
            if urgency_feat["critical_matches"]:
                pred_severity = "CRITICAL"
                confidence = max(confidence, 0.95)

            return {
                "severity": pred_severity,
                "confidence": confidence,
                "hazard_score": hazard_score,
                "critical_indicators": urgency_feat["critical_matches"],
                "source": "ml_severity_model",
                "model_version": "1.0.0"
            }
        except Exception:
            pass

    # Deterministic baseline calibration
    critical_matches = urgency_feat["critical_matches"]
    high_matches = urgency_feat["high_matches"]

    if critical_matches or hazard_score >= 60:
        severity = "CRITICAL"
        conf = 0.92
    elif high_matches or hazard_score >= 35 or (is_monsoon_season and category in ("DRAINAGE_FLOODING", "ROADS_POTHOLES")):
        severity = "HIGH"
        conf = 0.85
    elif hazard_score >= 15 or has_photo_evidence:
        severity = "MEDIUM"
        conf = 0.78
    else:
        severity = "LOW"
        conf = 0.70

    return {
        "severity": severity,
        "confidence": conf,
        "hazard_score": hazard_score,
        "critical_indicators": critical_matches,
        "source": "rule_based_severity",
        "model_version": "1.0.0"
    }
