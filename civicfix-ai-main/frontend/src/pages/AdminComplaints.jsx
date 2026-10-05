import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileSearch, Search, SlidersHorizontal } from "lucide-react";
import { getAdminComplaints } from "../services/adminPanelService";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import UrgencyBadge from "../components/UrgencyBadge";

const AdminComplaints = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    search: "",
    status: "",
    category: "",
    urgency: "",
    ward: "",
    department: "",
    slaStatus: "",
  });

  const fetchComplaints = async () => {
    setLoading(true);

    try {
      const data = await getAdminComplaints(filters);
      setComplaints(data.complaints || []);
    } catch (error) {
      console.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (event) => {
    setFilters((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  };

  const handleFilterSubmit = (event) => {
    event.preventDefault();
    fetchComplaints();
  };

  if (loading) {
    return <Loader text="Loading admin complaints..." />;
  }

  return (
    <main className="admin-panel-page">
      <section className="admin-panel-header">
        <div>
          <span>Admin Control</span>
          <h1>All Complaints</h1>
          <p>Filter by ward, department, severity, SLA, and review AI triage recommendations.</p>
        </div>
      </section>

      <form className="admin-filter-bar" onSubmit={handleFilterSubmit}>
        <div className="search-box">
          <Search size={18} />
          <input
            name="search"
            placeholder="Search by ID, title, address..."
            value={filters.search}
            onChange={handleChange}
          />
        </div>

        <select name="status" value={filters.status} onChange={handleChange}>
          <option value="">All Status</option>
          <option value="Submitted">Submitted</option>
          <option value="AI Analyzed">AI Analyzed</option>
          <option value="Duplicate Checked">Duplicate Checked</option>
          <option value="Assigned to Department">Assigned to Department</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
          <option value="Escalated">Escalated</option>
          <option value="Closed">Closed</option>
        </select>

        <select name="category" value={filters.category} onChange={handleChange}>
          <option value="">All Categories</option>
          <option value="ROADS_POTHOLES">Roads & Potholes</option>
          <option value="GARBAGE_SOLID_WASTE">Garbage & Solid Waste</option>
          <option value="DRAINAGE_FLOODING">Drainage & Flooding</option>
          <option value="STREETLIGHT">Streetlight</option>
          <option value="WATER_SUPPLY">Water Supply</option>
          <option value="SEWERAGE">Sewerage</option>
          <option value="PUBLIC_HEALTH">Public Health</option>
          <option value="TREE_HAZARD">Tree Hazard</option>
          <option value="ENCROACHMENT">Encroachment</option>
          <option value="road">Road (Legacy)</option>
          <option value="sanitation">Sanitation</option>
          <option value="water">Water</option>
        </select>

        <select name="urgency" value={filters.urgency} onChange={handleChange}>
          <option value="">All Severity</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Critical">Critical</option>
        </select>

        <select name="slaStatus" value={filters.slaStatus} onChange={handleChange}>
          <option value="">All SLA</option>
          <option value="ON_TRACK">On Track</option>
          <option value="AT_RISK">At Risk</option>
          <option value="OVERDUE">Overdue</option>
          <option value="RESOLVED">Resolved</option>
        </select>

        <input
          type="text"
          name="ward"
          placeholder="Filter Ward..."
          style={{ width: "110px", padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--border, #cbd5e1)" }}
          value={filters.ward}
          onChange={handleChange}
        />

        <button className="primary-btn">
          <SlidersHorizontal size={18} />
          Apply
        </button>
      </form>

      {complaints.length === 0 ? (
        <EmptyState title="No complaints found" message="Try different filters." />
      ) : (
        <section className="admin-table-card">
          <div className="table-title">
            <FileSearch size={20} />
            <h2>{complaints.length} Complaints</h2>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Ward</th>
                  <th>Category</th>
                  <th>AI Priority</th>
                  <th>SLA</th>
                  <th>Status</th>
                  <th>Department</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {complaints.map((complaint) => {
                  const score = complaint.priorityScore || complaint.aiScore || 50;
                  const level = complaint.priorityLevel || complaint.urgency || "MEDIUM";
                  const sla = complaint.slaStatus || (complaint.status === "Resolved" ? "RESOLVED" : "ON_TRACK");

                  return (
                    <tr key={complaint._id}>
                      <td>
                        <strong>{complaint.complaintId}</strong>
                        {complaint.isDuplicate && (
                          <span style={{ display: "block", fontSize: "0.68rem", color: "#8b5cf6", fontWeight: "bold" }}>
                            Duplicate
                          </span>
                        )}
                      </td>
                      <td>{complaint.title}</td>
                      <td>{complaint.ward || "General"}</td>
                      <td>{complaint.aiCategory || complaint.category}</td>
                      <td>
                        <span style={{
                          fontWeight: "bold",
                          fontSize: "0.82rem",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: score >= 80 ? "#fee2e2" : score >= 60 ? "#ffedd5" : score >= 40 ? "#fef3c7" : "#dcfce7",
                          color: score >= 80 ? "#b91c1c" : score >= 60 ? "#c2410c" : score >= 40 ? "#b45309" : "#15803d"
                        }}>
                          {score}/100 ({level})
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: "0.75rem",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontWeight: "bold",
                          background: sla === "OVERDUE" ? "#fee2e2" : sla === "AT_RISK" ? "#fef3c7" : "#dcfce7",
                          color: sla === "OVERDUE" ? "#dc2626" : sla === "AT_RISK" ? "#b45309" : "#15803d"
                        }}>
                          {sla}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={complaint.status} />
                      </td>
                      <td>{complaint.department}</td>
                      <td>
                        <Link
                          className="table-action-link"
                          to={`/admin/complaints/${complaint._id}`}
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
};

export default AdminComplaints;