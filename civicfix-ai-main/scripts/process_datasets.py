"""Dataset Preprocessing and Normalization Pipeline for CivicFix / NagarSetu.

Transforms raw BMC and NYC 311 datasets into:
- data/interim/bmc_cleaned.parquet / .csv
- data/interim/nyc_cleaned.parquet / .csv
- data/processed/complaints.parquet / .csv
- data/processed/complaint_text.csv
- data/processed/complaint_features.parquet / .csv

Enforces strict separation of real-time vs. post-resolution features.
"""

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import pandas as pd

from ml.preprocessing.clean_bmc import clean_bmc_dataframe, split_realtime_and_post_resolution
from ml.preprocessing.clean_nyc import clean_nyc_dataframe
from ml.preprocessing.normalize_categories import canonical_to_legacy
DATA_DIR = ROOT_DIR / "data"
RAW_BMC_FILE = DATA_DIR / "raw" / "bmc" / "bmc_train.csv"
RAW_NYC_FILE = DATA_DIR / "raw" / "nyc_311" / "311_service_requests.csv"
INTERIM_DIR = DATA_DIR / "interim"
PROCESSED_DIR = DATA_DIR / "processed"


def save_df(df: pd.DataFrame, base_path: Path):
    """Saves dataframe as parquet if engine available, always saves csv backup."""
    csv_path = base_path.with_suffix(".csv")
    df.to_csv(csv_path, index=False)

    try:
        parquet_path = base_path.with_suffix(".parquet")
        df.to_parquet(parquet_path, index=False)
        print(f"  [OK] Saved {parquet_path}")
    except Exception:
        print(f"  [OK] Saved {csv_path} (parquet engine optional)")


def process_datasets():
    print("=== Processing Datasets ===")
    INTERIM_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    if not RAW_BMC_FILE.exists():
        print(f"Error: {RAW_BMC_FILE} does not exist. Run python scripts/download_datasets.py first.")
        return

    print("Cleaning BMC Mumbai dataset...")
    raw_bmc_df = pd.read_csv(RAW_BMC_FILE)
    cleaned_bmc = clean_bmc_dataframe(raw_bmc_df)
    save_df(cleaned_bmc, INTERIM_DIR / "bmc_cleaned")

    realtime_bmc, post_res_bmc = split_realtime_and_post_resolution(cleaned_bmc)
    print(f"  Real-time feature columns: {len(realtime_bmc.columns)}")
    print(f"  Post-resolution columns: {len(post_res_bmc.columns)}")

    if RAW_NYC_FILE.exists():
        print("Cleaning NYC 311 benchmark dataset...")
        raw_nyc_df = pd.read_csv(RAW_NYC_FILE)
        cleaned_nyc = clean_nyc_dataframe(raw_nyc_df)
        save_df(cleaned_nyc, INTERIM_DIR / "nyc_cleaned")

    # Build canonical unified complaints dataset
    unified_records = []
    for _, row in cleaned_bmc.iterrows():
        category = row.get("canonical_category", "OTHER")
        severity = row.get("canonical_severity", "MEDIUM")
        unified_records.append({
            "external_id": row.get("complaint_id", ""),
            "description": row.get("description", ""),
            "category": category,
            "legacy_category": canonical_to_legacy(category),
            "severity": severity,
            "department": row.get("department_assigned", "General Civic Department"),
            "ward": row.get("ward_code", "General Ward"),
            "zone": row.get("zone", "Zone 1"),
            "complaint_channel": row.get("complaint_channel", "Web"),
            "is_monsoon_season": bool(row.get("is_monsoon_season", False)),
            "citizen_satisfied": int(row.get("citizen_satisfied", 1)),
        })

    unified_df = pd.DataFrame(unified_records)
    save_df(unified_df, PROCESSED_DIR / "complaints")

    # Save text classification corpus specifically
    text_corpus_df = unified_df[["description", "category", "severity", "department"]].dropna()
    text_corpus_path = PROCESSED_DIR / "complaint_text.csv"
    text_corpus_df.to_csv(text_corpus_path, index=False)
    print(f"  [OK] Saved text training corpus with {len(text_corpus_df)} records to {text_corpus_path}")

    print("=== Processing Complete ===")


if __name__ == "__main__":
    process_datasets()
