const mongoose = require("mongoose");

const modelVersionSchema = new mongoose.Schema(
  {
    modelName: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    modelVersion: {
      type: String,
      required: true,
      default: "1.0.0",
    },
    task: {
      type: String,
      enum: ["text_classification", "severity_estimation", "duplicate_detection", "vision_classification", "satisfaction_prediction", "priority_scoring", "department_routing"],
      required: true,
    },
    architecture: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    metrics: {
      accuracy: { type: Number, default: null },
      precision: { type: Number, default: null },
      recall: { type: Number, default: null },
      f1: { type: Number, default: null },
      rocAuc: { type: Number, default: null },
      loss: { type: Number, default: null },
      sampleCount: { type: Number, default: 0 },
    },
    artifactPath: {
      type: String,
      default: "",
    },
    trainedAt: {
      type: Date,
      default: Date.now,
    },
    parameters: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const ModelVersion = mongoose.model("ModelVersion", modelVersionSchema);

module.exports = ModelVersion;
