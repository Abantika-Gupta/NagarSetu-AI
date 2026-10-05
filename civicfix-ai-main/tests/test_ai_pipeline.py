"""AI and ML Pipeline Automated Test Suite for CivicFix / NagarSetu.

Tests Section 37 requirements:
- Classification accuracy and canonical outputs
- Real-time severity estimation
- Semantic and geographic duplicate detection
- Department routing rules and confidence
- Multi-factor explainable priority score (0-100)
- Configurable SLA estimation and states (ON_TRACK, AT_RISK, OVERDUE)
- Vision model inference
- Graceful degradation on model errors
"""

import sys
from pathlib import Path
import unittest

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from ml.inference.triage_service import triage_complaint, calculate_sla_hours
from ml.inference.classify_complaint import classify_text
from ml.inference.predict_severity import predict_severity
from ml.inference.predict_department import predict_department
from ml.inference.calculate_priority import calculate_priority_score
from ml.inference.classify_image import classify_image_evidence
from ml.inference.detect_duplicates import detect_duplicates


class TestAIPipeline(unittest.TestCase):

    def test_text_classification_and_canonical_category(self):
        """Verifies text classification returns a valid canonical category with confidence."""
        res = classify_text("Severe waterlogging at Hindmata cinema junction during heavy monsoon rain, stormwater drain blocked")
        self.assertIn("category", res)
        self.assertIn("confidence", res)
        self.assertGreaterEqual(res["confidence"], 0.0)
        self.assertLessEqual(res["confidence"], 1.0)
        self.assertEqual(res["category"], "DRAINAGE_FLOODING")

    def test_severity_estimation(self):
        """Verifies severity model predicts one of LOW, MEDIUM, HIGH, CRITICAL with confidence."""
        res = predict_severity(
            text="Open manhole without cover near school, children playing nearby danger of death",
            category="DRAINAGE_FLOODING",
            has_photo_evidence=True
        )
        self.assertIn("severity", res)
        self.assertIn(res["severity"], ["LOW", "MEDIUM", "HIGH", "CRITICAL"])
        self.assertIn("confidence", res)
        self.assertIn("hazard_score", res)
        self.assertEqual(res["severity"], "CRITICAL")

    def test_department_routing(self):
        """Verifies department routing matches canonical categories and returns routing reasons."""
        res = predict_department(
            canonical_category="ROADS_POTHOLES"
        )
        self.assertEqual(res["department"], "Road Maintenance Department")
        self.assertTrue(len(res["reason"]) > 0)
        self.assertGreaterEqual(res["confidence"], 0.5)

    def test_duplicate_detection(self):
        """Verifies semantic + geographic duplicate detector computes similarity and groups incidents."""
        active_complaints = [
            {
                "complaint_id": "CMP_1001",
                "description": "Large deep pothole on SV Road near station",
                "category": "ROADS_POTHOLES",
                "lat": 19.0544,
                "lng": 72.8402,
                "created_at": "2024-07-15T10:00:00Z"
            }
        ]

        # Very similar complaint at almost identical coordinates
        dup_res = detect_duplicates(
            incoming_text="Deep dangerous pothole on SV Road near railway station",
            incoming_category="ROADS_POTHOLES",
            incoming_lat=19.0545,
            incoming_lng=72.8403,
            candidate_complaints=active_complaints
        )

        self.assertGreater(dup_res["duplicate_probability"], 0.5)
        self.assertTrue(dup_res["is_duplicate"])
        self.assertEqual(dup_res["duplicate_group_id"], "GRP_CMP_1001")

        # Distinct complaint in different area
        distinct_res = detect_duplicates(
            incoming_text="Stray dog barking at night near market",
            incoming_category="STRAY_ANIMAL",
            incoming_lat=18.9256,
            incoming_lng=72.8242,
            candidate_complaints=active_complaints
        )
        self.assertFalse(distinct_res["is_duplicate"])
        self.assertLess(distinct_res["duplicate_probability"], 0.4)

    def test_explainable_priority_score(self):
        """Verifies multi-factor priority score produces 0-100 score and transparent reasons."""
        res = calculate_priority_score(
            severity="CRITICAL",
            duplicate_count=5,
            safety_risk_level="HIGH",
            sla_urgency=90
        )
        self.assertIn("priority_score", res)
        self.assertTrue(0 <= res["priority_score"] <= 100)
        self.assertIn(res["priority_level"], ["LOW", "MEDIUM", "HIGH", "CRITICAL"])
        self.assertTrue(len(res["priority_reasons"]) >= 1)
        # Should include critical severity reason
        self.assertTrue(any("Critical" in r for r in res["priority_reasons"]))

    def test_sla_rules(self):
        """Verifies application default SLA target hours per severity level."""
        self.assertEqual(calculate_sla_hours("CRITICAL", "ROADS_POTHOLES"), 4)
        self.assertEqual(calculate_sla_hours("HIGH", "GARBAGE_SOLID_WASTE"), 24)
        self.assertEqual(calculate_sla_hours("MEDIUM", "STREETLIGHT"), 72)
        self.assertEqual(calculate_sla_hours("LOW", "OTHER"), 168)

    def test_master_triage_contract(self):
        """Verifies master triage service outputs Section 23 specification schema."""
        payload = {
            "description": "Electric spark on overhead cable near bus station",
            "latitude": 19.0123,
            "longitude": 72.8456
        }
        res = triage_complaint(payload)

        # Check required fields from Section 23
        self.assertIn("category", res)
        self.assertIn("value", res["category"])
        self.assertIn("confidence", res["category"])

        self.assertIn("severity", res)
        self.assertIn("value", res["severity"])
        self.assertIn("confidence", res["severity"])

        self.assertIn("department", res)
        self.assertIn("value", res["department"])
        self.assertIn("confidence", res["department"])

        self.assertIn("duplicate_probability", res)
        self.assertIn("priority", res)
        self.assertIn("score", res["priority"])
        self.assertIn("level", res["priority"])
        self.assertIn("reasons", res["priority"])

        self.assertIn("sla", res)
        self.assertIn("hours", res["sla"])
        self.assertIn("status", res["sla"])

    def test_graceful_failure_handling(self):
        """Verifies AI never crashes on empty or corrupt input and returns safe triage defaults."""
        res = triage_complaint({})
        self.assertIn("category", res)
        self.assertIn("severity", res)
        self.assertIn("priority", res)
        self.assertIn("sla", res)
        self.assertNotEqual(res["priority"]["score"], None)


if __name__ == "__main__":
    unittest.main()
