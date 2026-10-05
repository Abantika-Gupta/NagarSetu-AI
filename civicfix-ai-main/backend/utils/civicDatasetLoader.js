const fs = require("fs");
const path = require("path");
const { COMPLAINT_CATEGORIES } = require("../constants/complaintCategories");
const { DEPARTMENT_TYPES } = require("../constants/departmentTypes");
const { URGENCY_LEVELS } = require("../constants/urgencyLevels");
const { COMPLAINT_STATUS } = require("../constants/complaintStatus");

const isValidCoordinate = (lat, lng) => {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  const nLat = Number(lat);
  const nLng = Number(lng);
  return (
    !isNaN(nLat) &&
    !isNaN(nLng) &&
    nLat >= -90 &&
    nLat <= 90 &&
    nLng >= -180 &&
    nLng <= 180
  );
};

function parseCSV(content) {
  const rows = [];
  let currentRow = [];
  let currentVal = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      currentRow.push(currentVal.trim());
      if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    rows.push(currentRow);
  }

  if (rows.length < 2) return [];

  const headers = rows[0];
  const result = [];
  for (let r = 1; r < rows.length; r++) {
    const rowValues = rows[r];
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = rowValues[idx] || "";
    });
    result.push(obj);
  }
  return result;
}

const mapNycCategory = (canonicalCat, complaintType) => {
  const c = (canonicalCat || "").toUpperCase();
  if (c.includes("ROAD") || c.includes("POTHOLE")) return COMPLAINT_CATEGORIES.ROAD;
  if (c.includes("GARBAGE") || c.includes("WASTE") || c.includes("SANITATION")) return COMPLAINT_CATEGORIES.SANITATION;
  if (c.includes("DRAINAGE") || c.includes("FLOOD") || c.includes("SEWER")) return COMPLAINT_CATEGORIES.DRAINAGE;
  if (c.includes("STREETLIGHT") || c.includes("ELECTRIC")) return COMPLAINT_CATEGORIES.ELECTRICITY;
  if (c.includes("WATER")) return COMPLAINT_CATEGORIES.WATER;
  if (c.includes("AIR") || c.includes("NOISE") || c.includes("TREE") || c.includes("ENVIRONMENT")) return COMPLAINT_CATEGORIES.ENVIRONMENT;
  if (c.includes("HEALTH") || c.includes("RODENT")) return COMPLAINT_CATEGORIES.HEALTH;
  if (c.includes("ENCROACHMENT") || c.includes("TRAFFIC")) return COMPLAINT_CATEGORIES.TRAFFIC;
  if (c.includes("SAFETY") || c.includes("CONSTRUCTION") || c.includes("ANIMAL")) return COMPLAINT_CATEGORIES.SAFETY;

  const type = (complaintType || "").toLowerCase();
  if (type.includes("noise") || type.includes("air")) return COMPLAINT_CATEGORIES.ENVIRONMENT;
  if (type.includes("park") || type.includes("traffic") || type.includes("vehicle")) return COMPLAINT_CATEGORIES.TRAFFIC;
  if (type.includes("street") || type.includes("pothole") || type.includes("sidewalk")) return COMPLAINT_CATEGORIES.ROAD;
  if (type.includes("sanitation") || type.includes("dirty") || type.includes("waste")) return COMPLAINT_CATEGORIES.SANITATION;
  if (type.includes("water")) return COMPLAINT_CATEGORIES.WATER;
  if (type.includes("sewer") || type.includes("drain")) return COMPLAINT_CATEGORIES.DRAINAGE;
  return COMPLAINT_CATEGORIES.OTHER;
};

const mapNycDepartment = (category) => {
  switch (category) {
    case COMPLAINT_CATEGORIES.ROAD:
      return DEPARTMENT_TYPES.ROAD_MAINTENANCE;
    case COMPLAINT_CATEGORIES.SANITATION:
      return DEPARTMENT_TYPES.SANITATION;
    case COMPLAINT_CATEGORIES.DRAINAGE:
      return DEPARTMENT_TYPES.DRAINAGE;
    case COMPLAINT_CATEGORIES.ELECTRICITY:
      return DEPARTMENT_TYPES.STREETLIGHT_ELECTRICITY;
    case COMPLAINT_CATEGORIES.WATER:
      return DEPARTMENT_TYPES.WATER_SUPPLY;
    case COMPLAINT_CATEGORIES.TRAFFIC:
      return DEPARTMENT_TYPES.TRAFFIC;
    case COMPLAINT_CATEGORIES.HEALTH:
      return DEPARTMENT_TYPES.HEALTH_HYGIENE;
    case COMPLAINT_CATEGORIES.ENVIRONMENT:
      return DEPARTMENT_TYPES.PARKS_ENVIRONMENT;
    case COMPLAINT_CATEGORIES.SAFETY:
      return DEPARTMENT_TYPES.PUBLIC_SAFETY;
    default:
      return DEPARTMENT_TYPES.GENERAL_CIVIC;
  }
};

const mapNycUrgency = (complaintType, descriptor) => {
  const text = `${complaintType} ${descriptor}`.toLowerCase();
  if (text.includes("burst") || text.includes("danger") || text.includes("shock") || text.includes("collapse") || text.includes("hazard")) {
    return URGENCY_LEVELS.CRITICAL;
  }
  if (text.includes("blocked") || text.includes("choked") || text.includes("overflow") || text.includes("banging") || text.includes("loud")) {
    return URGENCY_LEVELS.HIGH;
  }
  if (text.includes("dirty") || text.includes("homeless") || text.includes("pothole") || text.includes("repair")) {
    return URGENCY_LEVELS.MEDIUM;
  }
  return URGENCY_LEVELS.LOW;
};

let cachedComplaints = null;

const loadComplaintsFromDataset = () => {
  if (cachedComplaints) {
    return cachedComplaints;
  }

  const complaints = [];
  const rootDataDir = path.resolve(__dirname, "../../data");

  // 1. Load NYC 311 dataset (has 495 valid WGS84 geographic coordinates)
  const nycCleanedPath = path.join(rootDataDir, "interim/nyc_cleaned.csv");
  const nycRawPath = path.join(rootDataDir, "raw/nyc_311/311_service_requests.csv");
  const nycPath = fs.existsSync(nycCleanedPath) ? nycCleanedPath : (fs.existsSync(nycRawPath) ? nycRawPath : null);

  if (nycPath) {
    try {
      const content = fs.readFileSync(nycPath, "utf8");
      const records = parseCSV(content);

      records.forEach((row, index) => {
        const uniqueKey = row.unique_key || row.UniqueKey || String(index + 1);
        const complaintType = row.complaint_type || row.ComplaintType || "Civic Grievance";
        const descriptor = row.descriptor || row.Descriptor || "";
        const address = row.incident_address || row.street_name || row.IncidentAddress || "Main Street";
        const borough = row.borough || row.Borough || row.city || "Urban District";
        const rawLat = parseFloat(row.latitude || row.Latitude);
        const rawLng = parseFloat(row.longitude || row.Longitude);
        const hasCoords = isValidCoordinate(rawLat, rawLng);

        const category = mapNycCategory(row.canonical_category, complaintType);
        const department = mapNycDepartment(category);
        const urgency = mapNycUrgency(complaintType, descriptor);

        let status = COMPLAINT_STATUS.ASSIGNED;
        const rawStatus = (row.status || "").toLowerCase();
        if (rawStatus.includes("closed") || rawStatus.includes("resolved")) {
          status = COMPLAINT_STATUS.RESOLVED;
        } else if (rawStatus.includes("progress")) {
          status = COMPLAINT_STATUS.IN_PROGRESS;
        }

        const aiScore =
          urgency === URGENCY_LEVELS.CRITICAL ? 88 :
          urgency === URGENCY_LEVELS.HIGH ? 72 :
          urgency === URGENCY_LEVELS.MEDIUM ? 50 : 25;

        complaints.push({
          _id: `nyc_${uniqueKey}`,
          complaintId: `NYC-311-${uniqueKey}`,
          title: `${complaintType}${descriptor ? ": " + descriptor : ""}`.slice(0, 100),
          description: `${complaintType} reported at ${address}, ${borough}. ${descriptor ? "Details: " + descriptor + "." : ""} Agency assigned: ${row.agency_name || row.agency || "City Public Services"}.`,
          category,
          urgency,
          aiScore,
          priorityScore: aiScore,
          priorityLevel: urgency,
          priorityReasons: [
            `Reported via municipal OpenData API`,
            `Assigned to ${department}`,
            `Urgency calibrated at ${urgency}`,
          ],
          department,
          imageUrl: "",
          images: [],
          hasImage: false,
          imageCount: 0,
          location: {
            address: `${address}, ${borough}`,
            city: borough,
            state: "NY",
            lat: hasCoords ? rawLat : null,
            lng: hasCoords ? rawLng : null,
          },
          ward: borough,
          zone: row.community_board || `Zone ${borough}`,
          complaintChannel: row.open_data_channel_type || "Public OpenData",
          status,
          slaHours: urgency === URGENCY_LEVELS.CRITICAL ? 24 : urgency === URGENCY_LEVELS.HIGH ? 48 : 72,
          slaDeadline: new Date(Date.now() + 48 * 3600 * 1000),
          slaStatus: status === COMPLAINT_STATUS.RESOLVED ? "RESOLVED" : "ON_TRACK",
          duplicateOf: null,
          duplicateGroupId: `GRP_NYC_${uniqueKey}`,
          createdAt: row.created_date ? new Date(row.created_date) : new Date(),
        });
      });
    } catch (err) {
      console.error("Error loading NYC 311 dataset:", err.message);
    }
  }

  // 2. Load BMC Mumbai dataset (1,000 real municipal records)
  const bmcCleanedPath = path.join(rootDataDir, "interim/bmc_cleaned.csv");
  const bmcRawPath = path.join(rootDataDir, "raw/bmc/bmc_train.csv");
  const bmcProcessedPath = path.join(rootDataDir, "processed/complaints.csv");
  const bmcPath = fs.existsSync(bmcCleanedPath) ? bmcCleanedPath : (fs.existsSync(bmcRawPath) ? bmcRawPath : (fs.existsSync(bmcProcessedPath) ? bmcProcessedPath : null));

  if (bmcPath) {
    try {
      const content = fs.readFileSync(bmcPath, "utf8");
      const records = parseCSV(content);

      records.forEach((row, index) => {
        const extId = row.external_id || row.complaint_id || `BMC_${index + 1}`;
        const ward = row.ward || row.ward_code || "General Ward";
        const zone = row.zone || "Zone 1";
        const rawSeverity = (row.severity || "").toLowerCase();
        const urgency =
          rawSeverity === "critical" ? URGENCY_LEVELS.CRITICAL :
          rawSeverity === "high" ? URGENCY_LEVELS.HIGH :
          rawSeverity === "low" ? URGENCY_LEVELS.LOW : URGENCY_LEVELS.MEDIUM;

        const category = row.legacy_category || COMPLAINT_CATEGORIES.OTHER;
        const department = row.department || row.department_assigned || "General Civic Department";

        let status = COMPLAINT_STATUS.ASSIGNED;
        const rawStatus = (row.complaint_status || "").toLowerCase();
        if (rawStatus.includes("resolved")) status = COMPLAINT_STATUS.RESOLVED;
        else if (rawStatus.includes("closed")) status = COMPLAINT_STATUS.CLOSED;
        else if (rawStatus.includes("progress")) status = COMPLAINT_STATUS.IN_PROGRESS;

        const aiScore =
          urgency === URGENCY_LEVELS.CRITICAL ? 90 :
          urgency === URGENCY_LEVELS.HIGH ? 75 :
          urgency === URGENCY_LEVELS.MEDIUM ? 50 : 25;

        complaints.push({
          _id: `bmc_${extId}`,
          complaintId: extId,
          title: (row.description || `BMC Civic Grievance in ${ward}`).slice(0, 90),
          description: row.description || `Civic issue reported in ${ward}, ${zone}.`,
          category,
          urgency,
          aiScore,
          priorityScore: aiScore,
          priorityLevel: urgency,
          priorityReasons: [
            `BMC municipal grievance record`,
            `Located in ${ward}, ${zone}`,
            `Severity level: ${urgency}`,
          ],
          department,
          imageUrl: "",
          images: [],
          hasImage: false,
          imageCount: 0,
          location: {
            address: `${ward} Area, Mumbai`,
            city: "Mumbai",
            state: "Maharashtra",
            lat: null, // BMC source dataset does not have explicit GPS coordinates; keep null to avoid fabricating
            lng: null,
          },
          ward,
          zone,
          complaintChannel: row.complaint_channel || "Web Portal",
          status,
          slaHours: urgency === URGENCY_LEVELS.CRITICAL ? 24 : urgency === URGENCY_LEVELS.HIGH ? 48 : 72,
          slaDeadline: new Date(Date.now() + 48 * 3600 * 1000),
          slaStatus: status === COMPLAINT_STATUS.RESOLVED || status === COMPLAINT_STATUS.CLOSED ? "RESOLVED" : "ON_TRACK",
          duplicateOf: null,
          duplicateGroupId: `GRP_${extId}`,
          createdAt: row.complaint_date ? new Date(row.complaint_date) : new Date(),
        });
      });
    } catch (err) {
      console.error("Error loading BMC dataset:", err.message);
    }
  }

  // 3. Kolkata benchmark records (documented in ALL DOCS.txt, matching reference screenshot)
  const kolkataRecords = [
    {
      _id: "cfx_2026_015842",
      complaintId: "CFX-2026-015842",
      title: "Road Fix please It's Urgent!",
      description: "Severe road damage and uneven potholes near Agarpara main gate causing traffic accidents and vehicle damage.",
      category: COMPLAINT_CATEGORIES.ROAD,
      urgency: URGENCY_LEVELS.LOW,
      aiScore: 35,
      priorityScore: 35,
      priorityLevel: URGENCY_LEVELS.LOW,
      priorityReasons: ["Pothole surface damage reported", "Inspected by local road team", "Marked resolved after patch work"],
      department: DEPARTMENT_TYPES.ROAD_MAINTENANCE,
      imageUrl: "",
      images: [],
      hasImage: false,
      imageCount: 0,
      location: {
        address: "Kolkata Agarpara",
        city: "Kolkata",
        state: "West Bengal",
        lat: 22.6865,
        lng: 88.3792,
      },
      ward: "Agarpara",
      zone: "North 24 Parganas Zone",
      complaintChannel: "Mobile App",
      status: COMPLAINT_STATUS.RESOLVED,
      slaHours: 72,
      slaDeadline: new Date(Date.now() - 24 * 3600 * 1000),
      slaStatus: "RESOLVED",
      duplicateOf: null,
      duplicateGroupId: "GRP_CFX_015842",
      createdAt: new Date("2026-02-14T10:30:00Z"),
    },
    {
      _id: "cfx_2026_016210",
      complaintId: "CFX-2026-016210",
      title: "Open electric wire near school gate",
      description: "There is an open electric wire dangling near the school gate. Children are passing nearby and it can cause fatal electric shock.",
      category: COMPLAINT_CATEGORIES.ELECTRICITY,
      urgency: URGENCY_LEVELS.CRITICAL,
      aiScore: 92,
      priorityScore: 92,
      priorityLevel: URGENCY_LEVELS.CRITICAL,
      priorityReasons: ["High voltage electric shock hazard", "Near primary school premises", "Immediate emergency action required"],
      department: DEPARTMENT_TYPES.STREETLIGHT_ELECTRICITY,
      imageUrl: "",
      images: [],
      hasImage: false,
      imageCount: 0,
      location: {
        address: "Royalty Naka Road, Kolkata",
        city: "Kolkata",
        state: "West Bengal",
        lat: 22.6812,
        lng: 88.3754,
      },
      ward: "Royalty Naka Road",
      zone: "North 24 Parganas Zone",
      complaintChannel: "Web Portal",
      status: COMPLAINT_STATUS.IN_PROGRESS,
      slaHours: 24,
      slaDeadline: new Date(Date.now() + 12 * 3600 * 1000),
      slaStatus: "ON_TRACK",
      duplicateOf: null,
      duplicateGroupId: "GRP_CFX_016210",
      createdAt: new Date("2026-03-01T08:15:00Z"),
    },
    {
      _id: "cfx_2026_016445",
      complaintId: "CFX-2026-016445",
      title: "Major water pipeline burst on main road",
      description: "High pressure drinking water pipeline ruptured, flooding the intersection and wasting clean water.",
      category: COMPLAINT_CATEGORIES.WATER,
      urgency: URGENCY_LEVELS.HIGH,
      aiScore: 78,
      priorityScore: 78,
      priorityLevel: URGENCY_LEVELS.HIGH,
      priorityReasons: ["Drinking water loss", "Road flooding risk", "Utility line disruption"],
      department: DEPARTMENT_TYPES.WATER_SUPPLY,
      imageUrl: "",
      images: [],
      hasImage: false,
      imageCount: 0,
      location: {
        address: "Royalty Naka Road, Kolkata",
        city: "Kolkata",
        state: "West Bengal",
        lat: 22.6825,
        lng: 88.3768,
      },
      ward: "Royalty Naka Road",
      zone: "North 24 Parganas Zone",
      complaintChannel: "Mobile App",
      status: COMPLAINT_STATUS.SUBMITTED,
      slaHours: 48,
      slaDeadline: new Date(Date.now() + 24 * 3600 * 1000),
      slaStatus: "ON_TRACK",
      duplicateOf: null,
      duplicateGroupId: "GRP_CFX_016445",
      createdAt: new Date("2026-03-02T11:20:00Z"),
    },
    {
      _id: "cfx_2026_016780",
      complaintId: "CFX-2026-016780",
      title: "Footpath encroachment by unauthorized construction stalls",
      description: "Commercial building materials dumped on public sidewalk blocking pedestrian movement completely.",
      category: COMPLAINT_CATEGORIES.TRAFFIC,
      urgency: URGENCY_LEVELS.HIGH,
      aiScore: 75,
      priorityScore: 75,
      priorityLevel: URGENCY_LEVELS.HIGH,
      priorityReasons: ["Pedestrian hazard on high traffic route", "Illegal right-of-way obstruction"],
      department: DEPARTMENT_TYPES.TRAFFIC,
      imageUrl: "",
      images: [],
      hasImage: false,
      imageCount: 0,
      location: {
        address: "Royalty Naka Road, Kolkata",
        city: "Kolkata",
        state: "West Bengal",
        lat: 22.683,
        lng: 88.3745,
      },
      ward: "Royalty Naka Road",
      zone: "North 24 Parganas Zone",
      complaintChannel: "Call Center",
      status: COMPLAINT_STATUS.ASSIGNED,
      slaHours: 48,
      slaDeadline: new Date(Date.now() + 30 * 3600 * 1000),
      slaStatus: "ON_TRACK",
      duplicateOf: null,
      duplicateGroupId: "GRP_CFX_016780",
      createdAt: new Date("2026-03-03T14:45:00Z"),
    },
    {
      _id: "cfx_2026_017120",
      complaintId: "CFX-2026-017120",
      title: "Garbage overflow and solid waste dumping in residential lane",
      description: "Community waste bin not cleared for 5 days, stray dogs and vultures gathering near apartment gate.",
      category: COMPLAINT_CATEGORIES.SANITATION,
      urgency: URGENCY_LEVELS.MEDIUM,
      aiScore: 54,
      priorityScore: 54,
      priorityLevel: URGENCY_LEVELS.MEDIUM,
      priorityReasons: ["Sanitary hazard", "Delay in waste collection beat"],
      department: DEPARTMENT_TYPES.SANITATION,
      imageUrl: "",
      images: [],
      hasImage: false,
      imageCount: 0,
      location: {
        address: "Rajarhat Expressway, Kolkata",
        city: "Kolkata",
        state: "West Bengal",
        lat: 22.622,
        lng: 88.4625,
      },
      ward: "Rajarhat",
      zone: "Bidhannagar Zone",
      complaintChannel: "Web Portal",
      status: COMPLAINT_STATUS.RESOLVED,
      slaHours: 48,
      slaDeadline: new Date(Date.now() - 48 * 3600 * 1000),
      slaStatus: "RESOLVED",
      duplicateOf: null,
      duplicateGroupId: "GRP_CFX_017120",
      createdAt: new Date("2026-02-20T09:00:00Z"),
    },
    {
      _id: "cfx_2026_017350",
      complaintId: "CFX-2026-017350",
      title: "Storm water drain desilting completed",
      description: "Underground stormwater canal desilted and cleared of plastic obstruction prior to monsoon.",
      category: COMPLAINT_CATEGORIES.DRAINAGE,
      urgency: URGENCY_LEVELS.LOW,
      aiScore: 28,
      priorityScore: 28,
      priorityLevel: URGENCY_LEVELS.LOW,
      priorityReasons: ["Preventive desilting", "Completed and citizen verified"],
      department: DEPARTMENT_TYPES.DRAINAGE,
      imageUrl: "",
      images: [],
      hasImage: false,
      imageCount: 0,
      location: {
        address: "Rajarhat Major Arterial Road, Kolkata",
        city: "Kolkata",
        state: "West Bengal",
        lat: 22.6185,
        lng: 88.458,
      },
      ward: "Rajarhat",
      zone: "Bidhannagar Zone",
      complaintChannel: "Mobile App",
      status: COMPLAINT_STATUS.CITIZEN_VERIFIED,
      slaHours: 72,
      slaDeadline: new Date(Date.now() - 72 * 3600 * 1000),
      slaStatus: "RESOLVED",
      duplicateOf: null,
      duplicateGroupId: "GRP_CFX_017350",
      createdAt: new Date("2026-02-18T16:30:00Z"),
    },
    {
      _id: "cfx_2026_017890",
      complaintId: "CFX-2026-017890",
      title: "Streetlight LED replacement on Sector V bypass",
      description: "Dark patch on expressway solved with 8 new LED fixtures installed and verified operational.",
      category: COMPLAINT_CATEGORIES.ELECTRICITY,
      urgency: URGENCY_LEVELS.LOW,
      aiScore: 32,
      priorityScore: 32,
      priorityLevel: URGENCY_LEVELS.LOW,
      priorityReasons: ["Public lighting restored", "Night inspection complete"],
      department: DEPARTMENT_TYPES.STREETLIGHT_ELECTRICITY,
      imageUrl: "",
      images: [],
      hasImage: false,
      imageCount: 0,
      location: {
        address: "Salt Lake Sector V, Kolkata",
        city: "Kolkata",
        state: "West Bengal",
        lat: 22.58,
        lng: 88.42,
      },
      ward: "Kolkata",
      zone: "Salt Lake Zone",
      complaintChannel: "Web Portal",
      status: COMPLAINT_STATUS.RESOLVED,
      slaHours: 48,
      slaDeadline: new Date(Date.now() - 96 * 3600 * 1000),
      slaStatus: "RESOLVED",
      duplicateOf: null,
      duplicateGroupId: "GRP_CFX_017890",
      createdAt: new Date("2026-02-15T19:00:00Z"),
    },
    {
      _id: "cfx_2026_018240",
      complaintId: "CFX-2026-018240",
      title: "Drainage water stagnation and mosquito fogging",
      description: "Stagnant wastewater ditch near market requires immediate anti-larval spray and drainage flow restoration.",
      category: COMPLAINT_CATEGORIES.HEALTH,
      urgency: URGENCY_LEVELS.MEDIUM,
      aiScore: 60,
      priorityScore: 60,
      priorityLevel: URGENCY_LEVELS.MEDIUM,
      priorityReasons: ["Vector control alert", "Mosquito breeding check"],
      department: DEPARTMENT_TYPES.HEALTH_HYGIENE,
      imageUrl: "",
      images: [],
      hasImage: false,
      imageCount: 0,
      location: {
        address: "Park Street Area, Kolkata",
        city: "Kolkata",
        state: "West Bengal",
        lat: 22.55,
        lng: 88.35,
      },
      ward: "Kolkata",
      zone: "Central Kolkata Zone",
      complaintChannel: "Call Center",
      status: COMPLAINT_STATUS.IN_PROGRESS,
      slaHours: 48,
      slaDeadline: new Date(Date.now() + 18 * 3600 * 1000),
      slaStatus: "ON_TRACK",
      duplicateOf: null,
      duplicateGroupId: "GRP_CFX_018240",
      createdAt: new Date("2026-03-01T15:20:00Z"),
    },
  ];

  // Prepend Kolkata records so they have top prominence for Indian civic context
  complaints.unshift(...kolkataRecords);

  cachedComplaints = complaints;
  return complaints;
};

module.exports = {
  loadComplaintsFromDataset,
  isValidCoordinate,
};
