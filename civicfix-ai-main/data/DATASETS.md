# CivicFix / NagarSetu — Dataset Documentation & Governance

This document outlines all civic datasets integrated into the CivicFix (NagarSetu) AI platform, specifying their provenance, licenses, schema adaptations, anti-leakage boundaries, and preprocessing pipelines.

---

## 1. Primary Dataset: Mumbai Nagar Seva — BMC Civic Complaint Resolution Dataset (2018–2024)

- **Dataset Name**: Mumbai Nagar Seva — BMC Civic Complaint Resolution Dataset (2018–2024)
- **Source**: Kaggle Competition / Brihanmumbai Municipal Corporation (BMC) Open Governance Initiative
- **Official URL**: [https://www.kaggle.com/competitions/mumbai-nagar-seva-bmc-civic-complaint-resolution-2018-2024/data](https://www.kaggle.com/competitions/mumbai-nagar-seva-bmc-civic-complaint-resolution-2018-2024/data)
- **License**: Kaggle Competition Rules / Research & Civic Benchmarking Use
- **Record Volume**: ~1.2 Million complaint records across Mumbai's 24 administrative municipal wards (A to T).
- **Core Purpose**:
  - Primary benchmark for Indian municipal grievance workflows, department routing, severity calibration, and retrospective citizen satisfaction modeling.
- **Columns Retained**:
  - *Identity*: `complaint_id`
  - *Time*: `complaint_date`, `year`, `month`, `is_monsoon_season`, `complaint_time_of_day`
  - *Geography*: `ward_code`, `ward_area`, `zone`, `ward_type`, `population_density`, `ward_slum_percentage`
  - *Complaint*: `complaint_category`, `department_assigned`, `complaint_channel`, `severity`, `has_photo_evidence`, `has_gps_location`, `media_attention`, `politically_sensitive`
  - *Complainant / Context*: `complainant_type`, `property_type`, `repeat_complainant`, `prior_complaints_count`
  - *Macro*: `regional_labor_shortage`, `local_unemployment_rate`
  - *Retrospective Analytics / Post-Resolution*: `resolution_days`, `num_reassignments`, `complaint_status`, `contractor_category`, `work_quality_rating`, `site_inspected`, `defect_liability_claim`, `estimated_cost_inr`, `infrastructure_age_years`, `months_since_last_maintained`
  - *Target*: `citizen_satisfied`
- **Data Leakage Safeguards**:
  - `resolution_days`, `complaint_status`, `work_quality_rating`, `num_reassignments`, `site_inspected`, and `defect_liability_claim` are STRICTLY quarantined as **Post-Resolution Analytics Fields**. They are excluded from real-time classification, severity scoring, and SLA estimation models.
- **Privacy & Sensitivity**:
  - Complainant phone numbers, exact identities, or political sensitivity flags are never surfaced to public dashboards or citizen-facing endpoints.

---

## 2. Secondary Benchmark Dataset: NYC 311 Service Requests (2020–Present)

- **Dataset Name**: NYC 311 Service Requests from 2020 to Present
- **Source**: NYC Open Data / NYC Office of Technology and Innovation (OTI)
- **Official URL**: [https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2020-to-Present/erm2-nwe9](https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2020-to-Present/erm2-nwe9)
- **License**: NYC Open Data Terms of Use (Public Domain / Open Data)
- **Core Purpose**:
  - Secondary comparative benchmark for municipal request classification, category ontology verification, cross-city resolution-time patterns, and duplicate clustering.
- **Columns Retained**:
  - `unique_key`, `created_date`, `closed_date`, `agency`, `agency_name`, `complaint_type`, `descriptor`, `location_type`, `incident_zip`, `incident_address`, `street_name`, `borough`, `latitude`, `longitude`, `status`, `due_date`, `resolution_description`, `community_board`, `council_district`, `police_precinct`, `park_facility_name`, `park_borough`, `vehicle_type`
- **Normalization Layer**:
  - NYC 311 complaint types are mapped through `data/mappings/category_mapping.json` into canonical NagarSetu categories (e.g., `Street Condition` -> `ROADS_POTHOLES`, `Dirty Condition` -> `GARBAGE_SOLID_WASTE`).

---

## 3. Computer Vision Dataset: Urban Civic Issues Image Dataset (QR4Change)

- **Dataset Name**: Urban Civic Issues Image Dataset: Potholes and Garbage (QR4Change)
- **Source**: Mendeley Data
- **Official URL**: [https://data.mendeley.com/datasets/zndzygc3p3/2](https://data.mendeley.com/datasets/zndzygc3p3/2)
- **License**: Creative Commons Attribution 4.0 International (CC BY 4.0)
- **Record Volume**: 4,937 total images
  - Pothole split: 1,004 pothole images, 1,962 non-pothole/plain-road images
  - Garbage split: 712 garbage images, 1,259 non-garbage images
- **Core Purpose**:
  - Validating photo evidence submitted by citizens and training lightweight image classification models to detect genuine potholes, garbage piles, and non-issue road imagery.
- **Scope & Limitations**:
  - This dataset specifically covers road potholes and solid waste accumulation; it does not cover electrical faults or tree hazards. The inference system explicitly identifies out-of-scope images as `other_civic_issue` or `unknown`.

---

## 4. Normalized NagarSetu Schema

All data sources are unified into a normalized internal schema independent of any proprietary format:

| Normalized Field | Type | Description |
|---|---|---|
| `id` | String / ObjectId | Internal unique identifier |
| `external_id` | String | Source dataset identifier (e.g. BMC ID or NYC Unique Key) |
| `description` | String | Natural language issue description |
| `category` | Enum | Canonical civic category (15 categories) |
| `subcategory` | String | Detailed issue descriptor |
| `severity` | Enum | LOW, MEDIUM, HIGH, CRITICAL |
| `severity_score` | Number | Continuous severity index (0–100) |
| `latitude` | Number | WGS84 latitude coordinate |
| `longitude` | Number | WGS84 longitude coordinate |
| `address` | String | Street address / landmark |
| `ward` | String | Municipal ward code (e.g. Ward K-West) |
| `zone` | String | Administrative zone |
| `city` | String | Urban center (e.g. Mumbai, Kolkata) |
| `department` | String | Assigned municipal operational agency |
| `complaint_channel` | String | Web, Mobile, Call Center, Walk-in |
| `created_at` | DateTime | Timestamp of initial submission |
| `updated_at` | DateTime | Timestamp of latest modification |
| `resolved_at` | DateTime | Timestamp when marked resolved |
| `status` | Enum | Submitted, AI Analyzed, In Progress, Resolved, etc. |
| `image_url` | String | URL of primary photographic evidence |
| `image_count` | Number | Total attached images |
| `has_image` | Boolean | True if image evidence is present |
| `ai_category` | String | AI-inferred civic category |
| `ai_category_confidence` | Number | Category prediction confidence (0.00–1.00) |
| `ai_severity` | String | AI-inferred severity level |
| `ai_severity_confidence` | Number | Severity prediction confidence (0.00–1.00) |
| `ai_department` | String | AI-inferred routing department |
| `ai_department_confidence` | Number | Department routing confidence (0.00–1.00) |
| `duplicate_group_id` | String | Clustered incident identifier |
| `duplicate_probability` | Number | Semantic/geo similarity score (0.00–1.00) |
| `priority_score` | Number | Weighted multi-factor priority score (0–100) |
| `priority_level` | Enum | LOW, MEDIUM, HIGH, CRITICAL |
| `priority_reasons` | Array[String] | Transparent human-readable explanation factors |
| `sla_hours` | Number | Service level agreement window in hours |
| `sla_deadline` | DateTime | Target completion timestamp |
| `sla_status` | Enum | ON_TRACK, AT_RISK, OVERDUE, RESOLVED |
| `resolution_time_hours` | Number | Post-resolution duration in hours |
| `citizen_satisfaction` | Boolean / Number | Retrospective citizen feedback score |

---

## 5. Ingestion & Execution Policy

1. **Separation of Startup & Ingestion**:
   - The application starts instantaneously without pulling remote datasets.
   - Training and dataset downloads are executed exclusively through standalone scripts:
     ```bash
     python scripts/download_datasets.py
     python scripts/process_datasets.py
     python scripts/train_models.py
     ```
2. **Kaggle & Remote Credentials**:
   - If Kaggle API tokens are not present in the environment, the system provides high-fidelity sample benchmark sets matching the BMC and NYC 311 schemas for local validation and reproducible model training.
