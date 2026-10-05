const mongoose = require("mongoose");
const Complaint = require("../models/Complaint");
const { loadComplaintsFromDataset, isValidCoordinate } = require("./civicDatasetLoader");

const getHeatLevel = ({ totalComplaints, highPriorityCount, pendingCount, resolvedCount = 0 }) => {
  if (totalComplaints === 0) {
    return "Green";
  }

  const resolutionRate = totalComplaints > 0 ? resolvedCount / totalComplaints : 0;

  // Red Zone: High complaints or critical pending backlog
  if (
    pendingCount >= 20 ||
    (highPriorityCount >= 2 && pendingCount >= 2 && resolutionRate === 0) ||
    (totalComplaints >= 50 && resolutionRate < 0.5) ||
    (highPriorityCount >= 10 && resolutionRate < 0.6)
  ) {
    return "Red";
  }

  // Green Zone: Resolved or low complaint density with no significant pending backlog
  if (
    pendingCount === 0 ||
    (resolutionRate >= 0.85 && pendingCount <= 2)
  ) {
    return "Green";
  }

  // Yellow Zone: Medium complaint density or moderate pending issues
  return "Yellow";
};

const normalizeArea = (complaint) => {
  if (complaint.ward && complaint.ward !== "General Ward") {
    return complaint.ward;
  }
  const city = complaint.location?.city || "";
  const address = complaint.location?.address || "";
  const addressParts = address.split(",");
  const firstPart = addressParts[0]?.trim();

  return firstPart || city || "Civic Area";
};

const getAllSourceComplaints = async () => {
  let dbComplaints = [];

  // Check if MongoDB is connected before attempting query to prevent hanging
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      dbComplaints = await Complaint.find({})
        .populate("reportedBy", "name email phone")
        .sort({ createdAt: -1 })
        .lean();
    } catch (err) {
      console.warn("Could not query MongoDB for complaints:", err.message);
      dbComplaints = [];
    }
  }

  if (dbComplaints.length > 0) {
    return dbComplaints;
  }

  // Fallback to real civic complaints from dataset
  return loadComplaintsFromDataset();
};

const buildHeatmapZonesFromComplaints = async () => {
  const complaints = await getAllSourceComplaints();

  if (!complaints || complaints.length === 0) {
    return [];
  }

  const zoneMap = {};

  complaints.forEach((complaint) => {
    const area = normalizeArea(complaint);
    const city = complaint.location?.city || "Urban District";
    const zoneKey = `${area}-${city}`.toLowerCase();

    const hasCoords = isValidCoordinate(complaint.location?.lat, complaint.location?.lng);
    const lat = hasCoords ? Number(complaint.location.lat) : null;
    const lng = hasCoords ? Number(complaint.location.lng) : null;

    if (!zoneMap[zoneKey]) {
      zoneMap[zoneKey] = {
        zoneName: area,
        area: city,
        totalComplaints: 0,
        highPriorityCount: 0,
        mediumPriorityCount: 0,
        lowPriorityCount: 0,
        resolvedCount: 0,
        pendingCount: 0,
        validCoordsCount: 0,
        sumLat: 0,
        sumLng: 0,
        complaints: [],
      };
    }

    zoneMap[zoneKey].totalComplaints += 1;
    zoneMap[zoneKey].complaints.push(complaint._id || complaint.complaintId);

    if (hasCoords) {
      zoneMap[zoneKey].validCoordsCount += 1;
      zoneMap[zoneKey].sumLat += lat;
      zoneMap[zoneKey].sumLng += lng;
    }

    if (complaint.urgency === "Critical" || complaint.urgency === "High") {
      zoneMap[zoneKey].highPriorityCount += 1;
    } else if (complaint.urgency === "Medium") {
      zoneMap[zoneKey].mediumPriorityCount += 1;
    } else {
      zoneMap[zoneKey].lowPriorityCount += 1;
    }

    if (
      complaint.status === "Resolved" ||
      complaint.status === "Citizen Verified" ||
      complaint.status === "Closed"
    ) {
      zoneMap[zoneKey].resolvedCount += 1;
    } else {
      zoneMap[zoneKey].pendingCount += 1;
    }
  });

  return Object.values(zoneMap).map((zone) => {
    const centerLocation =
      zone.validCoordsCount > 0
        ? {
            lat: parseFloat((zone.sumLat / zone.validCoordsCount).toFixed(6)),
            lng: parseFloat((zone.sumLng / zone.validCoordsCount).toFixed(6)),
          }
        : null;

    return {
      zoneName: zone.zoneName,
      area: zone.area,
      totalComplaints: zone.totalComplaints,
      highPriorityCount: zone.highPriorityCount,
      mediumPriorityCount: zone.mediumPriorityCount,
      lowPriorityCount: zone.lowPriorityCount,
      resolvedCount: zone.resolvedCount,
      pendingCount: zone.pendingCount,
      centerLocation,
      complaints: zone.complaints,
      heatLevel: getHeatLevel({
        totalComplaints: zone.totalComplaints,
        highPriorityCount: zone.highPriorityCount,
        pendingCount: zone.pendingCount,
        resolvedCount: zone.resolvedCount,
      }),
    };
  });
};

const buildMapMarkersFromComplaints = async () => {
  const complaints = await getAllSourceComplaints();

  if (!complaints || complaints.length === 0) {
    return [];
  }

  const now = new Date();

  return complaints
    .filter((complaint) => isValidCoordinate(complaint.location?.lat, complaint.location?.lng))
    .map((complaint) => {
      const isResolved = [
        "Resolved",
        "Citizen Verified",
        "Closed",
      ].includes(complaint.status);

      const isOverdue =
        !isResolved &&
        (complaint.slaStatus === "OVERDUE" ||
          (complaint.slaDeadline && now > new Date(complaint.slaDeadline)));

      let markerColor = "green";

      if (isResolved) {
        markerColor = "green";
      } else if (isOverdue) {
        markerColor = "purple";
      } else if (
        complaint.urgency === "Critical" ||
        complaint.urgency === "High" ||
        (complaint.priorityScore && complaint.priorityScore >= 70)
      ) {
        markerColor = "red";
      } else if (complaint.urgency === "Medium") {
        markerColor = "yellow";
      }

      return {
        id: complaint._id || complaint.complaintId,
        complaintId: complaint.complaintId,
        title: complaint.title,
        description: complaint.description,
        category: complaint.category,
        urgency: complaint.urgency,
        aiScore: complaint.aiScore,
        priorityScore: complaint.priorityScore || complaint.aiScore,
        priorityLevel: complaint.priorityLevel || complaint.urgency,
        priorityReasons: complaint.priorityReasons || [],
        slaHours: complaint.slaHours || 72,
        slaDeadline: complaint.slaDeadline,
        slaStatus: isResolved ? "RESOLVED" : (isOverdue ? "OVERDUE" : (complaint.slaStatus || "ON_TRACK")),
        isOverdue,
        isDuplicate: Boolean(complaint.duplicateOf),
        duplicateGroupId: complaint.duplicateGroupId || null,
        ward: complaint.ward || complaint.location?.city || "",
        status: complaint.status,
        department: complaint.department,
        location: {
          address: complaint.location?.address || "",
          city: complaint.location?.city || "",
          state: complaint.location?.state || "",
          lat: Number(complaint.location.lat),
          lng: Number(complaint.location.lng),
        },
        imageUrl: complaint.imageUrl || (complaint.images && complaint.images[0]) || "",
        markerColor,
        createdAt: complaint.createdAt,
      };
    });
};

module.exports = {
  buildHeatmapZonesFromComplaints,
  buildMapMarkersFromComplaints,
  getHeatLevel,
  isValidCoordinate,
};