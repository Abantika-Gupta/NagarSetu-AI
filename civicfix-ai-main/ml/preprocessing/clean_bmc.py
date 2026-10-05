"""BMC (Mumbai Nagar Seva) Dataset Preprocessing and Normalization Module.

Strictly separates REAL-TIME features from POST-RESOLUTION features
to ensure zero target or operational data leakage.
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import pandas as pd

from ml.preprocessing.normalize_categories import normalize_category

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
RAW_BMC_DIR = DATA_DIR / "raw" / "bmc"
INTERIM_DIR = DATA_DIR / "interim"
PROCESSED_DIR = DATA_DIR / "processed"

# Source columns to keep
BMC_COLUMNS = [
    # Identity
    "complaint_id", "description",
    # Time
    "complaint_date", "year", "month", "is_monsoon_season", "complaint_time_of_day",
    # Geography
    "ward_code", "ward_area", "zone", "ward_type", "population_density", "ward_slum_percentage",
    # Complaint Real-Time
    "complaint_category", "department_assigned", "complaint_channel", "severity",
    "has_photo_evidence", "has_gps_location", "media_attention", "politically_sensitive",
    # Complainant / Context
    "complainant_type", "property_type", "repeat_complainant", "prior_complaints_count",
    # Resolution / Analytics (POST-RESOLUTION ONLY)
    "resolution_days", "num_reassignments", "complaint_status", "contractor_category",
    "work_quality_rating", "site_inspected", "defect_liability_claim", "estimated_cost_inr",
    "infrastructure_age_years", "months_since_last_maintained",
    # Macro
    "regional_labor_shortage", "local_unemployment_rate",
    # Target (Retrospective only)
    "citizen_satisfied"
]

POST_RESOLUTION_FIELDS = {
    "resolution_days", "num_reassignments", "complaint_status", "contractor_category",
    "work_quality_rating", "site_inspected", "defect_liability_claim", "estimated_cost_inr",
    "infrastructure_age_years", "months_since_last_maintained", "citizen_satisfied"
}


def clean_bmc_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Cleans, validates, and normalizes BMC complaint records into the NagarSetu schema."""
    cleaned = df.copy()

    # Retain only recognized columns that actually exist in the dataframe
    existing_cols = [c for c in BMC_COLUMNS if c in cleaned.columns]
    cleaned = cleaned[existing_cols]

    # Ensure description exists
    if "description" not in cleaned.columns:
        cleaned["description"] = ""

    # Fill empty descriptions with informative civic narrative
    def make_description(row):
        existing = str(row.get("description", "")).strip()
        if existing and existing != "nan":
            return existing
        cat = row.get("complaint_category", "Civic issue")
        ward = row.get("ward_code", "municipal area")
        area = row.get("ward_area", "")
        return f"Urgent report regarding {cat} located in {ward} {area} requiring immediate municipal attention."

    cleaned["description"] = cleaned.apply(make_description, axis=1)

    # Clean nulls / string types
    if "complaint_id" in cleaned.columns:
        cleaned["complaint_id"] = cleaned["complaint_id"].astype(str)

    if "complaint_category" in cleaned.columns:
        cleaned["canonical_category"] = cleaned["complaint_category"].apply(
            lambda cat: normalize_category(str(cat), source="bmc")
        )

    # Normalize severity
    if "severity" in cleaned.columns:
        severity_map = {
            "low": "LOW", "1": "LOW", "minor": "LOW",
            "medium": "MEDIUM", "2": "MEDIUM", "moderate": "MEDIUM",
            "high": "HIGH", "3": "HIGH", "major": "HIGH",
            "critical": "CRITICAL", "4": "CRITICAL", "urgent": "CRITICAL",
        }
        cleaned["canonical_severity"] = cleaned["severity"].astype(str).str.strip().str.lower().map(
            lambda s: severity_map.get(s, "MEDIUM")
        )

    # Date parsing
    if "complaint_date" in cleaned.columns:
        cleaned["complaint_date"] = pd.to_datetime(cleaned["complaint_date"], errors="coerce")

    # Monsoon boolean check
    if "is_monsoon_season" in cleaned.columns:
        cleaned["is_monsoon_season"] = cleaned["is_monsoon_season"].astype(bool)

    return cleaned


def split_realtime_and_post_resolution(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Splits cleaned BMC records into strictly real-time and post-resolution feature sets.

    Guarantees no post-resolution fields leak into real-time training features.
    """
    realtime_cols = [c for c in df.columns if c not in POST_RESOLUTION_FIELDS]
    post_res_cols = [c for c in df.columns if c in POST_RESOLUTION_FIELDS or c == "complaint_id"]

    return df[realtime_cols].copy(), df[post_res_cols].copy()
