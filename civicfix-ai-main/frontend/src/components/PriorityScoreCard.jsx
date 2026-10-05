import { Brain, CheckCircle2, Clock, Info, ShieldAlert } from "lucide-react";
import UrgencyBadge from "./UrgencyBadge";

const PriorityScoreCard = ({ analysis }) => {
  if (!analysis) {
    return null;
  }

  // Handle both new normalized structure and legacy structure
  const categoryName = typeof analysis.category === "object" ? analysis.category.value : analysis.category;
  const categoryConfidence = typeof analysis.category === "object" && analysis.category.confidence
    ? Math.round(analysis.category.confidence * 100)
    : null;

  const severityName = typeof analysis.severity === "object"
    ? analysis.severity.value
    : (analysis.urgency || "MEDIUM");
  const severityConfidence = typeof analysis.severity === "object" && analysis.severity.confidence
    ? Math.round(analysis.severity.confidence * 100)
    : null;

  const departmentName = typeof analysis.department === "object" ? analysis.department.value : analysis.department;
  const departmentReason = typeof analysis.department === "object" ? analysis.department.reason : null;

  const priorityScore = analysis.priority?.score ?? analysis.aiScore ?? 50;
  const priorityLevel = analysis.priority?.level ?? (priorityScore >= 80 ? "CRITICAL" : priorityScore >= 60 ? "HIGH" : priorityScore >= 40 ? "MEDIUM" : "LOW");
  const priorityReasons = analysis.priority?.reasons || analysis.riskFactors || [];

  const slaHours = analysis.sla?.hours || (priorityLevel === "CRITICAL" ? 4 : priorityLevel === "HIGH" ? 24 : priorityLevel === "MEDIUM" ? 72 : 168);
  const slaStatus = analysis.sla?.status || "ON_TRACK";

  return (
    <div className="priority-score-card">
      <div className="priority-top">
        <div>
          <span>AI Triage Analysis</span>
          <h3>{priorityScore}/100</h3>
          <small style={{ color: "var(--muted, #64748b)", fontSize: "0.8rem" }}>
            Priority: <b>{priorityLevel}</b>
          </small>
        </div>

        <div className="priority-icon">
          <Brain size={28} />
        </div>
      </div>

      <div className="priority-row">
        <p>Category</p>
        <strong>
          {categoryName || "ROADS_POTHOLES"}
          {categoryConfidence && (
            <span style={{ fontSize: "0.75rem", fontWeight: "normal", color: "#64748b", marginLeft: "6px" }}>
              ({categoryConfidence}% conf)
            </span>
          )}
        </strong>
      </div>

      <div className="priority-row">
        <p>Severity</p>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <UrgencyBadge urgency={severityName} />
          {severityConfidence && (
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
              ({severityConfidence}%)
            </span>
          )}
        </div>
      </div>

      <div className="priority-row">
        <p>Department</p>
        <strong>{departmentName}</strong>
      </div>

      <div className="priority-row">
        <p>Estimated SLA</p>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Clock size={15} style={{ color: "#3b82f6" }} />
          <strong>{slaHours} hrs</strong>
          <span style={{
            fontSize: "0.7rem",
            padding: "2px 6px",
            borderRadius: "4px",
            background: slaStatus === "OVERDUE" ? "#fee2e2" : slaStatus === "AT_RISK" ? "#fef3c7" : "#dcfce7",
            color: slaStatus === "OVERDUE" ? "#b91c1c" : slaStatus === "AT_RISK" ? "#b45309" : "#15803d",
            fontWeight: "bold"
          }}>
            {slaStatus}
          </span>
        </div>
      </div>

      {departmentReason && (
        <div className="priority-reason" style={{ marginTop: "10px" }}>
          <Info size={16} style={{ color: "#0ea5e9", flexShrink: 0 }} />
          <p style={{ fontSize: "0.85rem", color: "#475569" }}>{departmentReason}</p>
        </div>
      )}

      {priorityReasons.length > 0 && (
        <div style={{ marginTop: "12px", borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: "10px" }}>
          <p style={{ fontSize: "0.8rem", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>
            Why this score?
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {priorityReasons.map((reason, idx) => (
              <li key={idx} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "#334155", marginBottom: "4px" }}>
                <CheckCircle2 size={13} style={{ color: "#10b981", flexShrink: 0 }} />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.aiReason && !departmentReason && priorityReasons.length === 0 && (
        <div className="priority-reason">
          <ShieldAlert size={18} />
          <p>{analysis.aiReason}</p>
        </div>
      )}

      <div style={{ marginTop: "12px", paddingTop: "8px", borderTop: "1px dashed rgba(0,0,0,0.08)", fontSize: "0.72rem", color: "#94a3b8" }}>
        AI-assisted recommendation. Official municipal assessment pending.
      </div>
    </div>
  );
};

export default PriorityScoreCard;