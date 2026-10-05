"""Temporal feature engineering for civic complaints.

Derives monsoon seasonality, time of day risk, weekend flags, and SLA urgency.
"""

from datetime import datetime
from typing import Dict, Optional


def extract_temporal_features(dt: Optional[datetime] = None) -> Dict[str, any]:
    """Extracts seasonality, monsoon indicators, and operational timing features."""
    if dt is None:
        dt = datetime.now()

    month = dt.month
    hour = dt.hour
    weekday = dt.weekday()

    # Mumbai / Indian Monsoon season is typically June (6) to September (9)
    is_monsoon = month in (6, 7, 8, 9)

    # Time of day risk (night issues e.g. dark streets or open manholes carry elevated risk)
    is_night = hour < 6 or hour >= 20

    time_of_day = "morning"
    if 6 <= hour < 12:
        time_of_day = "morning"
    elif 12 <= hour < 17:
        time_of_day = "afternoon"
    elif 17 <= hour < 21:
        time_of_day = "evening"
    else:
        time_of_day = "night"

    return {
        "hour": hour,
        "month": month,
        "is_monsoon_season": is_monsoon,
        "is_night": is_night,
        "time_of_day": time_of_day,
        "is_weekend": weekday >= 5,
    }
