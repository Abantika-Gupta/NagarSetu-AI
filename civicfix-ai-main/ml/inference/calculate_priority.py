"""Explainable Multi-Factor Priority Scoring Engine.

Conforms strictly to Section 16:
- Weighted factors:
  * 30% Severity
  * 20% Location Importance / Affected Population Proxy
  * 15% Duplicate Volume
  * 15% Safety Risk
  * 10% SLA Urgency
  * 10% Historical Recurrence
- NEVER uses politically_sensitive to alter score.
- Returns explicit, human-readable priority reasons.
"""

from typing import Dict, List, Optional


def calculate_priority_score(
    severity: str,
    location_importance: int = 40,
    duplicate_count: int = 0,
    safety_risk_level: str = "LOW",
    sla_urgency: int = 50,
    historical_recurrence: int = 0,
    has_photo_evidence: bool = False,
    is_monsoon_season: bool = False,
    near_institution: bool = False,
    weights=None
) -> Dict[str, any]:
    """Calculates explainable priority score (0-100), level, and human-readable reasons."""
    if weights is None:
        weights = {
            "severity": 0.30,
            "population_location": 0.20,
            "duplicate_volume": 0.15,
            "safety_risk": 0.15,
            "sla_urgency": 0.10,
            "recurrence": 0.10,
        }

    # 1. Severity sub-score (0-100)
    sev_map = {"LOW": 25, "MEDIUM": 50, "HIGH": 75, "CRITICAL": 98,
               "Low": 25, "Medium": 50, "High": 75, "Critical": 98}
    sev_score = sev_map.get(severity, 50)

    # 2. Location / Population sub-score (0-100)
    loc_score = min(100, max(20, location_importance))

    # 3. Duplicate volume sub-score (0-100)
    # 0 dups = 20, 1-3 = 50, 4-10 = 75, 10+ = 100
    if duplicate_count >= 10:
        dup_score = 100
    elif duplicate_count >= 4:
        dup_score = 75
    elif duplicate_count >= 1:
        dup_score = 50
    else:
        dup_score = 20

    # 4. Safety risk sub-score (0-100)
    safety_map = {"LOW": 20, "MEDIUM": 50, "HIGH": 80, "CRITICAL": 100,
                  "Low": 20, "Medium": 50, "High": 80, "Critical": 100}
    safe_score = safety_map.get(safety_risk_level, 30)

    # 5. SLA urgency sub-score (0-100)
    sla_score = min(100, max(20, sla_urgency))

    # 6. Recurrence sub-score (0-100)
    rec_score = min(100, 20 + (historical_recurrence * 20))

    # Weighted calculation
    final_score = (
        (sev_score * weights["severity"]) +
        (loc_score * weights["population_location"]) +
        (dup_score * weights["duplicate_volume"]) +
        (safe_score * weights["safety_risk"]) +
        (sla_score * weights["sla_urgency"]) +
        (rec_score * weights["recurrence"])
    )

    final_score = int(round(max(0, min(100, final_score))))

    # Determine priority level
    if final_score >= 85:
        level = "CRITICAL"
    elif final_score >= 70:
        level = "HIGH"
    elif final_score >= 45:
        level = "MEDIUM"
    else:
        level = "LOW"

    # Compile human-readable explainable reasons
    reasons: List[str] = []

    if severity in ("CRITICAL", "Critical"):
        reasons.append("Critical severity: immediate civic hazard reported")
    elif severity in ("HIGH", "High"):
        reasons.append("High severity civic infrastructure disruption")

    if safety_risk_level in ("CRITICAL", "Critical"):
        reasons.append("High safety risk: life hazard or public danger indicators present")
    elif safety_risk_level in ("HIGH", "High"):
        reasons.append("Moderate safety risk identified in description")

    if duplicate_count > 0:
        reasons.append(f"{duplicate_count} similar citizen complaint{'s' if duplicate_count > 1 else ''} clustered nearby")

    if near_institution:
        reasons.append("Located in vicinity of school, hospital, transit node, or major arterial route")

    if has_photo_evidence:
        reasons.append("Citizen attached photographic evidence verifying on-site condition")

    if is_monsoon_season:
        reasons.append("Monsoon season elevated flood and waterlogging response urgency")

    if not reasons:
        reasons.append("Standard priority triage based on reported civic category")

    return {
        "priority_score": final_score,
        "priority_level": level,
        "priority_reasons": reasons,
        "sub_scores": {
            "severity": sev_score,
            "location_importance": loc_score,
            "duplicate_volume": dup_score,
            "safety_risk": safe_score,
            "sla_urgency": sla_score,
            "recurrence": rec_score
        }
    }
