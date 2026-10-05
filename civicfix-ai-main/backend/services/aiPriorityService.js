const PriorityScore = require("../models/PriorityScore");
const { analyzeComplaintWithGemma } = require("./gemmaService");

const analyzeAndSavePriority = async ({
  complaint = null,
  complaintId = "",
  title,
  description,
  selectedCategory = "",
}) => {
  const analysis = await analyzeComplaintWithGemma({
    title,
    description,
    selectedCategory,
  });

  const priorityScore = await PriorityScore.create({
    complaint: complaint ? complaint._id : null,
    complaintId: complaintId || (complaint ? complaint.complaintId : ""),
    category: analysis.category,
    score: analysis.aiScore,
    urgencyLevel: analysis.urgency,
    detectedKeywords: analysis.detectedKeywords,
    riskFactors: analysis.riskFactors,
    department: analysis.department,
    aiReason: analysis.aiReason,
    analysisSource: analysis.analysisSource || "gemma_api",
  });

  return {
    analysis,
    priorityScore,
  };
};

const analyzeOnly = async ({ title, description, selectedCategory = "" }) => {
  return await analyzeComplaintWithGemma({
    title,
    description,
    selectedCategory,
  });
};

module.exports = {
  analyzeAndSavePriority,
  analyzeOnly,
};