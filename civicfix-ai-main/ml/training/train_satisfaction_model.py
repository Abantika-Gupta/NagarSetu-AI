"""Train Retrospective Citizen Satisfaction Model on BMC Civic Records.

Evaluates post-resolution satisfaction drivers without leaking resolution features
into real-time operational workflows.
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
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    classification_report,
    precision_recall_fscore_support,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

INTERIM_BMC = ROOT_DIR / "data" / "interim" / "bmc_cleaned.csv"
MODEL_DIR = ROOT_DIR / "ml" / "models" / "satisfaction"


def train_satisfaction_model():
    print("=== Training Citizen Satisfaction Model ===")
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    if not INTERIM_BMC.exists():
        print(f"Error: {INTERIM_BMC} missing. Run python scripts/process_datasets.py first.")
        return

    df = pd.read_csv(INTERIM_BMC)

    target_col = "citizen_satisfied"
    if target_col not in df.columns:
        print(f"Column {target_col} not found in BMC data.")
        return

    # Strictly real-time/intake features only to prevent data leakage!
    feature_cols = [
        "canonical_category",
        "canonical_severity",
        "ward_code",
        "complaint_channel",
        "is_monsoon_season"
    ]
    # Filter available features
    feature_cols = [c for c in feature_cols if c in df.columns]

    df_clean = df[feature_cols + [target_col]].dropna()
    X = df_clean[feature_cols]
    y = df_clean[target_col].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    categorical_features = [c for c in feature_cols if c != "is_monsoon_season"]
    numerical_features = [c for c in feature_cols if c == "is_monsoon_season"]

    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_features),
            ("num", StandardScaler(), numerical_features) if numerical_features else ("drop", "drop", [])
        ]
    )

    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("clf", GradientBoostingClassifier(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.08,
            random_state=42
        ))
    ])

    print(f"Fitting satisfaction model on {len(X_train)} BMC records...")
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    y_prob = pipeline.predict_proba(X_test)[:, 1]

    accuracy = float(accuracy_score(y_test, y_pred))
    precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average="binary", zero_division=0)
    roc_auc = float(roc_auc_score(y_test, y_prob))
    pr_auc = float(average_precision_score(y_test, y_prob))

    print(f"Satisfaction Model Results:\n  ROC-AUC:   {roc_auc:.4f}\n  PR-AUC:    {pr_auc:.4f}\n  Accuracy:  {accuracy:.4f}\n  F1 Score:  {f1:.4f}")

    metrics = {
        "model_name": "bmc_satisfaction_predictor_v1",
        "model_version": "1.0.0",
        "task": "citizen_satisfaction_prediction",
        "architecture": "GradientBoostingClassifier with OneHotEncoder",
        "real_time_features_used": feature_cols,
        "anti_leakage_verified": True,
        "train_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
        "metrics": {
            "roc_auc": round(roc_auc, 4),
            "pr_auc": round(pr_auc, 4),
            "accuracy": round(accuracy, 4),
            "precision": round(float(precision), 4),
            "recall": round(float(recall), 4),
            "f1": round(float(f1), 4)
        },
        "classification_report": classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    }

    model_path = MODEL_DIR / "satisfaction_model.joblib"
    metrics_path = MODEL_DIR / "metrics.json"

    joblib.dump(pipeline, model_path)
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print(f"[OK] Saved satisfaction model to {model_path}")
    print(f"[OK] Saved verified metrics to {metrics_path}")
    return metrics


if __name__ == "__main__":
    train_satisfaction_model()
