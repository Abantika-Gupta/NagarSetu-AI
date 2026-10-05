"""Master Model Training & Evaluation Orchestrator for CivicFix / NagarSetu.

Executes reproducible training pipelines and generates evaluation artifacts
for text classification, severity estimation, duplicate detection,
citizen satisfaction, and vision classification.
"""

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from ml.training.train_text_classifier import train_text_classifier
from ml.training.train_severity_model import train_severity_model
from ml.training.train_duplicate_model import train_duplicate_model
from ml.training.train_satisfaction_model import train_satisfaction_model
from ml.training.train_image_model import train_image_model


def train_all_models():
    print("==================================================")
    print("  CivicFix / NagarSetu: Training All AI/ML Models ")
    print("==================================================")

    results = {}

    print("\n[1/5] Training Text Category Classifier...")
    results["text"] = train_text_classifier()

    print("\n[2/5] Training Real-Time Severity Model...")
    results["severity"] = train_severity_model()

    print("\n[3/5] Evaluating Duplicate Detection Engine...")
    results["duplicate"] = train_duplicate_model()

    print("\n[4/5] Training Retrospective Satisfaction Model...")
    results["satisfaction"] = train_satisfaction_model()

    print("\n[5/5] Training Civic Vision Model...")
    results["vision"] = train_image_model()

    print("\n==================================================")
    print("  All Models Trained & Evaluated Successfully!    ")
    print("==================================================")
    return results


if __name__ == "__main__":
    train_all_models()
