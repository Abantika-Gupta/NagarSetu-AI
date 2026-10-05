"""Train Real-Time Civic Severity Estimation Model.

Predicts complaint severity (LOW, MEDIUM, HIGH, CRITICAL) using strictly
real-time inputs (hazard indicators, photo evidence, category, environmental conditions).
"""

import json
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import classification_report, accuracy_score, precision_recall_fscore_support
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from ml.features.text_features import clean_civic_text, extract_urgency_indicators
PROCESSED_FILE = ROOT_DIR / "data" / "processed" / "complaints.csv"
MODEL_DIR = ROOT_DIR / "ml" / "models" / "severity"


def train_severity_model():
    print("=== Training Severity Classifier ===")
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    if not PROCESSED_FILE.exists():
        print(f"Error: {PROCESSED_FILE} missing. Run python scripts/process_datasets.py first.")
        return

    df = pd.read_csv(PROCESSED_FILE)
    df["clean_text"] = df["description"].fillna("").apply(clean_civic_text)
    df["hazard_score"] = df["clean_text"].apply(lambda t: extract_urgency_indicators(t)["hazard_score"])
    df["is_monsoon_season"] = df["is_monsoon_season"].astype(int)

    feature_cols = ["clean_text", "category", "hazard_score", "is_monsoon_season"]
    X = df[feature_cols]
    y = df["severity"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y if y.nunique() > 1 else None
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("text", TfidfVectorizer(max_features=2500, ngram_range=(1, 2)), "clean_text"),
            ("cat", OneHotEncoder(handle_unknown="ignore"), ["category"]),
            ("num", StandardScaler(), ["hazard_score", "is_monsoon_season"])
        ]
    )

    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("clf", RandomForestClassifier(
            n_estimators=100,
            max_depth=12,
            random_state=42
        ))
    ])

    print(f"Fitting severity model on {len(X_train)} samples...")
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)

    accuracy = float(accuracy_score(y_test, y_pred))
    precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average="weighted", zero_division=0)

    print(f"Severity Classification Results:\n  Accuracy:  {accuracy:.4f}\n  Precision: {precision:.4f}\n  Recall:    {recall:.4f}\n  F1 Score:  {f1:.4f}")

    metrics = {
        "model_name": "civic_severity_classifier_v1",
        "model_version": "1.0.0",
        "task": "severity_estimation",
        "architecture": "RandomForestClassifier with ColumnTransformer (TF-IDF + Categorical + Numerical)",
        "train_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
        "metrics": {
            "accuracy": round(accuracy, 4),
            "precision": round(float(precision), 4),
            "recall": round(float(recall), 4),
            "f1": round(float(f1), 4)
        },
        "classes": list(pipeline.classes_),
        "classification_report": classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    }

    model_path = MODEL_DIR / "severity_model.joblib"
    metrics_path = MODEL_DIR / "metrics.json"

    joblib.dump(pipeline, model_path)
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print(f"[OK] Saved severity model to {model_path}")
    print(f"[OK] Saved verified metrics to {metrics_path}")
    return metrics


if __name__ == "__main__":
    train_severity_model()
