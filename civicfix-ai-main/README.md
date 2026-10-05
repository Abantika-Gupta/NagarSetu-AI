<div align="center">

<!-- Animated Top Banner -->
<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=900&size=34&duration=2500&pause=700&color=2563EB&center=true&vCenter=true&width=950&lines=CivicFix+%2F+NagarSetu+%F0%9F%9A%80;Connecting+Citizens.+Solving+Cities.;AI+Triage+%7C+Mumbai+BMC+%2B+NYC+311+%7C+Real-Time+SLA;MERN+%2B+Python+ML+Intelligence" alt="NagarSetu Animated Header" />

<br />

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:2563EB,50:06B6D4,100:22C55E&height=180&section=header&text=NagarSetu&fontSize=55&fontColor=ffffff&animation=fadeIn&fontAlignY=35&desc=Connecting%20Citizens.%20Solving%20Cities.&descAlignY=58&descSize=18" />

<br />

<p>
  <img src="https://img.shields.io/badge/Project-CivicFix%20%2F%20NagarSetu-2563EB?style=for-the-badge&logo=googlemaps&logoColor=white" />
  <img src="https://img.shields.io/badge/Stack-MERN%20%2B%20Python%20ML-22C55E?style=for-the-badge&logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/Status-AI%20Upgraded-06B6D4?style=for-the-badge&logo=rocket&logoColor=white" />
  <img src="https://img.shields.io/badge/Tests-18%2F18%20Passing-10B981?style=for-the-badge&logo=checkmarx&logoColor=white" />
</p>

<p>
  <img src="https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Backend-Node%20%2B%20Express-111827?style=flat-square&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Database-MongoDB%20v8-47A248?style=flat-square&logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/ML%20Engine-Scikit--Learn-F7931E?style=flat-square&logo=scikit-learn&logoColor=white" />
  <img src="https://img.shields.io/badge/Datasets-Mumbai%20BMC%20%2B%20NYC%20311-8E75C4?style=flat-square&logo=kaggle&logoColor=white" />
  <img src="https://img.shields.io/badge/Images-Cloudinary-3448C5?style=flat-square&logo=cloudinary&logoColor=white" />
</p>

<h3>🚀 Multi-Factor Explainable AI • Real-Time SLA Engine • Semantic & Spatial Duplicates • Mumbai BMC & NYC 311 Benchmarks</h3>

</div>

---

## 🏷️ Key Features & AI Capabilities

```txt
✅ 15 Canonical Civic Categories with confidence scores
✅ Real-time severity estimation (LOW, MEDIUM, HIGH, CRITICAL)
✅ Multi-modal duplicate detection (TF-IDF + Haversine 300m decay + temporal window)
✅ Explainable priority score (0-100) with human-readable civic impact reasons
✅ Dynamic SLA estimation (CRITICAL: 4h, HIGH: 24h, MEDIUM: 72h, LOW: 168h) & status tracking
✅ Multi-dataset architecture: Mumbai BMC (1.2M records) + NYC 311 + QR4Change Vision
✅ Strict Anti-Leakage Quarantine isolating post-resolution fields from intake triage
✅ Enhanced Admin Dashboard with KPI cards, Ward filtering, and SLA Overdue hotspot maps
✅ Graceful fallback & zero-crash guarantees for citizen complaint intake
✅ Full suite of 18 automated unit and integration tests passing
```

---

## 📌 Project Overview

**CivicFix (NagarSetu)** is an enterprise-grade AI-powered civic grievance management platform. It empowers citizens to report civic grievances (potholes, garbage, flooding, streetlights, hazardous trees, open manholes) with photo evidence and GPS coordinates, while automating municipal classification, severity estimation, spatial duplicate clustering, and explainable SLA tracking.

---

## 🏗️ Architecture

```
CITIZEN (Web / Mobile)
       │
       ▼
 [ Complaint Intake ]
 (Text, Location, Photo)
       │
       ▼
 [ Master AI Triage ] (Python child-process / In-Memory Heuristics)
  ├── 1. NLP Category Classifier (TF-IDF + Logistic Regression, 15 Canonical Classes)
  ├── 2. Severity Classifier (Real-Time Hazard & Context Model)
  ├── 3. Department Router (Deterministic Rules + Confidence Matrix)
  ├── 4. Semantic & Geographic Duplicate Detector (Cosine Sim + Haversine Radius)
  ├── 5. Explainable Priority Engine (Weighted Factors: 30% Sev, 20% Loc, 15% Dup, 15% Risk, 10% SLA, 10% Recur)
  └── 6. Dynamic SLA Engine (4h, 24h, 72h, 168h with ON_TRACK, AT_RISK, OVERDUE)
       │
       ▼
 [ Express v5 REST API ]
  ├── POST /api/ai/analyze-complaint (Real-time pre-submission analysis)
  ├── POST /api/complaints (Authenticated complaint intake & duplicate clustering)
  ├── GET /api/admin/complaints (Ward, department, severity, SLA filtering)
  └── GET /api/analytics/dashboard (KPI cards, SLA compliance, resolution trends)
       │
       ▼
 [ MongoDB Database ]
  ├── complaints (Normalized NagarSetu schema + compound indexes)
  ├── aipredictions (Audit trail & model versioning)
  ├── complaintslas (Dynamic SLA deadline tracking)
  └── modelversions (ML registry & benchmark metrics)
       │
       ▼
 [ React 19 Frontend ]
  ├── Citizen: Real-Time AI Score, Category Conf, Duplicate Alert, SLA estimate
  ├── Admin: KPI cards (Open, Critical, Overdue, Duplicates), Ward filters
  └── Public Heatmap: Urgency markers, SLA overdue hotspots, area zones
```

---

## 📊 Dataset Strategy & Governance

Detailed dataset governance and provenance documentation is located in [`data/DATASETS.md`](data/DATASETS.md):

1. **Primary Dataset: Mumbai Nagar Seva — BMC Civic Complaint Resolution Dataset (2018–2024)**
   - ~1.2M records across Mumbai's 24 administrative wards (A to T).
   - Used for category ontology, department routing, and retrospective citizen satisfaction modeling.
   - **Anti-Leakage Quarantine**: Fields like `resolution_days`, `complaint_status`, and `work_quality_rating` are strictly quarantined from real-time triage models.
2. **Secondary Dataset: NYC 311 Service Requests (2020–Present)**
   - Official Socrata Open Data API integration for cross-city benchmark evaluation.
3. **Computer Vision Dataset: QR4Change (Mendeley Data)**
   - 4,937 images for pothole, garbage, and plain road evidence verification.

---

## 🤖 Machine Learning Pipelines & Commands

Model specifications and evaluation reports are located in [`ml/README.md`](ml/README.md):

```bash
# 1. Ingest public datasets and benchmark partitions (does not run on server start)
python scripts/download_datasets.py

# 2. Clean and normalize datasets into interim and processed partitions
npm run process:data
# or: python scripts/process_datasets.py

# 3. Train all 5 models and record verified metrics
npm run train:models
# or: python scripts/train_models.py
```

### Verified Model Metrics:
- **Text Classifier**: `ml/models/text/complaint_classifier.joblib` — Accuracy: 1.00, F1: 1.00
- **Severity Classifier**: `ml/models/severity/severity_model.joblib` — Macro F1: 0.22, 4 classes
- **Duplicate Detector**: `ml/models/duplicate/duplicate_tfidf.joblib` — ROC-AUC: 0.938
- **Satisfaction Model**: `ml/models/satisfaction/satisfaction_model.joblib` — PR-AUC: 0.697, Accuracy: 0.645
- **Vision Classifier**: `ml/models/vision/vision_classifier.joblib` — Accuracy: 1.00, F1: 1.00

---

## 🧪 Testing

Run the full automated test suite covering dataset validation, anti-leakage isolation, AI triage, and backend security:

```bash
npm test
```

Or run individual test suites:
```bash
# Backend AI & upload security tests
node tests/test_backend_ai.js

# Dataset schema & anti-leakage quarantine tests
npm run test:data

# AI inference & triage tests
npm run test:ai
```

---

## 🚀 How to Run Locally

### 1. Prerequisites
- Node.js v20+ / v22+
- Python 3.10+ (with `scikit-learn`, `pandas`, `pyyaml`, `pillow`, `scipy`)
- MongoDB instance (local or MongoDB Atlas)

### 2. Setup Environment Variables
Copy `.env.example` in `backend/` and `frontend/`:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Key environment variables:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/civicfix
JWT_SECRET=your_jwt_secret
PYTHON_PATH=python
AI_CONFIDENCE_THRESHOLD=0.60
DUPLICATE_DISTANCE_METERS=300
DUPLICATE_TIME_WINDOW_HOURS=48
DEFAULT_CRITICAL_SLA_HOURS=4
DEFAULT_HIGH_SLA_HOURS=24
DEFAULT_MEDIUM_SLA_HOURS=72
DEFAULT_LOW_SLA_HOURS=168
```

### 3. Install Dependencies
```bash
npm run install-all
```

### 4. Build and Run Development Servers
```bash
# Terminal 1: Backend API (port 5000)
npm run dev:backend

# Terminal 2: Frontend App (port 5173)
npm run dev:frontend
```

---

## 📄 License
ISC © NagarSetu / CivicFix Team. Dataset rights belong to their respective originators (BMC Open Governance, NYC Open Data, Mendeley Data CC BY 4.0).
