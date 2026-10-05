"""Dataset Validation and Anti-Leakage Test Suite for CivicFix / NagarSetu.

Tests Section 37 requirements:
- Dataset schema validation
- Null handling
- Category normalization
- Date parsing
- Coordinate validation
- Strict real-time vs post-resolution isolation (anti-leakage)
"""

import sys
from pathlib import Path
import unittest
import pandas as pd
import numpy as np

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from ml.preprocessing.clean_bmc import clean_bmc_dataframe, split_realtime_and_post_resolution, POST_RESOLUTION_FIELDS
from ml.preprocessing.normalize_categories import normalize_category, CANONICAL_CATEGORIES
from ml.preprocessing.normalize_locations import haversine_distance_meters, calculate_geographic_similarity


class TestDatasetValidation(unittest.TestCase):

    def setUp(self):
        self.sample_bmc_record = {
            "complaint_id": "BMC_TEST_001",
            "description": "Dangerous pothole crater on road near school gate",
            "complaint_category": "Potholes on Road",
            "department_assigned": "Roads / Public Works",
            "severity": "Critical",
            "ward_code": "Ward K/W",
            "ward_area": "Andheri West",
            "zone": "Zone 4",
            "ward_type": "Commercial",
            "population_density": 22000,
            "ward_slum_percentage": 25.5,
            "complaint_channel": "Mobile App",
            "has_photo_evidence": 1,
            "has_gps_location": 1,
            "media_attention": 0,
            "politically_sensitive": 0,
            "complainant_type": "Citizen",
            "property_type": "Public Road",
            "repeat_complainant": 0,
            "prior_complaints_count": 1,
            "is_monsoon_season": 1,
            "complaint_time_of_day": "Morning",
            "complaint_date": "2024-07-15",
            "year": 2024,
            "month": 7,
            "resolution_days": 3,
            "num_reassignments": 1,
            "complaint_status": "Resolved",
            "contractor_category": "Class A",
            "work_quality_rating": 4.5,
            "site_inspected": 1,
            "defect_liability_claim": 0,
            "estimated_cost_inr": 15000,
            "infrastructure_age_years": 8,
            "months_since_last_maintained": 6,
            "regional_labor_shortage": 0.05,
            "local_unemployment_rate": 0.06,
            "citizen_satisfied": 1
        }

    def test_schema_cleaning_and_normalization(self):
        """Verifies clean_bmc_dataframe creates canonical categories and parses types."""
        df = pd.DataFrame([self.sample_bmc_record])
        cleaned = clean_bmc_dataframe(df)

        self.assertIn("canonical_category", cleaned.columns)
        self.assertEqual(cleaned["canonical_category"].iloc[0], "ROADS_POTHOLES")
        self.assertIn("canonical_severity", cleaned.columns)
        self.assertEqual(cleaned["canonical_severity"].iloc[0], "CRITICAL")
        self.assertTrue(pd.api.types.is_datetime64_any_dtype(cleaned["complaint_date"]))

    def test_null_handling(self):
        """Verifies robust handling of missing fields and empty descriptions."""
        dirty_record = {
            "complaint_id": "BMC_NULL_01",
            "description": None,
            "complaint_category": None,
            "severity": None,
            "complaint_date": "invalid-date"
        }
        df = pd.DataFrame([dirty_record])
        cleaned = clean_bmc_dataframe(df)

        self.assertEqual(cleaned["canonical_category"].iloc[0], "OTHER")
        self.assertEqual(cleaned["canonical_severity"].iloc[0], "MEDIUM")
        self.assertTrue(len(cleaned["description"].iloc[0]) > 0)
        self.assertTrue(pd.isna(cleaned["complaint_date"].iloc[0]))

    def test_category_normalization_all_canonical(self):
        """Verifies mapping coverage into 15 canonical categories."""
        test_cases = [
            ("Potholes on Road", "ROADS_POTHOLES"),
            ("Garbage Not Cleared", "GARBAGE_SOLID_WASTE"),
            ("Waterlogging / Flooding", "DRAINAGE_FLOODING"),
            ("Street Light Not Working", "STREETLIGHT"),
            ("Water Main Burst", "WATER_LEAKAGE"),
            ("Sewer Overflow", "SEWERAGE"),
            ("Stray Dog Menace", "STRAY_ANIMAL"),
            ("Mosquito Breeding Site", "PUBLIC_HEALTH"),
            ("Dangerous Tree Falling", "TREE_HAZARD"),
            ("Footpath Encroachment", "ENCROACHMENT")
        ]
        for text, expected in test_cases:
            cat = normalize_category(text, source="bmc")
            self.assertEqual(cat, expected, f"Failed mapping for '{text}': got {cat}, expected {expected}")

    def test_anti_leakage_feature_isolation(self):
        """CRITICAL: Verifies zero post-resolution fields are present in real-time feature set."""
        df = pd.DataFrame([self.sample_bmc_record])
        cleaned = clean_bmc_dataframe(df)
        realtime_df, post_res_df = split_realtime_and_post_resolution(cleaned)

        for post_field in POST_RESOLUTION_FIELDS:
            self.assertNotIn(
                post_field,
                realtime_df.columns,
                f"DATA LEAKAGE DETECTED: Post-resolution field '{post_field}' found in real-time features!"
            )

    def test_coordinate_haversine_validation(self):
        """Verifies geographic distance and proximity decay functions."""
        # Nariman Point to Bandra Station (~14-16 km)
        lat1, lon1 = 18.9256, 72.8242
        lat2, lon2 = 19.0544, 72.8402

        dist = haversine_distance_meters(lat1, lon1, lat2, lon2)
        self.assertAlmostEqual(dist, 14300, delta=2000)

        # Same location should have 0 distance and 1.0 similarity
        same_dist = haversine_distance_meters(lat1, lon1, lat1, lon1)
        self.assertEqual(same_dist, 0.0)

        sim = calculate_geographic_similarity(same_dist, max_distance_threshold=300.0)
        self.assertEqual(sim, 1.0)


if __name__ == "__main__":
    unittest.main()
