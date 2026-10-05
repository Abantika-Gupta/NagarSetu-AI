const mongoose = require("mongoose");
const HeatmapZone = require("../models/HeatmapZone");
const {
  regenerateHeatmapZones,
  getPublicHeatmapData,
} = require("../services/heatmapService");
const { buildHeatmapZonesFromComplaints } = require("../utils/heatmapGenerator");

const getPublicHeatmap = async (req, res, next) => {
  try {
    const heatmapData = await getPublicHeatmapData();

    return res.status(200).json({
      success: true,
      message: "Public civic heatmap data fetched successfully.",
      ...heatmapData,
    });
  } catch (error) {
    next(error);
  }
};

const regenerateHeatmap = async (req, res, next) => {
  try {
    const zones = await regenerateHeatmapZones();

    return res.status(200).json({
      success: true,
      message: "Heatmap zones regenerated successfully.",
      count: zones.length,
      zones,
    });
  } catch (error) {
    next(error);
  }
};

const getSavedHeatmapZones = async (req, res, next) => {
  try {
    let zones = [];
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      zones = await HeatmapZone.find({})
        .populate("complaints", "complaintId title category urgency status")
        .sort({ totalComplaints: -1 })
        .lean();
    }

    if (!zones || zones.length === 0) {
      zones = await buildHeatmapZonesFromComplaints();
    }

    return res.status(200).json({
      success: true,
      count: zones.length,
      zones,
    });
  } catch (error) {
    next(error);
  }
};

const getHighPriorityZones = async (req, res, next) => {
  try {
    let zones = [];
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      zones = await HeatmapZone.find({ heatLevel: "Red" })
        .populate("complaints", "complaintId title category urgency status")
        .sort({ highPriorityCount: -1 })
        .lean();
    }

    if (!zones || zones.length === 0) {
      const allZones = await buildHeatmapZonesFromComplaints();
      zones = allZones.filter((z) => z.heatLevel === "Red");
    }

    return res.status(200).json({
      success: true,
      count: zones.length,
      zones,
    });
  } catch (error) {
    next(error);
  }
};

const getResolvedZones = async (req, res, next) => {
  try {
    let zones = [];
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      zones = await HeatmapZone.find({ resolvedCount: { $gt: 0 } })
        .populate("complaints", "complaintId title category urgency status")
        .sort({ resolvedCount: -1 })
        .lean();
    }

    if (!zones || zones.length === 0) {
      const allZones = await buildHeatmapZonesFromComplaints();
      zones = allZones.filter((z) => z.resolvedCount > 0);
    }

    return res.status(200).json({
      success: true,
      count: zones.length,
      zones,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicHeatmap,
  regenerateHeatmap,
  getSavedHeatmapZones,
  getHighPriorityZones,
  getResolvedZones,
};