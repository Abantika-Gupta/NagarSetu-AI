"""Category Normalization Module for CivicFix / NagarSetu.

Maps raw source category labels from BMC (Mumbai), NYC 311, and legacy
NagarSetu categories into the canonical 15 NagarSetu civic categories.
"""

import json
from pathlib import Path
from typing import Dict, Optional

MAPPINGS_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "mappings" / "category_mapping.json"

_CATEGORY_MAPPINGS: Optional[Dict] = None


def load_category_mappings() -> Dict:
    global _CATEGORY_MAPPINGS
    if _CATEGORY_MAPPINGS is None:
        if MAPPINGS_PATH.exists():
            with open(MAPPINGS_PATH, "r", encoding="utf-8") as f:
                _CATEGORY_MAPPINGS = json.load(f)
        else:
            _CATEGORY_MAPPINGS = {
                "bmc_to_canonical": {},
                "nyc_311_to_canonical": {},
                "legacy_to_canonical": {},
                "canonical_to_legacy": {}
            }
    return _CATEGORY_MAPPINGS


CANONICAL_CATEGORIES = [
    "ROADS_POTHOLES",
    "GARBAGE_SOLID_WASTE",
    "DRAINAGE_FLOODING",
    "STREETLIGHT",
    "WATER_SUPPLY",
    "WATER_LEAKAGE",
    "SEWERAGE",
    "PUBLIC_TOILET",
    "ILLEGAL_CONSTRUCTION",
    "ENCROACHMENT",
    "TREE_HAZARD",
    "AIR_NOISE_POLLUTION",
    "STRAY_ANIMAL",
    "PUBLIC_HEALTH",
    "OTHER",
]


def normalize_category(raw_category: str, source: str = "auto") -> str:
    """Normalize an incoming category string into a canonical NagarSetu category.

    Args:
        raw_category: The raw category string from user input or source dataset.
        source: 'bmc', 'nyc', 'legacy', or 'auto'.

    Returns:
        One of the canonical 15 categories, or 'OTHER' if unresolvable.
    """
    if not raw_category or not str(raw_category).strip():
        return "OTHER"

    raw_clean = str(raw_category).strip()
    raw_upper = raw_clean.upper().replace(" ", "_").replace("&", "").replace("-", "_")

    if raw_upper in CANONICAL_CATEGORIES:
        return raw_upper

    mappings = load_category_mappings()

    if source in ("bmc", "auto"):
        bmc_map = mappings.get("bmc_to_canonical", {})
        if raw_clean in bmc_map:
            return bmc_map[raw_clean]
        for k, v in bmc_map.items():
            if k.lower() in raw_clean.lower() or raw_clean.lower() in k.lower():
                return v

    if source in ("nyc", "auto"):
        nyc_map = mappings.get("nyc_311_to_canonical", {})
        if raw_clean in nyc_map:
            return nyc_map[raw_clean]
        for k, v in nyc_map.items():
            if k.lower() in raw_clean.lower() or raw_clean.lower() in k.lower():
                return v

    if source in ("legacy", "auto"):
        legacy_map = mappings.get("legacy_to_canonical", {})
        if raw_clean.lower() in legacy_map:
            return legacy_map[raw_clean.lower()]

    return "OTHER"


def canonical_to_legacy(canonical_category: str) -> str:
    """Maps a canonical category to the legacy lowercase category used by existing frontend components."""
    mappings = load_category_mappings()
    return mappings.get("canonical_to_legacy", {}).get(canonical_category, "other")
