const mongoose = require("mongoose");
const HeatmapZone = require("../models/HeatmapZone");
const {
  buildHeatmapZonesFromComplaints,
  buildMapMarkersFromComplaints,
} = require("../utils/heatmapGenerator");

const regenerateHeatmapZones = async () => {
  const zones = await buildHeatmapZonesFromComplaints();

  if (mongoose.connection && mongoose.connection.readyState === 1) {
    await HeatmapZone.deleteMany({});

    if (zones.length === 0) {
      return [];
    }

    const createdZones = await HeatmapZone.insertMany(zones);
    return createdZones;
  }

  return zones;
};

const getPublicHeatmapData = async () => {
  const zones = await buildHeatmapZonesFromComplaints();
  const markers = await buildMapMarkersFromComplaints();

  return {
    zones,
    markers,
  };
};

module.exports = {
  regenerateHeatmapZones,
  getPublicHeatmapData,
};