const mongoose = require("mongoose");

const aiPredictionSchema = new mongoose.Schema(
  {
    complaint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
      default: null,
      index: true,
    },
    complaintId: {
      type: String,
      default: "",
      index: true,
    },
    modelName: {
      type: String,
      required: true,
      index: true,
    },
    modelVersion: {
      type: String,
      required: true,
      default: "v1.0.0",
    },
    predictionType: {
      type: String,
      required: true,
      enum: ["category", "severity", "department", "duplicate", "priority", "vision", "satisfaction", "full_triage"],
    },
    prediction: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    confidence: {
      type: Number,
      default: null,
      min: 0,
      max: 1,
    },
    explanation: {
      type: String,
      default: "",
    },
    featuresUsed: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const AIPrediction = mongoose.model("AIPrediction", aiPredictionSchema);

module.exports = AIPrediction;
