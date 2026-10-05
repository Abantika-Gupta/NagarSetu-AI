"""Inference module for civic complaint category classification.

Loads trained TF-IDF + LogisticRegression pipeline or gracefully falls back
to the deterministic linguistic engine if model artifact is not yet present.
"""

import sys
from pathlib import Path
from typing import Dict, Tuple

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import joblib

from ml.features.text_features import clean_civic_text
from ml.preprocessing.normalize_categories import normalize_category, CANONICAL_CATEGORIES

MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "text" / "complaint_classifier.joblib"

_CACHED_MODEL = None


def get_model():
    global _CACHED_MODEL
    if _CACHED_MODEL is None and MODEL_PATH.exists():
        try:
            _CACHED_MODEL = joblib.load(MODEL_PATH)
        except Exception:
            _CACHED_MODEL = None
    return _CACHED_MODEL


def classify_text(text: str, user_hint: str = "") -> Dict[str, any]:
    """Classifies natural language civic complaint into canonical category with confidence."""
    cleaned = clean_civic_text(text)
    if not cleaned:
        category = normalize_category(user_hint) if user_hint else "OTHER"
        return {
            "category": category,
            "confidence": 0.50 if user_hint else 0.30,
            "source": "fallback_empty_input",
            "model_version": "1.0.0"
        }

    model = get_model()
    if model is not None:
        try:
            probs = model.predict_proba([cleaned])[0]
            max_idx = probs.argmax()
            pred_class = model.classes_[max_idx]
            confidence = round(float(probs[max_idx]), 4)

            # If user explicitly selected a non-other category and model confidence is marginal (<0.40)
            if user_hint and user_hint != "other" and confidence < 0.40:
                pred_class = normalize_category(user_hint)
                confidence = 0.60

            return {
                "category": pred_class,
                "confidence": confidence,
                "source": "ml_text_classifier",
                "model_version": "1.0.0"
            }
        except Exception as e:
            pass

    # Deterministic fallback engine
    cat = normalize_category(user_hint) if user_hint and user_hint != "other" else None
    if not cat or cat == "OTHER":
        # Heuristic keyword match
        lowered = cleaned.lower()
        if any(w in lowered for w in ["pothole", "gaddha", "broken road", "sadak", "asphalt", "crater"]):
            cat = "ROADS_POTHOLES"
        elif any(w in lowered for w in ["garbage", "kachra", "waste", "trash", "dustbin", "dumping", "moyla"]):
            cat = "GARBAGE_SOLID_WASTE"
        elif any(w in lowered for w in ["drain", "waterlogging", "paani", "nala", "flood", "stagnant"]):
            cat = "DRAINAGE_FLOODING"
        elif any(w in lowered for w in ["light", "streetlight", "pole", "wire", "dark", "andhera", "bulb"]):
            cat = "STREETLIGHT"
        elif any(w in lowered for w in ["pipe burst", "pipeline burst", "leakage", "gushing"]):
            cat = "WATER_LEAKAGE"
        elif any(w in lowered for w in ["no water", "drinking water", "water supply", "tanker"]):
            cat = "WATER_SUPPLY"
        elif any(w in lowered for w in ["manhole", "sewer", "sewage", "gutter"]):
            cat = "SEWERAGE"
        elif any(w in lowered for w in ["toilet", "urinal", "sulabh", "shauchalay"]):
            cat = "PUBLIC_TOILET"
        elif any(w in lowered for w in ["tree", "branch", "ped", "trimming"]):
            cat = "TREE_HAZARD"
        elif any(w in lowered for w in ["dog", "animal", "cattle", "rabies"]):
            cat = "STRAY_ANIMAL"
        elif any(w in lowered for w in ["smoke", "pollution", "noise", "burning"]):
            cat = "AIR_NOISE_POLLUTION"
        elif any(w in lowered for w in ["dengue", "malaria", "mosquito", "clinic"]):
            cat = "PUBLIC_HEALTH"
        elif any(w in lowered for w in ["encroachment", "hawker", "stall"]):
            cat = "ENCROACHMENT"
        elif any(w in lowered for w in ["illegal construction", "building without permission"]):
            cat = "ILLEGAL_CONSTRUCTION"
        else:
            cat = "OTHER"

    return {
        "category": cat,
        "confidence": 0.75 if cat != "OTHER" else 0.40,
        "source": "deterministic_baseline",
        "model_version": "1.0.0"
    }
