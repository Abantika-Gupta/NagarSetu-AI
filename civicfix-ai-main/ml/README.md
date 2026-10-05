# CivicFix / NagarSetu — AI & Machine Learning Architecture

This directory contains the machine learning pipelines, feature engineering modules, training scripts, evaluation benchmarks, and inference services for the NagarSetu (CivicFix) civic grievance platform.

---

## 1. Architecture Overview

```
                                  [ Citizen Submission ]
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
               [ Complaint Text ]                          [ Evidence Image ]
                       │                                           │
                       ▼                                           ▼
            [ TF-IDF + Logistic Reg ]                  [ Lightweight Vision Model ]
            Category & Hazard Tokens                   Pothole / Garbage / Road
                       │                                           │
                       └─────────────────────┬─────────────────────┘
                                             ▼
                                 [ Real-Time Civic Triage ]
                                             │
         ┌───────────────────────────────────┼───────────────────────────────────┐
         ▼                                   ▼                                   ▼
 [ 15 Canonical Categories ]        [ Severity Classifier ]           [ Department Router ]
 ROADS_POTHOLES, GARBAGE, ...       LOW / MEDIUM / HIGH / CRITICAL     Deterministic + ML
         │                                   │                                   │
         └───────────────────────────────────┼───────────────────────────────────┘
                                             ▼
                             [ Duplicate Detection Engine ]
                             Text + Geo (Haversine) + Time
                                             │
                                             ▼
                             [ Explainable Priority Engine ]
                             30% Sev + 20% Loc + 15% Dup +
                             15% Risk + 10% SLA + 10% Recur
                                             │
                                             ▼
                                    [ Dynamic SLA Engine ]
                                    CRITICAL: 4h | HIGH: 24h
                                    MEDIUM: 72h  | LOW: 168h
                                             │
                                             ▼
                                   [ NagarSetu MERN App ]
```

---

## 2. Directory Structure

```
ml/
├── README.md                          # This documentation
├── config/
│   ├── categories.yaml                # 15 canonical categories & keywords
│   ├── departments.yaml               # Department routing matrices & explanations
│   ├── sla.yaml                       # Configurable SLA target hours & thresholds
│   └── model_config.yaml              # Reproducibility seed & hyperparameters
├── preprocessing/
│   ├── clean_bmc.py                   # BMC data cleaner with anti-leakage isolation
│   ├── clean_nyc.py                   # NYC 311 benchmark data cleaner
│   ├── normalize_categories.py        # Category normalization & mapping layer
│   └── normalize_locations.py         # Haversine distance & spatial proximity decay
├── features/
│   ├── text_features.py               # Linguistic cleaner & hazard token extractor
│   ├── geo_features.py                # Location importance & institutional density
│   ├── temporal_features.py           # Monsoon, diurnal, and temporal features
│   └── civic_features.py              # Composite civic features
├── training/
│   ├── train_text_classifier.py       # TF-IDF + LogisticRegression category model
│   ├── train_severity_model.py        # Real-time multi-class severity model
│   ├── train_duplicate_model.py       # Multi-modal duplicate detector evaluator
│   ├── train_satisfaction_model.py    # Retrospective citizen satisfaction model
│   └── train_image_model.py           # Computer vision image classifier
├── inference/
│   ├── classify_complaint.py          # Category inference with confidence
│   ├── predict_severity.py            # Severity inference with hazard score
│   ├── predict_department.py          # Department routing with reason
│   ├── detect_duplicates.py           # Duplicate detection and clustering
│   ├── calculate_priority.py          # Explainable 0-100 priority calculator
│   ├── classify_image.py              # Photo evidence validation
│   └── triage_service.py              # Unified master triage service
└── models/
    ├── text/ (complaint_classifier.joblib, metrics.json)
    ├── severity/ (severity_model.joblib, metrics.json)
    ├── duplicate/ (duplicate_tfidf.joblib, metrics.json)
    ├── satisfaction/ (satisfaction_model.joblib, metrics.json)
    └── vision/ (vision_classifier.joblib, metrics.json)
```

---

## 3. Anti-Leakage Feature Quarantine

The Kaggle Mumbai BMC dataset contains both intake and post-resolution fields. NagarSetu enforces strict architectural separation:

- **Real-Time Features (Allowed for Intake Predictions)**:
  `description`, `category`, `ward_code`, `zone`, `complaint_channel`, `has_photo_evidence`, `has_gps_location`, `is_monsoon_season`, `complaint_time_of_day`, `duplicate_count`, `hazard_score`.
- **Post-Resolution Features (STRICTLY QUARANTINED from Real-Time Triage)**:
  `resolution_days`, `complaint_status`, `work_quality_rating`, `num_reassignments`, `site_inspected`, `defect_liability_claim`, `estimated_cost_inr`, `infrastructure_age_years`, `months_since_last_maintained`, `citizen_satisfied`.

Quarantined fields are isolated in `data/interim/` and used exclusively for retrospective analytics.

---

## 4. Training Commands

All training scripts are reproducible and log verified metrics to `ml/models/<model>/metrics.json`:

```bash
# Process raw benchmark datasets into normalized parquet/csv files
python scripts/process_datasets.py

# Train all models sequentially
python scripts/train_models.py

# Or train individually:
python ml/training/train_text_classifier.py
python ml/training/train_severity_model.py
python ml/training/train_duplicate_model.py
python ml/training/train_satisfaction_model.py
python ml/training/train_image_model.py
```

---

## 5. Evaluation Metrics (Obtained)

All metrics are computed on held-out 20% test splits:

| Model | Architecture | Primary Metric | Result |
|---|---|---|---|
| Text Category Classifier | TF-IDF + Logistic Regression | Accuracy / F1 | 1.000 / 1.000 |
| Severity Classifier | Feature Union + Random Forest | Accuracy / F1 | 0.245 / 0.217 |
| Duplicate Detection | Multi-modal TF-IDF + Haversine | ROC-AUC | 0.938 |
| Retrospective Satisfaction | Gradient Boosting Classifier | ROC-AUC / PR-AUC | 0.491 / 0.697 |
| Vision Classifier | Lightweight Color/Texture Features | Accuracy / F1 | 1.000 / 1.000 |

*Detailed metrics and confusion matrices are persisted under each `ml/models/*/metrics.json`.*

---

## 6. Real-Time Inference Interface

Run master triage directly via CLI or standard input:

```bash
# Via Python direct import
python -c "from ml.inference.triage_service import triage_complaint; print(triage_complaint({'description': 'Deep pothole on SV road causing accidents', 'latitude': 19.054, 'longitude': 72.840}))"

# Via Standard Input
echo '{"description": "Open manhole near school", "latitude": 19.01, "longitude": 72.84}' | python ml/inference/triage_service.py
```

Output format conforms strictly to Section 23 of the specification:
```json
{
  "category": { "value": "DRAINAGE_FLOODING", "confidence": 0.95 },
  "severity": { "value": "CRITICAL", "confidence": 0.95, "hazard_score": 85 },
  "department": { "value": "Drainage Department", "confidence": 0.60, "reason": "Stormwater drainage, flooding, or runoff blockage detected" },
  "duplicate_probability": 0.0,
  "is_duplicate": false,
  "duplicate_group_id": null,
  "priority": {
    "score": 62,
    "level": "MEDIUM",
    "reasons": [
      "Critical severity: immediate civic hazard reported",
      "High safety risk: life hazard or public danger indicators present"
    ]
  },
  "sla": { "hours": 4, "status": "ON_TRACK" },
  "model_version": "1.0.0"
}
```
