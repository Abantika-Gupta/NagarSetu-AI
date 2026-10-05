const { analyzeCivicComplaint } = require("../services/civicAIService");
const Complaint = require("../models/Complaint");

const analyzeComplaint = async (req, res, next) => {
  try {
    const {
      title = "",
      description = "",
      category = "",
      latitude,
      longitude,
      lat,
      lng,
      address = "",
      image_url,
      imageUrl,
    } = req.body;

    if (!description && !title) {
      res.status(400);
      throw new Error("Complaint description or title is required.");
    }

    // Fetch recent active complaints for real-time duplicate checking
    let candidateComplaints = [];
    try {
      candidateComplaints = await Complaint.find({
        status: { $nin: ["Closed", "Rejected"] },
      })
        .select("complaintId title description category location duplicateGroupId createdAt")
        .sort({ createdAt: -1 })
        .limit(35)
        .lean();
    } catch (e) {
      candidateComplaints = [];
    }

    const triageResult = await analyzeCivicComplaint({
      title,
      description,
      category,
      latitude: latitude || lat,
      longitude: longitude || lng,
      address,
      imageUrl: imageUrl || image_url,
      candidateComplaints,
    });

    return res.status(200).json({
      success: true,
      message: "Complaint analyzed successfully.",
      ...triageResult,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  analyzeComplaint,
};