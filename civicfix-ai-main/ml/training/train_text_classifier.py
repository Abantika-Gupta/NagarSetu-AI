"""Train TF-IDF + Logistic Regression Civic Complaint Classifier.

Trains reproducible category classifier using processed civic text records.
Evaluates accuracy, precision, recall, F1 score, and saves serialized pipeline.
"""

import json
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, accuracy_score, precision_recall_fscore_support
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from ml.features.text_features import clean_civic_text
PROCESSED_FILE = ROOT_DIR / "data" / "processed" / "complaint_text.csv"
MODEL_DIR = ROOT_DIR / "ml" / "models" / "text"


def train_text_classifier():
    print("=== Training Text Classifier ===")
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    if not PROCESSED_FILE.exists():
        print(f"Error: {PROCESSED_FILE} missing. Run python scripts/process_datasets.py first.")
        return

    df = pd.read_csv(PROCESSED_FILE)
    df["clean_text"] = df["description"].fillna("").apply(clean_civic_text)
    df = df[df["clean_text"].str.len() > 3]

    X = df["clean_text"]
    y = df["category"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y if y.nunique() > 1 else None
    )

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            ngram_range=(1, 2),
            max_features=10000,
            sublinear_tf=True
        )),
        ("clf", LogisticRegression(
            C=1.5,
            max_iter=1000,
            random_state=42
        ))
    ])

    print(f"Fitting pipeline on {len(X_train)} samples across {y.nunique()} categories...")
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)

    accuracy = float(accuracy_score(y_test, y_pred))
    precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average="weighted", zero_division=0)

    print(f"Text Classification Results:\n  Accuracy:  {accuracy:.4f}\n  Precision: {precision:.4f}\n  Recall:    {recall:.4f}\n  F1 Score:  {f1:.4f}")

    metrics = {
        "model_name": "civic_text_classifier_v1",
        "model_version": "1.0.0",
        "task": "category_classification",
        "architecture": "TfidfVectorizer + LogisticRegression",
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

    model_path = MODEL_DIR / "complaint_classifier.joblib"
    metrics_path = MODEL_DIR / "metrics.json"

    joblib.dump(pipeline, model_path)
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print(f"[OK] Saved text model to {model_path}")
    print(f"[OK] Saved verified metrics to {metrics_path}")
    return metrics


if __name__ == "__main__":
    train_text_classifier()
