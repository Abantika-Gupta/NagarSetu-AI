import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  MapPinned,
  RefreshCw,
  Search,
  X,
  Filter,
  Layers,
  MapPin,
  Flame,
  CheckCircle2,
  Clock,
  ExternalLink,
} from "lucide-react";
import { getPublicHeatmapData } from "../services/heatmapService";
import MapComponent from "../components/MapComponent";
import HeatmapLegend from "../components/HeatmapLegend";
import Loader from "../components/Loader";
import StatusBadge from "../components/StatusBadge";
import UrgencyBadge from "../components/UrgencyBadge";

const MapView = () => {
  const [zones, setZones] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Search & Filter States
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [quickFilter, setQuickFilter] = useState("all");
  const [selectedZone, setSelectedZone] = useState(null);
  const [activeMarkerId, setActiveMarkerId] = useState(null);
  const [viewMode, setViewMode] = useState("both"); // 'both' | 'markers' | 'heatmap'
  const [zoneSearch, setZoneSearch] = useState("");

  const fetchHeatmap = async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const data = await getPublicHeatmapData();
      setZones(data.zones || []);
      setMarkers(data.markers || []);
    } catch (error) {
      console.error("Heatmap fetch error:", error.message);
      setFetchError("Unable to load complaint locations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeatmap();
  }, []);

  // Filter complaints based on Search, Dropdown filters, Quick Filter tags, and Selected Zone
  const filteredMarkers = useMemo(() => {
    return markers.filter((marker) => {
      // 1. Text keyword search across title, ID, category, ward, address, city, department, status, urgency
      if (keyword.trim()) {
        const query = keyword.toLowerCase().trim();
        const searchable = [
          marker.title || "",
          marker.complaintId || "",
          marker.category || "",
          marker.ward || "",
          marker.location?.address || "",
          marker.location?.city || "",
          marker.location?.state || "",
          marker.department || "",
          marker.status || "",
          marker.urgency || "",
        ]
          .join(" ")
          .toLowerCase();

        if (!searchable.includes(query)) {
          return false;
        }
      }

      // 2. Status filter
      if (statusFilter) {
        if (statusFilter === "OPEN") {
          const isOpen = ["Submitted", "Assigned", "In Progress", "Escalated"].includes(
            marker.status
          );
          if (!isOpen) return false;
        } else if (statusFilter === "PENDING") {
          const isPending = ["Submitted", "Assigned"].includes(marker.status);
          if (!isPending) return false;
        } else if (statusFilter === "RESOLVED") {
          const isResolved = [
            "Resolved",
            "Citizen Verified",
            "Closed",
          ].includes(marker.status);
          if (!isResolved) return false;
        } else if (marker.status !== statusFilter) {
          return false;
        }
      }

      // 3. Urgency filter
      if (urgencyFilter && marker.urgency !== urgencyFilter) {
        return false;
      }

      // 4. Category filter
      if (categoryFilter && marker.category?.toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }

      // 5. Quick Filter tags
      if (quickFilter === "critical") {
        if (marker.urgency !== "Critical" && marker.urgency !== "High") return false;
      } else if (quickFilter === "overdue") {
        if (!marker.isOverdue && marker.slaStatus !== "OVERDUE") return false;
      } else if (quickFilter === "road") {
        if (marker.category?.toLowerCase() !== "road") return false;
      } else if (quickFilter === "resolved") {
        const isResolved = ["Resolved", "Citizen Verified", "Closed"].includes(marker.status);
        if (!isResolved) return false;
      } else if (quickFilter === "kolkata") {
        const isKolkata =
          marker.location?.city?.toLowerCase() === "kolkata" ||
          marker.location?.address?.toLowerCase().includes("kolkata") ||
          marker.ward?.toLowerCase().includes("kolkata") ||
          marker.ward?.toLowerCase().includes("agarpara") ||
          marker.ward?.toLowerCase().includes("rajarhat") ||
          marker.ward?.toLowerCase().includes("salt lake");
        if (!isKolkata) return false;
      }

      // 6. Selected Area Zone filter
      if (selectedZone) {
        const inZoneComplaints =
          Array.isArray(selectedZone.complaints) &&
          (selectedZone.complaints.includes(marker.id) ||
            selectedZone.complaints.includes(marker.complaintId));

        const matchesZoneName =
          marker.ward?.toLowerCase() === selectedZone.zoneName.toLowerCase() ||
          marker.location?.address?.toLowerCase().includes(selectedZone.zoneName.toLowerCase()) ||
          marker.location?.city?.toLowerCase() === selectedZone.zoneName.toLowerCase();

        if (!inZoneComplaints && !matchesZoneName) {
          return false;
        }
      }

      return true;
    });
  }, [markers, keyword, statusFilter, urgencyFilter, categoryFilter, quickFilter, selectedZone]);

  // Area zones filtered by zone search input
  const filteredZones = useMemo(() => {
    if (!zoneSearch.trim()) return zones;
    const query = zoneSearch.toLowerCase().trim();
    return zones.filter(
      (z) =>
        z.zoneName?.toLowerCase().includes(query) ||
        z.area?.toLowerCase().includes(query) ||
        z.heatLevel?.toLowerCase().includes(query)
    );
  }, [zones, zoneSearch]);

  const redZones = zones.filter((z) => z.heatLevel === "Red").length;
  const yellowZones = zones.filter((z) => z.heatLevel === "Yellow").length;
  const greenZones = zones.filter((z) => z.heatLevel === "Green").length;
  const overdueCount = markers.filter((m) => m.isOverdue || m.slaStatus === "OVERDUE").length;
  const criticalCount = markers.filter((m) => m.urgency === "Critical" || m.urgency === "High").length;
  const resolvedCount = markers.filter((m) =>
    ["Resolved", "Citizen Verified", "Closed"].includes(m.status)
  ).length;

  const handleZoneClick = (zone) => {
    if (selectedZone && selectedZone.zoneName === zone.zoneName && selectedZone.area === zone.area) {
      setSelectedZone(null); // Toggle off if already selected
    } else {
      setSelectedZone(zone);
      setActiveMarkerId(null);
    }
  };

  const clearAllFilters = () => {
    setKeyword("");
    setStatusFilter("");
    setUrgencyFilter("");
    setCategoryFilter("");
    setQuickFilter("all");
    setSelectedZone(null);
    setActiveMarkerId(null);
  };

  const handleCardClick = (marker) => {
    setActiveMarkerId(marker.id || marker.complaintId);
    // Smooth scroll to map if user is further down
    const mapElement = document.querySelector(".map-card");
    if (mapElement) {
      mapElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const isFiltered =
    Boolean(keyword.trim()) ||
    Boolean(statusFilter) ||
    Boolean(urgencyFilter) ||
    Boolean(categoryFilter) ||
    quickFilter !== "all" ||
    Boolean(selectedZone);

  if (loading) {
    return <Loader text="Loading live civic issue map..." />;
  }

  return (
    <main className="map-page">
      {/* Top Header */}
      <section className="map-header">
        <div>
          <span>CivicFix / NagarSetu Public Map</span>
          <h1>Live Civic Issue Map</h1>
          <p>
            Interactive geospatial dashboard showing real citizen complaints, density heatmaps, AI priority scoring, and area-wise civic health zones.
          </p>
        </div>

        <button className="secondary-action-btn" onClick={fetchHeatmap} title="Refresh live map data">
          <RefreshCw size={18} />
          Refresh Data
        </button>
      </section>

      {/* Summary Metrics Grid */}
      <section className="map-summary-grid">
        <div className="map-summary-card red-zone-card">
          <strong>{redZones}</strong>
          <span>🔴 Red Zones</span>
        </div>

        <div className="map-summary-card yellow-zone-card">
          <strong>{yellowZones}</strong>
          <span>🟠 Yellow Zones</span>
        </div>

        <div className="map-summary-card green-zone-card">
          <strong>{greenZones}</strong>
          <span>🟢 Green Zones</span>
        </div>

        <div className="map-summary-card" style={{ borderColor: "#dc2626" }}>
          <strong style={{ color: "#dc2626" }}>{overdueCount}</strong>
          <span>⚠️ SLA Overdue</span>
        </div>

        <div className="map-summary-card" style={{ borderColor: "#2563eb" }}>
          <strong style={{ color: "#2563eb" }}>{markers.length}</strong>
          <span>📍 Total Markers</span>
        </div>
      </section>

      {/* Top Search & Filter Bar (Matching Section 2 & 3 Target Layout) */}
      <section className="map-top-search-section">
        <div className="main-search-bar">
          <Search size={22} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by title, category, area, address, ID, status..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          {keyword && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setKeyword("")}
              title="Clear search"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Dropdown Filters & Quick Filter Tags */}
        <div className="map-filters-row">
          <div className="filter-dropdown-group">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="map-filter-select"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open Issues</option>
              <option value="PENDING">Pending (Submitted/Assigned)</option>
              <option value="In Progress">In Progress</option>
              <option value="RESOLVED">Resolved / Verified</option>
              <option value="Escalated">Escalated</option>
            </select>

            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="map-filter-select"
            >
              <option value="">All Urgencies</option>
              <option value="Critical">🔴 Critical Urgency</option>
              <option value="High">🟠 High Urgency</option>
              <option value="Medium">🟡 Medium Urgency</option>
              <option value="Low">🟢 Low Urgency</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="map-filter-select"
            >
              <option value="">All Categories</option>
              <option value="road">Road & Potholes</option>
              <option value="sanitation">Sanitation & Garbage</option>
              <option value="drainage">Drainage & Sewerage</option>
              <option value="electricity">Streetlight & Electricity</option>
              <option value="water">Water Supply</option>
              <option value="health">Public Health & Hygiene</option>
              <option value="traffic">Traffic & Encroachment</option>
              <option value="environment">Parks & Environment</option>
              <option value="safety">Public Safety</option>
              <option value="other">Other Civic Issues</option>
            </select>

            {isFiltered && (
              <button
                type="button"
                className="clear-all-btn"
                onClick={clearAllFilters}
                title="Reset all search and filters"
              >
                <X size={15} /> Clear Filters
              </button>
            )}
          </div>

          {/* Quick Filter Tag Pills */}
          <div className="quick-filter-pills">
            <button
              type="button"
              className={`pill-btn ${quickFilter === "all" ? "active" : ""}`}
              onClick={() => setQuickFilter("all")}
            >
              All ({markers.length})
            </button>
            <button
              type="button"
              className={`pill-btn ${quickFilter === "critical" ? "active" : ""}`}
              onClick={() => setQuickFilter(quickFilter === "critical" ? "all" : "critical")}
            >
              🔴 Critical ({criticalCount})
            </button>
            <button
              type="button"
              className={`pill-btn ${quickFilter === "overdue" ? "active" : ""}`}
              onClick={() => setQuickFilter(quickFilter === "overdue" ? "all" : "overdue")}
            >
              ⚠️ Overdue ({overdueCount})
            </button>
            <button
              type="button"
              className={`pill-btn ${quickFilter === "road" ? "active" : ""}`}
              onClick={() => setQuickFilter(quickFilter === "road" ? "all" : "road")}
            >
              🛣️ Roads
            </button>
            <button
              type="button"
              className={`pill-btn ${quickFilter === "resolved" ? "active" : ""}`}
              onClick={() => setQuickFilter(quickFilter === "resolved" ? "all" : "resolved")}
            >
              ✅ Resolved ({resolvedCount})
            </button>
            <button
              type="button"
              className={`pill-btn ${quickFilter === "kolkata" ? "active" : ""}`}
              onClick={() => setQuickFilter(quickFilter === "kolkata" ? "all" : "kolkata")}
            >
              📍 Kolkata Focus
            </button>
          </div>
        </div>
      </section>

      {/* Main Map & Side Panels Section (Section 2 Layout) */}
      <section className="map-layout">
        {/* Large Interactive Map (Left / Center) */}
        <div className="map-card">
          {selectedZone && (
            <div className="active-zone-banner">
              <div className="active-zone-banner-info">
                <span className={`zone-dot-indicator dot-${selectedZone.heatLevel.toLowerCase()}`}></span>
                <span>
                  Filtering by Area: <strong>{selectedZone.zoneName}</strong> ({selectedZone.area}) •{" "}
                  <b>{filteredMarkers.length}</b> complaints visible
                </span>
              </div>
              <button
                type="button"
                className="banner-close-btn"
                onClick={() => setSelectedZone(null)}
                title="Clear Area Filter"
              >
                <X size={16} /> Clear Area Filter
              </button>
            </div>
          )}

          {fetchError ? (
            <div className="map-token-missing">
              <AlertTriangle size={42} color="#ef4444" style={{ marginBottom: "14px" }} />
              <h3>Unable to load complaint locations.</h3>
              <p>Could not connect to the complaint heatmap service. Please verify backend connectivity.</p>
              <button className="secondary-action-btn" onClick={fetchHeatmap} style={{ marginTop: "14px" }}>
                Retry Connection
              </button>
            </div>
          ) : markers.length === 0 ? (
            <div className="map-token-missing">
              <AlertTriangle size={42} color="#f59e0b" style={{ marginBottom: "14px" }} />
              <h3>No complaints available.</h3>
              <p>There are no civic complaints currently recorded in the system.</p>
            </div>
          ) : (
            <MapComponent
              markers={filteredMarkers}
              selectedZone={selectedZone}
              activeMarkerId={activeMarkerId}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onMarkerSelect={(id) => setActiveMarkerId(id)}
            />
          )}
        </div>

        {/* Right-Side Panels: Heatmap Legend + Area Zones */}
        <aside className="map-side">
          {/* Heatmap Legend */}
          <HeatmapLegend />

          {/* Area Zones Panel (Real data from actual complaints) */}
          <div className="zone-list-card">
            <div className="zone-card-header">
              <div>
                <h3>Area Zones</h3>
                <span className="zone-count-subtext">{zones.length} active civic zones</span>
              </div>
              {selectedZone && (
                <button
                  type="button"
                  className="zone-clear-link"
                  onClick={() => setSelectedZone(null)}
                >
                  Show All
                </button>
              )}
            </div>

            <div className="zone-search-box">
              <Search size={15} />
              <input
                type="text"
                placeholder="Filter zones by name or city..."
                value={zoneSearch}
                onChange={(e) => setZoneSearch(e.target.value)}
              />
              {zoneSearch && (
                <button onClick={() => setZoneSearch("")} className="clear-mini-btn">
                  <X size={13} />
                </button>
              )}
            </div>

            {fetchError ? (
              <div className="zone-empty">
                <AlertTriangle size={24} />
                <p>Unable to load zone data.</p>
              </div>
            ) : zones.length === 0 ? (
              <div className="zone-empty">
                <AlertTriangle size={24} />
                <p>No zone data yet. Submit complaints with location.</p>
              </div>
            ) : filteredZones.length === 0 ? (
              <div className="zone-empty">
                <p>No area zones match &quot;{zoneSearch}&quot;.</p>
              </div>
            ) : (
              <div className="zone-list">
                {filteredZones.slice(0, 15).map((zone) => {
                  const isSelected =
                    selectedZone &&
                    selectedZone.zoneName === zone.zoneName &&
                    selectedZone.area === zone.area;

                  return (
                    <div
                      className={`zone-item ${isSelected ? "selected-zone" : ""}`}
                      key={`${zone.zoneName}-${zone.area}`}
                      onClick={() => handleZoneClick(zone)}
                      title="Click to zoom map and filter complaints in this area"
                    >
                      <div className="zone-info-block">
                        <div className="zone-name-row">
                          <span
                            className={`zone-dot-indicator dot-${zone.heatLevel.toLowerCase()}`}
                          ></span>
                          <h4>{zone.zoneName}</h4>
                        </div>
                        <p className="zone-location-sub">
                          {zone.area} • <strong>{zone.totalComplaints}</strong> complaints
                          {zone.pendingCount > 0 ? ` (${zone.pendingCount} pending)` : " (All resolved)"}
                        </p>
                      </div>

                      <span className={`zone-pill zone-${zone.heatLevel.toLowerCase()}`}>
                        {zone.heatLevel}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </section>

      {/* Visible Complaint Markers List / Detailed Cards */}
      <section className="marker-list-section">
        <div className="marker-section-header">
          <div>
            <h2>
              <MapPinned size={24} color="#2563eb" />
              Complaint Markers ({filteredMarkers.length})
            </h2>
            <p className="marker-sub">
              {isFiltered
                ? `Showing ${filteredMarkers.length} of ${markers.length} complaints matching current filters`
                : `All ${markers.length} real complaints plotted with verified coordinates`}
            </p>
          </div>

          {isFiltered && (
            <button className="secondary-action-btn" onClick={clearAllFilters}>
              Reset All Filters
            </button>
          )}
        </div>

        {fetchError ? (
          <p className="marker-empty">Unable to load complaint locations.</p>
        ) : markers.length === 0 ? (
          <p className="marker-empty">No complaints available.</p>
        ) : filteredMarkers.length === 0 ? (
          <div className="no-filter-match-box">
            <AlertTriangle size={32} color="#f59e0b" />
            <p>No complaints match your search or filter criteria.</p>
            <button className="primary-action-btn" onClick={clearAllFilters} style={{ marginTop: "12px" }}>
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="marker-list-grid">
            {filteredMarkers.slice(0, 15).map((marker) => {
              const isActive = activeMarkerId === marker.id || activeMarkerId === marker.complaintId;
              const formattedDate = marker.createdAt
                ? new Date(marker.createdAt).toLocaleDateString("en-IN", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "Recent";

              return (
                <div
                  className={`marker-card ${isActive ? "active-marker-card" : ""}`}
                  key={marker.id || marker.complaintId}
                  onClick={() => handleCardClick(marker)}
                >
                  <div className="marker-card-top">
                    <span className="complaint-id">{marker.complaintId || "CFX-RECORD"}</span>
                    <span className="marker-ai-score" title="AI Priority Score">
                      AI Score: <strong>{marker.aiScore ?? 50}/100</strong>
                    </span>
                  </div>

                  <h3>{marker.title}</h3>

                  <div className="marker-badges">
                    <UrgencyBadge urgency={marker.urgency} />
                    <StatusBadge status={marker.status} />
                  </div>

                  <p className="marker-address">{marker.location?.address || marker.ward || "Location Captured"}</p>

                  <div className="marker-footer">
                    <small className="marker-department">{marker.department || "General Civic"}</small>
                    <button
                      type="button"
                      className="view-map-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCardClick(marker);
                      }}
                      title="Focus on map"
                    >
                      View on Map
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
};

export default MapView;