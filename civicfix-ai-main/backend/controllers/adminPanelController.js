const Complaint = require("../models/Complaint");
const Department = require("../models/Department");
const StatusTimeline = require("../models/StatusTimeline");
const ComplaintSLA = require("../models/ComplaintSLA");
const { createStatusTimeline } = require("../utils/statusTimeline");

const getAdminComplaints = async (req, res, next) => {
  try {
    const {
      status,
      category,
      urgency,
      severity,
      department,
      ward,
      slaStatus,
      duplicateGroupId,
      isDuplicate,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (category) query.category = category;
    if (urgency) query.urgency = urgency;
    if (severity) query.$or = [{ severity }, { urgency: severity }];
    if (department) query.department = department;
    if (ward) query.ward = new RegExp(`^${ward.trim()}$`, "i");
    if (slaStatus) query.slaStatus = slaStatus;
    if (duplicateGroupId) query.duplicateGroupId = duplicateGroupId;
    if (isDuplicate === "true" || isDuplicate === true) {
      query.duplicateOf = { $ne: null };
    }

    if (search) {
      query.$or = [
        { complaintId: { $regex: search, $options: "i" } },
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } },
        { ward: { $regex: search, $options: "i" } },
        { "location.address": { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await Complaint.countDocuments(query);

    const complaints = await Complaint.find(query)
      .populate("reportedBy", "name email phone role trustScore")
      .populate("assignedDepartmentId", "name category officerName email phone")
      .populate("duplicateOf", "complaintId title status aiScore priorityScore")
      .sort({ priorityScore: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Refresh dynamic SLA status on overdue complaints
    const now = new Date();
    complaints.forEach((c) => {
      if (["Resolved", "Citizen Verified", "Closed"].includes(c.status)) {
        c.slaStatus = "RESOLVED";
      } else if (c.slaDeadline && now > new Date(c.slaDeadline)) {
        c.slaStatus = "OVERDUE";
      }
    });

    return res.status(200).json({
      success: true,
      count: complaints.length,
      totalCount,
      page: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      complaints,
    });
  } catch (error) {
    next(error);
  }
};

const getAdminComplaintDetails = async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate("reportedBy", "name email phone role trustScore")
      .populate("assignedDepartmentId", "name category officerName email phone")
      .populate("duplicateOf", "complaintId title status aiScore priorityScore duplicateGroupId");

    if (!complaint) {
      res.status(404);
      throw new Error("Complaint not found.");
    }

    // Dynamic SLA status check
    if (["Resolved", "Citizen Verified", "Closed"].includes(complaint.status)) {
      complaint.slaStatus = "RESOLVED";
    } else if (complaint.slaDeadline && new Date() > new Date(complaint.slaDeadline)) {
      complaint.slaStatus = "OVERDUE";
    }

    const timeline = await StatusTimeline.find({
      complaint: complaint._id,
    }).sort({ createdAt: 1 });

    const slaRecord = await ComplaintSLA.findOne({
      complaint: complaint._id,
    });

    return res.status(200).json({
      success: true,
      complaint,
      timeline,
      slaRecord,
    });
  } catch (error) {
    next(error);
  }
};

const updateComplaintByAdmin = async (req, res, next) => {
  try {
    const {
      status,
      category,
      urgency,
      aiScore,
      priorityScore,
      department,
      adminRemark,
      ward,
      slaHours,
    } = req.body;

    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      res.status(404);
      throw new Error("Complaint not found.");
    }

    const oldStatus = complaint.status;

    if (status) {
      complaint.status = status;
      if (["Resolved", "Citizen Verified", "Closed"].includes(status)) {
        complaint.resolvedAt = new Date();
        complaint.slaStatus = "RESOLVED";
        if (complaint.createdAt) {
          const diffMs = complaint.resolvedAt.getTime() - new Date(complaint.createdAt).getTime();
          complaint.resolutionTimeHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
        }

        try {
          await ComplaintSLA.findOneAndUpdate(
            { complaint: complaint._id },
            { resolvedAt: complaint.resolvedAt, status: "RESOLVED" }
          );
        } catch (e) {
          // ignore
        }
      }
    }

    if (category) complaint.category = category;
    if (urgency) complaint.urgency = urgency;
    if (ward) complaint.ward = ward;
    if (priorityScore !== undefined && priorityScore !== "") {
      complaint.priorityScore = Number(priorityScore);
      complaint.aiScore = Number(priorityScore);
    } else if (aiScore !== undefined && aiScore !== "") {
      complaint.aiScore = Number(aiScore);
      complaint.priorityScore = Number(aiScore);
    }

    if (slaHours && Number(slaHours) > 0) {
      complaint.slaHours = Number(slaHours);
      complaint.slaDeadline = new Date(Date.now() + Number(slaHours) * 60 * 60 * 1000);
      complaint.slaStatus = "ON_TRACK";
    }

    if (adminRemark !== undefined) complaint.adminRemark = adminRemark;

    if (department) {
      const departmentDoc = await Department.findOne({ name: department });

      complaint.department = department;
      complaint.assignedDepartmentId = departmentDoc ? departmentDoc._id : null;
    }

    await complaint.save();

    await createStatusTimeline({
      complaint: complaint._id,
      status: complaint.status,
      title: "Admin Updated Complaint",
      message: `Admin updated complaint. Status: ${oldStatus} → ${complaint.status}. ${
        department ? `Assigned to ${department}.` : ""
      } ${adminRemark ? `Remark: ${adminRemark}` : ""}`,
      updatedBy: req.user._id,
      updatedByRole: req.user.role,
    });

    const updatedComplaint = await Complaint.findById(complaint._id)
      .populate("reportedBy", "name email phone role trustScore")
      .populate("assignedDepartmentId", "name category officerName email phone")
      .populate("duplicateOf", "complaintId title status aiScore priorityScore");

    return res.status(200).json({
      success: true,
      message: "Complaint updated successfully.",
      complaint: updatedComplaint,
    });
  } catch (error) {
    next(error);
  }
};

const getAdminDepartments = async (req, res, next) => {
  try {
    const departments = await Department.find({}).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: departments.length,
      departments,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminComplaints,
  getAdminComplaintDetails,
  updateComplaintByAdmin,
  getAdminDepartments,
};