const path = require("path");
const { spawn } = require("child_process");
const AIPrediction = require("../models/AIPrediction");
const Complaint = require("../models/Complaint");
const { analyzeComplaintText } = require("../utils/aiScoring");
const { getDepartmentByCategory } = require("../utils/departmentMapper");
const { COMPLAINT_CATEGORIES } = require("../constants/complaintCategories");
const { URGENCY_LEVELS } = require("../constants/urgencyLevels");

const fs = require("fs");

let PYTHON_BIN = process.env.PYTHON_PATH;

if (!PYTHON_BIN) {
  const venvBin = process.platform === "win32"
    ? path.join(__dirname, "../../.venv/Scripts/python.exe")
    : path.join(__dirname, "../../.venv/bin/python");
  // Default to system 'python' which has all ML modules installed
  PYTHON_BIN = "python";
}

const TRIAGE_SCRIPT = path.join(__dirname, "../../ml/inference/triage_service.py");

/**
 * Executes Python AI triage service or falls back to intelligent JS heuristic engine.
 */
const runPythonTriage = (payload) => {
  return new Promise((resolve) => {
    try {
      const py = spawn(PYTHON_BIN, [TRIAGE_SCRIPT], {
        timeout: 5000,
        env: { ...process.env, PYTHONPATH: path.join(__dirname, "../..") },
      });

      let stdout = "";
      let stderr = "";

      py.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      py.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      py.on("close", (code) => {
        if (code === 0 && stdout.trim()) {
          try {
            const parsed = JSON.parse(stdout.trim());
            return resolve({ success: true, data: parsed });
          } catch (e) {
            console.warn("[CivicAI] Output parse warning, falling back to internal engine.");
          }
        }
        resolve({ success: false, error: stderr || "Non-zero exit" });
      });

      py.on("error", (err) => {
        resolve({ success: false, error: err.message });
      });

      py.stdin.write(JSON.stringify(payload));
      py.stdin.end();
    } catch (e) {
      resolve({ success: false, error: e.message });
    }
  });
};

/**
 * Fallback AI engine using internal rules when Python service is unavailable.
 */
const fallbackTriage = ({ title, description, category = "", latitude, longitude, address, imageUrl }) => {
  const analyzed = analyzeComplaintText({ title, description, selectedCategory: category });

  const sevUpper = analyzed.urgency.toUpperCase();
  let slaHours = 72;
  if (sevUpper === "CRITICAL") slaHours = 4;
  else if (sevUpper === "HIGH") slaHours = 24;
  else if (sevUpper === "LOW") slaHours = 168;

  const reasons = [
    `Urgency level ${analyzed.urgency} determined from keyword risk analysis`,
    `Routed to ${analyzed.department}`,
  ];
  if (analyzed.riskFactors && analyzed.riskFactors.length > 0) {
    reasons.push(...analyzed.riskFactors);
  }

  // Canonical category conversion
  const catUpperMap = {
    road: "ROADS_POTHOLES",
    sanitation: "GARBAGE_SOLID_WASTE",
    drainage: "DRAINAGE_FLOODING",
    electricity: "STREETLIGHT",
    water: "WATER_SUPPLY",
    safety: "PUBLIC_HEALTH",
    environment: "TREE_HAZARD",
    traffic: "ENCROACHMENT",
    health: "PUBLIC_HEALTH",
    other: "OTHER",
  };
  const canonicalCat = catUpperMap[analyzed.category] || "OTHER";

  return {
    category: {
      value: canonicalCat,
      confidence: 0.85,
      source: "rule_based_fallback",
    },
    severity: {
      value: sevUpper,
      confidence: 0.82,
      hazard_score: analyzed.aiScore,
    },
    department: {
      value: analyzed.department,
      confidence: 0.88,
      reason: analyzed.aiReason,
    },
    duplicate_probability: 0.0,
    is_duplicate: false,
    duplicate_group_id: null,
    priority: {
      score: analyzed.aiScore,
      level: sevUpper,
      reasons,
    },
    sla: {
      hours: slaHours,
      status: "ON_TRACK",
    },
    image_analysis: {
      has_image: Boolean(imageUrl),
      label: imageUrl ? "civic_issue_evidence" : "no_image_provided",
      confidence: imageUrl ? 0.80 : 0.0,
    },
    model_version: "1.0.0-fallback",
  };
};

/**
 * Main AI analysis entry point. Never fails or blocks user submission.
 */
const analyzeCivicComplaint = async (input) => {
  const {
    title = "",
    description = "",
    category = "",
    latitude = null,
    longitude = null,
    lat = null,
    lng = null,
    address = "",
    imageUrl = "",
    image_url = "",
    candidateComplaints = [],
  } = input;

  const payload = {
    title: title || (description.length > 30 ? description.substring(0, 30) : description),
    description,
    category,
    latitude: latitude || lat,
    longitude: longitude || lng,
    address,
    image_url: imageUrl || image_url,
    candidate_complaints: candidateComplaints,
  };

  const pyRes = await runPythonTriage(payload);
  const result = pyRes.success ? pyRes.data : fallbackTriage(payload);

  // Backward compatible legacy analysis block
  const legacyCategory = (category && category !== "other")
    ? category
    : (result.category.value === "ROADS_POTHOLES" ? "road"
      : result.category.value === "GARBAGE_SOLID_WASTE" ? "sanitation"
      : result.category.value === "DRAINAGE_FLOODING" ? "drainage"
      : result.category.value === "STREETLIGHT" ? "electricity"
      : result.category.value === "WATER_SUPPLY" || result.category.value === "WATER_LEAKAGE" ? "water"
      : result.category.value === "PUBLIC_HEALTH" ? "health"
      : result.category.value === "TREE_HAZARD" ? "environment"
      : result.category.value === "ENCROACHMENT" ? "traffic"
      : "other");

  let legacyUrgency = URGENCY_LEVELS.MEDIUM;
  const sUpper = (result.severity.value || "").toUpperCase();
  if (sUpper === "CRITICAL") legacyUrgency = URGENCY_LEVELS.CRITICAL;
  else if (sUpper === "HIGH") legacyUrgency = URGENCY_LEVELS.HIGH;
  else if (sUpper === "LOW") legacyUrgency = URGENCY_LEVELS.LOW;

  result.analysis = {
    category: legacyCategory,
    urgency: legacyUrgency,
    aiScore: result.priority.score,
    department: result.department.value,
    aiReason: result.priority.reasons ? result.priority.reasons.join(". ") : `AI Priority ${result.priority.score}/100`,
    detectedKeywords: [],
    riskFactors: result.priority.reasons || [],
    analysisSource: result.model_version || "civic_ai_v1",
  };

  return result;
};

module.exports = {
  analyzeCivicComplaint,
};
