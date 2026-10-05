const Complaint = require("../models/Complaint");
const Department = require("../models/Department");
const StatusTimeline = require("../models/StatusTimeline");
const generateComplaintId = require("../utils/generateComplaintId");
const { getDepartmentByCategory } = require("../utils/departmentMapper");
const { createStatusTimeline } = require("../utils/statusTimeline");
const { COMPLAINT_STATUS } = require("../constants/complaintStatus");
const { USER_ROLES } = require("../constants/userRoles");
const PriorityScore = require("../models/PriorityScore");
const { analyzeAndSavePriority } = require("../services/aiPriorityService");
const { detectAndSaveDuplicate } = require("../services/duplicateService");
const AIPrediction = require("../models/AIPrediction");
const ComplaintSLA = require("../models/ComplaintSLA");
const { analyzeCivicComplaint } = require("../services/civicAIService");

const createComplaint = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category = "",
      imageUrl = "",
      images = [],
      location,
      ward = "",
      zone = "",
      complaintChannel = "web",
    } = req.body;

    if (!title || !description || !location || !location.address) {
      res.status(400);
      throw new Error("Title, description and address are required.");
    }

    // Candidate complaints for duplicate comparison
    let candidateComplaints = [];
    try {
      candidateComplaints = await Complaint.find({
        status: { $nin: ["Closed", "Rejected"] },
      })
        .select("complaintId title description category location duplicateGroupId createdAt")
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();
    } catch (e) {
      candidateComplaints = [];
    }

    // Run unified Civic AI analysis
    const aiTriage = await analyzeCivicComplaint({
      title,
      description,
      category,
      latitude: location.lat,
      longitude: location.lng,
      address: location.address,
      imageUrl,
      candidateComplaints,
    });

    const departmentName = aiTriage.department.value;
    const department = await Department.findOne({ name: departmentName });

    const complaintId = generateComplaintId();
    const slaDeadline = new Date(Date.now() + (aiTriage.sla.hours || 72) * 60 * 60 * 1000);

    const complaint = await Complaint.create({
      complaintId,
      title,
      description,
      category: aiTriage.analysis.category,
      urgency: aiTriage.analysis.urgency,
      aiScore: aiTriage.priority.score,
      aiReason: aiTriage.analysis.aiReason,
      department: departmentName,
      assignedDepartmentId: department ? department._id : null,
      imageUrl,
      images: Array.isArray(images) && images.length > 0 ? images : (imageUrl ? [imageUrl] : []),
      hasImage: Boolean(imageUrl || (Array.isArray(images) && images.length > 0)),
      imageCount: Array.isArray(images) && images.length > 0 ? images.length : (imageUrl ? 1 : 0),
      location,
      ward: ward || location.city || "General Ward",
      zone: zone || "General Zone",
      complaintChannel: complaintChannel || "web",
      status: COMPLAINT_STATUS.AI_ANALYZED,
      reportedBy: req.user._id,
      escalationDeadline: slaDeadline,
      // Normalized AI schema fields
      aiCategory: aiTriage.category.value,
      aiCategoryConfidence: aiTriage.category.confidence,
      aiSeverity: aiTriage.severity.value,
      aiSeverityConfidence: aiTriage.severity.confidence,
      aiDepartment: aiTriage.department.value,
      aiDepartmentConfidence: aiTriage.department.confidence,
      priorityScore: aiTriage.priority.score,
      priorityLevel: aiTriage.priority.level,
      priorityReasons: aiTriage.priority.reasons,
      slaHours: aiTriage.sla.hours,
      slaDeadline,
      slaStatus: "ON_TRACK",
      duplicateProbability: aiTriage.duplicate_probability || 0,
      duplicateGroupId: aiTriage.duplicate_group_id || `GRP_${complaintId}`,
    });

    // Save PriorityScore legacy record
    const { priorityScore } = await analyzeAndSavePriority({
      complaint,
      complaintId: complaint.complaintId,
      title,
      description,
      selectedCategory: aiTriage.analysis.category,
    });

    // Save AIPrediction audit record
    try {
      await AIPrediction.create({
        complaint: complaint._id,
        complaintId: complaint.complaintId,
        modelName: "civic_ai_triage_pipeline",
        modelVersion: "1.0.0",
        predictionType: "full_triage",
        prediction: aiTriage,
        confidence: aiTriage.category.confidence,
        explanation: aiTriage.priority.reasons ? aiTriage.priority.reasons.join(". ") : "",
        featuresUsed: ["title", "description", "location", "hazard_keywords", "time"],
      });
    } catch (e) {
      console.warn("[CivicAI] AIPrediction log skipped:", e.message);
    }

    // Save ComplaintSLA tracking record
    try {
      await ComplaintSLA.create({
        complaint: complaint._id,
        complaintId: complaint.complaintId,
        severity: aiTriage.severity.value,
        slaHours: aiTriage.sla.hours,
        startedAt: new Date(),
        deadline: slaDeadline,
        status: "ON_TRACK",
      });
    } catch (e) {
      console.warn("[CivicAI] ComplaintSLA tracking log skipped:", e.message);
    }

    await createStatusTimeline({
      complaint: complaint._id,
      status: COMPLAINT_STATUS.SUBMITTED,
      title: "Complaint Submitted",
      message: "Your complaint has been submitted successfully.",
      updatedBy: req.user._id,
      updatedByRole: req.user.role,
    });

    await createStatusTimeline({
      complaint: complaint._id,
      status: COMPLAINT_STATUS.AI_ANALYZED,
      title: "AI Priority Analysis Completed",
      message: `AI priority ${aiTriage.priority.score}/100 (${aiTriage.priority.level}), department ${departmentName}, SLA target: ${aiTriage.sla.hours}h.`,
      updatedBy: req.user._id,
      updatedByRole: "system",
    });

    const duplicateData = await detectAndSaveDuplicate({ complaint });

    if (department) {
      department.activeComplaints += 1;
      await department.save();
    }

    const populatedComplaint = await Complaint.findById(complaint._id)
      .populate("reportedBy", "name email phone role")
      .populate("assignedDepartmentId", "name category officerName email phone")
      .populate("duplicateOf", "complaintId title status aiScore department");

    return res.status(201).json({
      success: true,
      message: duplicateData.isDuplicate
        ? "Complaint created, AI analyzed, and possible duplicate detected."
        : "Complaint created and AI analyzed successfully.",
      complaint: populatedComplaint,
      priorityScore,
      aiTriage,
      duplicate: {
        isDuplicate: duplicateData.isDuplicate,
        duplicateReport: duplicateData.duplicateReport,
        originalComplaint: duplicateData.duplicateResult.originalComplaint || null,
        similarityScore: duplicateData.duplicateResult.similarityScore || 0,
        distanceInMeters: duplicateData.duplicateResult.distanceInMeters || null,
        reason: duplicateData.duplicateResult.reason || "",
      },
    });
  } catch (error) {
    next(error);
  }
};
const getMyComplaints = async (req, res, next) => {
  try {
    const complaints = await Complaint.find({ reportedBy: req.user._id })
      .populate("assignedDepartmentId", "name category officerName email phone")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: complaints.length,
      complaints,
    });
  } catch (error) {
    next(error);
  }
};

const getAllComplaints = async (req, res, next) => {
  try {
    const { status, category, urgency, department, search } = req.query;

    const query = {};

    if (status) query.status = status;
    if (category) query.category = category;
    if (urgency) query.urgency = urgency;
    if (department) query.department = department;

    if (search) {
      query.$or = [
        { complaintId: { $regex: search, $options: "i" } },
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const complaints = await Complaint.find(query)
      .populate("reportedBy", "name email phone role")
      .populate("assignedTo", "name email phone role")
      .populate("assignedDepartmentId", "name category officerName email phone")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: complaints.length,
      complaints,
    });
  } catch (error) {
    next(error);
  }
};

const getComplaintById = async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate("reportedBy", "name email phone role trustScore")
      .populate("assignedTo", "name email phone role")
      .populate("assignedDepartmentId", "name category officerName email phone");

    if (!complaint) {
      res.status(404);
      throw new Error("Complaint not found.");
    }

    const isOwner = complaint.reportedBy._id.toString() === req.user._id.toString();
    const isAdmin =
      req.user.role === USER_ROLES.ADMIN || req.user.role === USER_ROLES.SUPER_ADMIN;
    const isDepartmentOfficer = req.user.role === USER_ROLES.DEPARTMENT_OFFICER;

    if (!isOwner && !isAdmin && !isDepartmentOfficer) {
      res.status(403);
      throw new Error("Access denied for this complaint.");
    }

    const timeline = await StatusTimeline.find({ complaint: complaint._id })
      .populate("updatedBy", "name email role")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      complaint,
      timeline,
    });
  } catch (error) {
    next(error);
  }
};

const getComplaintByComplaintId = async (req, res, next) => {
  try {
    const complaint = await Complaint.findOne({
      complaintId: req.params.complaintId,
    })
      .populate("reportedBy", "name email phone role")
      .populate("assignedTo", "name email phone role")
      .populate("assignedDepartmentId", "name category officerName email phone");

    if (!complaint) {
      res.status(404);
      throw new Error("Complaint not found.");
    }

    const timeline = await StatusTimeline.find({ complaint: complaint._id })
      .populate("updatedBy", "name email role")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      complaint,
      timeline,
    });
  } catch (error) {
    next(error);
  }
};

const updateComplaintStatus = async (req, res, next) => {
  try {
    const { status, remark = "" } = req.body;

    if (!status) {
      res.status(400);
      throw new Error("Status is required.");
    }

    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      res.status(404);
      throw new Error("Complaint not found.");
    }

    complaint.status = status;

    if (req.user.role === USER_ROLES.DEPARTMENT_OFFICER) {
      complaint.departmentRemark = remark;
    } else {
      complaint.adminRemark = remark;
    }

    await complaint.save();

    await createStatusTimeline({
      complaint: complaint._id,
      status,
      title: `Status Updated: ${status}`,
      message: remark || `Complaint status changed to ${status}.`,
      updatedBy: req.user._id,
      updatedByRole: req.user.role,
    });

    return res.status(200).json({
      success: true,
      message: "Complaint status updated successfully.",
      complaint,
    });
  } catch (error) {
    next(error);
  }
};

const assignDepartment = async (req, res, next) => {
  try {
    const { departmentId } = req.body;

    if (!departmentId) {
      res.status(400);
      throw new Error("Department ID is required.");
    }

    const department = await Department.findById(departmentId);

    if (!department) {
      res.status(404);
      throw new Error("Department not found.");
    }

    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      res.status(404);
      throw new Error("Complaint not found.");
    }

    complaint.assignedDepartmentId = department._id;
    complaint.department = department.name;
    complaint.status = COMPLAINT_STATUS.ASSIGNED;

    await complaint.save();

    await createStatusTimeline({
      complaint: complaint._id,
      status: COMPLAINT_STATUS.ASSIGNED,
      title: "Complaint Assigned",
      message: `Complaint assigned to ${department.name}.`,
      updatedBy: req.user._id,
      updatedByRole: req.user.role,
    });

    return res.status(200).json({
      success: true,
      message: "Department assigned successfully.",
      complaint,
    });
  } catch (error) {
    next(error);
  }
};

const getDepartmentAssignedComplaints = async (req, res, next) => {
  try {
    const department = await Department.findOne({
      email: req.user.email,
    });

    let query = {};

    if (department) {
      query.assignedDepartmentId = department._id;
    } else {
      query.department = { $regex: req.query.department || "", $options: "i" };
    }

    const complaints = await Complaint.find(query)
      .populate("reportedBy", "name email phone")
      .populate("assignedDepartmentId", "name category officerName email phone")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: complaints.length,
      complaints,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createComplaint,
  getMyComplaints,
  getAllComplaints,
  getComplaintById,
  getComplaintByComplaintId,
  updateComplaintStatus,
  assignDepartment,
  getDepartmentAssignedComplaints,
};