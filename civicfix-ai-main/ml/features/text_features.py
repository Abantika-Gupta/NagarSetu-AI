"""Text feature extraction for Indian civic grievance processing.

Handles English, Hindi, Bengali (transliterated/script), and Hinglish civic phrasing.
Extracts n-grams, urgency indicators, and keyword densities.
"""

import re
from typing import Dict, List, Set, Tuple

# Pre-compiled safety and urgency indicator patterns
CRITICAL_INDICATORS: Set[str] = {
    "shock", "current", "open wire", "live wire", "sparking", "short circuit",
    "electric hazard", "open manhole", "manhole khula", "chamber open",
    "collapse", "building collapse", "falling", "accident", "fatal", "death risk",
    "hospital", "near hospital", "ambulance", "school", "near school", "children",
    "fire", "gas leak", "pipe burst", "wall collapse", "danger to life",
    "jeevan khatre mein", "bipodjonok"
}

HIGH_RISK_INDICATORS: Set[str] = {
    "waterlogging", "submerged", "paani bhar gaya", "jalabaddha", "deep pothole",
    "bada gaddha", "road cave-in", "traffic jam", "main road", "highway",
    "sewer overflow", "gutter", "dengue", "malaria", "mosquito breeding",
    "dark road", "andhera", "no light", "broken pole", "fallen branch",
    "dangerous branch", "stray dog bite", "rabies", "dead animal"
}

MEDIUM_RISK_INDICATORS: Set[str] = {
    "garbage", "dustbin", "kachra", "moyla", "waste", "trash", "bad smell",
    "stench", "dirty", "leakage", "pipe leak", "low pressure", "footpath",
    "hawker", "encroachment", "pothole", "broken pavement"
}


def clean_civic_text(text: str) -> str:
    """Cleans natural language civic complaint text while preserving multilingual tokens."""
    if not text:
        return ""
    # Normalize whitespaces and lowercase
    cleaned = str(text).strip().lower()
    # Replace disruptive punctuation with single space
    cleaned = re.sub(r"[^\w\s\u0900-\u097F\u0980-\u09FF]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def extract_urgency_indicators(text: str) -> Dict[str, any]:
    """Analyzes text against safety and urgency hazard vocabularies."""
    cleaned = clean_civic_text(text)
    words = set(cleaned.split())

    critical_matches = [ind for ind in CRITICAL_INDICATORS if ind in cleaned]
    high_matches = [ind for ind in HIGH_RISK_INDICATORS if ind in cleaned]
    medium_matches = [ind for ind in MEDIUM_RISK_INDICATORS if ind in cleaned]

    safety_risk_level = "LOW"
    if critical_matches:
        safety_risk_level = "CRITICAL"
    elif high_matches:
        safety_risk_level = "HIGH"
    elif medium_matches:
        safety_risk_level = "MEDIUM"

    return {
        "critical_matches": critical_matches,
        "high_matches": high_matches,
        "medium_matches": medium_matches,
        "safety_risk_level": safety_risk_level,
        "hazard_score": min(100, len(critical_matches) * 35 + len(high_matches) * 20 + len(medium_matches) * 8),
    }
