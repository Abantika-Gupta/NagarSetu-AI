const mongoose = require("mongoose");

const complaintSLASchema = new mongoose.Schema(
  {
    complaint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
      required: true,
      index: true,
    },
    complaintId: {
      type: String,
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL", "Low", "Medium", "High", "Critical"],
      default: "MEDIUM",
    },
    slaHours: {
      type: Number,
      required: true,
      default: 72,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    deadline: {
      type: Date,
      required: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["ON_TRACK", "AT_RISK", "OVERDUE", "RESOLVED"],
      default: "ON_TRACK",
      index: true,
    },
    breachedAt: {
      type: Date,
      default: null,
    },
    extensionHours: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

complaintSLASchema.methods.recalculateStatus = function () {
  if (this.resolvedAt) {
    this.status = "RESOLVED";
    return this.status;
  }

  const now = Date.now();
  const deadlineTime = new Date(this.deadline).getTime();
  const startTime = new Date(this.startedAt).getTime();
  const totalWindow = deadlineTime - startTime;
  const elapsed = now - startTime;

  if (now > deadlineTime) {
    this.status = "OVERDUE";
    if (!this.breachedAt) this.breachedAt = new Date(deadlineTime);
  } else if (totalWindow > 0 && elapsed / totalWindow >= 0.7) {
    this.status = "AT_RISK";
  } else {
    this.status = "ON_TRACK";
  }

  return this.status;
};

const ComplaintSLA = mongoose.model("ComplaintSLA", complaintSLASchema);

module.exports = ComplaintSLA;
