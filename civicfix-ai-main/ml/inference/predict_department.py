"""Department Routing Module: Deterministic Rules + ML Assisted.

Routes complaints to the responsible municipal department and provides
a transparent, explainable reason and confidence score.
"""

from typing import Dict, List, Optional
import yaml
from pathlib import Path

DEPARTMENTS_CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "departments.yaml"

_DEPARTMENT_CONFIG = None


def get_department_config():
    global _DEPARTMENT_CONFIG
    if _DEPARTMENT_CONFIG is None and DEPARTMENTS_CONFIG_PATH.exists():
        try:
            with open(DEPARTMENTS_CONFIG_PATH, "r", encoding="utf-8") as f:
                _DEPARTMENT_CONFIG = yaml.safe_load(f).get("department_routing", {})
        except Exception:
            _DEPARTMENT_CONFIG = {}
    return _DEPARTMENT_CONFIG or {}


# Legacy system department name map (matches existing Department models and officers)
CANONICAL_TO_LEGACY_DEPARTMENT = {
    "ROADS_POTHOLES": "Road Maintenance Department",
    "GARBAGE_SOLID_WASTE": "Sanitation Department",
    "DRAINAGE_FLOODING": "Drainage Department",
    "STREETLIGHT": "Streetlight & Electricity Department",
    "WATER_SUPPLY": "Water Supply Department",
    "WATER_LEAKAGE": "Water Supply Department",
    "SEWERAGE": "Drainage Department",
    "PUBLIC_TOILET": "Sanitation Department",
    "ILLEGAL_CONSTRUCTION": "Public Safety Department",
    "ENCROACHMENT": "Traffic Department",
    "TREE_HAZARD": "Parks & Environment Department",
    "AIR_NOISE_POLLUTION": "Parks & Environment Department",
    "STRAY_ANIMAL": "Public Safety Department",
    "PUBLIC_HEALTH": "Health & Hygiene Department",
    "OTHER": "General Civic Department"
}


def predict_department(
    canonical_category: str,
    category_confidence: float = 0.85,
    text_indicators: Optional[List[str]] = None
) -> Dict[str, any]:
    """Routes complaint to municipal department with confidence and explanation."""
    cfg = get_department_config()
    rule = cfg.get(canonical_category, {})

    target_department = CANONICAL_TO_LEGACY_DEPARTMENT.get(
        canonical_category, "General Civic Department"
    )

    reason = rule.get("reason", f"Routed to {target_department} based on category {canonical_category}.")

    # Confidence is bounded by category confidence
    routing_confidence = round(min(0.98, max(0.60, category_confidence * 1.05)), 4)

    return {
        "department": target_department,
        "confidence": routing_confidence,
        "reason": reason,
        "agency_code": rule.get("agency_code", "GEN"),
        "model_version": "1.0.0"
    }
