"""NYC 311 Service Requests Preprocessing and Normalization Module.

Standardizes NYC 311 service requests into the normalized NagarSetu schema
and maps NYC agencies and categories to canonical NagarSetu definitions.
"""

from pathlib import Path
from typing import Dict, List, Optional
import pandas as pd

from ml.preprocessing.normalize_categories import normalize_category

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
RAW_NYC_DIR = DATA_DIR / "raw" / "nyc_311"

NYC_COLUMNS = [
    "unique_key", "created_date", "closed_date", "agency", "agency_name",
    "complaint_type", "descriptor", "location_type", "incident_zip",
    "incident_address", "street_name", "borough", "latitude", "longitude",
    "status", "due_date", "resolution_description", "community_board",
    "council_district", "police_precinct", "park_facility_name",
    "park_borough", "vehicle_type"
]


def clean_nyc_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Normalizes raw NYC 311 dataframe into canonical NagarSetu format."""
    cleaned = df.copy()

    # Retain only recognized columns that actually exist
    existing_cols = [c for c in NYC_COLUMNS if c in cleaned.columns]
    cleaned = cleaned[existing_cols]

    # Map category
    if "complaint_type" in cleaned.columns:
        cleaned["canonical_category"] = cleaned["complaint_type"].apply(
            lambda ct: normalize_category(str(ct), source="nyc")
        )

    # Date parsing
    for date_col in ["created_date", "closed_date", "due_date"]:
        if date_col in cleaned.columns:
            cleaned[date_col] = pd.to_datetime(cleaned[date_col], errors="coerce")

    # Lat/Lng numeric conversion
    for num_col in ["latitude", "longitude"]:
        if num_col in cleaned.columns:
            cleaned[num_col] = pd.to_numeric(cleaned[num_col], errors="coerce")

    return cleaned
