const Complaint = require("../models/Complaint");
const User = require("../models/User");
const Department = require("../models/Department");
const DuplicateReport = require("../models/DuplicateReport");
const PriorityScore = require("../models/PriorityScore");

const getSummaryStats = async () => {
  const now = new Date();

  const [
    totalComplaints,
    totalUsers,
    totalDepartments,
    totalDuplicates,
    totalHighPriority,
    criticalComplaints,
    pendingComplaints,
    inProgressComplaints,
    resolvedComplaints,
    escalatedComplaints,
    overdueComplaints,
    duplicateGroups,
  ] = await Promise.all([
    Complaint.countDocuments(),
    User.countDocuments(),
    Department.countDocuments(),
    DuplicateReport.countDocuments(),
    Complaint.countDocuments({
      $or: [
        { urgency: { $in: ["High", "Critical"] } },
        { priorityLevel: { $in: ["HIGH", "CRITICAL", "High", "Critical"] } },
        { priorityScore: { $gte: 70 } },
      ],
    }),
    Complaint.countDocuments({
      $or: [
        { urgency: "Critical" },
        { priorityLevel: { $in: ["CRITICAL", "Critical"] } },
        { severity: { $in: ["CRITICAL", "Critical"] } },
      ],
    }),
    Complaint.countDocuments({
      status: {
        $in: [
          "Submitted",
          "AI Analyzed",
          "Duplicate Checked",
          "Assigned to Department",
          "Accepted by Officer",
        ],
      },
    }),
    Complaint.countDocuments({ status: "In Progress" }),
    Complaint.countDocuments({
      status: { $in: ["Resolved", "Citizen Verified", "Closed"] },
    }),
    Complaint.countDocuments({ status: "Escalated" }),
    Complaint.countDocuments({
      $or: [
        { slaStatus: "OVERDUE" },
        {
          status: { $nin: ["Resolved", "Citizen Verified", "Closed", "Rejected"] },
          slaDeadline: { $lt: now, $ne: null },
        },
      ],
    }),
    Complaint.distinct("duplicateGroupId", {
      duplicateGroupId: { $ne: null, $ne: "" },
    }),
  ]);

  const resolutionRate =
    totalComplaints === 0
      ? 0
      : Math.round((resolvedComplaints / totalComplaints) * 100);

  const openComplaints = pendingComplaints + inProgressComplaints + escalatedComplaints;
  const totalDuplicateGroups = duplicateGroups ? duplicateGroups.length : 0;

  return {
    totalComplaints,
    totalUsers,
    totalDepartments,
    totalDuplicates,
    totalHighPriority,
    criticalComplaints,
    openComplaints,
    overdueComplaints,
    pendingComplaints,
    inProgressComplaints,
    resolvedComplaints,
    escalatedComplaints,
    totalDuplicateGroups,
    resolutionRate,
  };
};

const groupCountByField = async (fieldName) => {
  return Complaint.aggregate([
    {
      $group: {
        _id: `$${fieldName}`,
        count: { $sum: 1 },
      },
    },
    {
      $sort: {
        count: -1,
      },
    },
  ]);
};

const getCategoryWiseStats = async () => {
  return groupCountByField("category");
};

const getStatusWiseStats = async () => {
  return groupCountByField("status");
};

const getUrgencyWiseStats = async () => {
  return groupCountByField("urgency");
};

const getSeverityWiseStats = async () => {
  const result = await Complaint.aggregate([
    {
      $group: {
        _id: { $ifNull: ["$severity", "$urgency"] },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { count: -1 },
    },
  ]);
  return result;
};

const getDepartmentWiseStats = async () => {
  return groupCountByField("department");
};

const getWardWiseStats = async () => {
  return Complaint.aggregate([
    {
      $match: {
        ward: { $ne: null, $ne: "" },
      },
    },
    {
      $group: {
        _id: "$ward",
        count: { $sum: 1 },
        highPriority: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $in: ["$urgency", ["High", "Critical"]] },
                  { $in: ["$priorityLevel", ["HIGH", "CRITICAL"]] },
                  { $gte: ["$priorityScore", 70] },
                ],
              },
              1,
              0,
            ],
          },
        },
        resolved: {
          $sum: {
            $cond: [
              { $in: ["$status", ["Resolved", "Citizen Verified", "Closed"]] },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $sort: { count: -1 },
    },
    {
      $limit: 15,
    },
  ]);
};

const getSlaComplianceStats = async () => {
  const now = new Date();
  const [onTrack, atRisk, overdue, resolved] = await Promise.all([
    Complaint.countDocuments({
      status: { $nin: ["Resolved", "Citizen Verified", "Closed", "Rejected"] },
      $or: [
        { slaStatus: "ON_TRACK" },
        { slaDeadline: { $gte: now } },
      ],
    }),
    Complaint.countDocuments({
      status: { $nin: ["Resolved", "Citizen Verified", "Closed", "Rejected"] },
      slaStatus: "AT_RISK",
    }),
    Complaint.countDocuments({
      $or: [
        { slaStatus: "OVERDUE" },
        {
          status: { $nin: ["Resolved", "Citizen Verified", "Closed", "Rejected"] },
          slaDeadline: { $lt: now, $ne: null },
        },
      ],
    }),
    Complaint.countDocuments({
      status: { $in: ["Resolved", "Citizen Verified", "Closed"] },
    }),
  ]);

  return [
    { _id: "On Track", count: onTrack },
    { _id: "At Risk", count: atRisk },
    { _id: "Overdue", count: overdue },
    { _id: "Resolved within SLA", count: resolved },
  ];
};

const getResolutionTrends = async () => {
  return Complaint.aggregate([
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        totalSubmitted: { $sum: 1 },
        totalResolved: {
          $sum: {
            $cond: [
              { $in: ["$status", ["Resolved", "Citizen Verified", "Closed"]] },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $sort: {
        "_id.year": 1,
        "_id.month": 1,
      },
    },
  ]);
};

const getAreaWiseStats = async () => {
  return Complaint.aggregate([
    {
      $group: {
        _id: {
          city: "$location.city",
          state: "$location.state",
        },
        count: { $sum: 1 },
        highPriority: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $in: ["$urgency", ["High", "Critical"]] },
                  { $gte: ["$priorityScore", 70] },
                ],
              },
              1,
              0,
            ],
          },
        },
        resolved: {
          $sum: {
            $cond: [
              { $in: ["$status", ["Resolved", "Citizen Verified", "Closed"]] },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $sort: {
        count: -1,
      },
    },
  ]);
};

const getRecentComplaints = async (limit = 10) => {
  return Complaint.find({})
    .populate("reportedBy", "name email phone")
    .populate("assignedDepartmentId", "name category officerName")
    .sort({ createdAt: -1 })
    .limit(Number(limit));
};

const getPriorityScoreStats = async () => {
  const result = await Complaint.aggregate([
    {
      $group: {
        _id: {
          $cond: [
            { $gte: ["$priorityScore", 85] },
            "Critical (85-100)",
            {
              $cond: [
                { $gte: ["$priorityScore", 70] },
                "High (70-84)",
                {
                  $cond: [
                    { $gte: ["$priorityScore", 45] },
                    "Medium (45-69)",
                    "Low (0-44)",
                  ],
                },
              ],
            },
          ],
        },
        count: { $sum: 1 },
        averageScore: { $avg: "$priorityScore" },
      },
    },
    {
      $sort: {
        averageScore: -1,
      },
    },
  ]);

  return result.map((item) => ({
    _id: item._id,
    count: item.count,
    averageScore: Math.round(item.averageScore || 0),
  }));
};

module.exports = {
  getSummaryStats,
  getCategoryWiseStats,
  getStatusWiseStats,
  getUrgencyWiseStats,
  getSeverityWiseStats,
  getDepartmentWiseStats,
  getAreaWiseStats,
  getWardWiseStats,
  getSlaComplianceStats,
  getResolutionTrends,
  getRecentComplaints,
  getPriorityScoreStats,
};