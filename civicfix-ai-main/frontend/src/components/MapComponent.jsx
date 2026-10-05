import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AlertTriangle, Map, Layers, Flame, MapPin } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

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

const getMarkerColor = (markerColor) => {
  if (markerColor === "red") return "#ef4444";
  if (markerColor === "yellow") return "#f59e0b";
  if (markerColor === "purple") return "#a855f7";
  return "#10b981";
};

const buildPopupHtml = (marker) => {
  const formattedDate = marker.createdAt
    ? new Date(marker.createdAt).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "N/A";

  const statusClass = (marker.status || "Assigned").toLowerCase().replace(/\s+/g, "-");
  const urgencyClass = (marker.urgency || "Medium").toLowerCase();

  return `
    <div class="map-popup-card">
      <div class="map-popup-header">
        <span class="map-popup-id">${marker.complaintId || "CFX-RECORD"}</span>
        <span class="map-popup-status status-${statusClass}">${marker.status || "Submitted"}</span>
      </div>
      <h3 class="map-popup-title">${marker.title || "Civic Complaint"}</h3>
      <div class="map-popup-meta">
        <div class="map-popup-row">
          <span class="popup-label">Urgency:</span>
          <span class="popup-urgency urgency-${urgencyClass}"><b>${marker.urgency || "Medium"}</b></span>
        </div>
        <div class="map-popup-row">
          <span class="popup-label">AI Score:</span>
          <span class="popup-score"><b>${marker.aiScore ?? 50}/100</b></span>
        </div>
        <div class="map-popup-row">
          <span class="popup-label">Department:</span>
          <span class="popup-val">${marker.department || "General Civic"}</span>
        </div>
        <div class="map-popup-row">
          <span class="popup-label">Category:</span>
          <span class="popup-val" style="text-transform: capitalize;">${marker.category || "General"}</span>
        </div>
        <div class="map-popup-row">
          <span class="popup-label">Address:</span>
          <span class="popup-val">${marker.location?.address || marker.ward || "Location Captured"}</span>
        </div>
        <div class="map-popup-row">
          <span class="popup-label">Reported:</span>
          <span class="popup-val">${formattedDate}</span>
        </div>
      </div>
    </div>
  `;
};

const MapComponent = ({
  markers = [],
  selectedZone = null,
  activeMarkerId = null,
  viewMode = "both", // 'both' | 'markers' | 'heatmap'
  onViewModeChange,
  onMarkerSelect,
}) => {
  const { isDark } = useTheme();
  const [showOsmFallback, setShowOsmFallback] = useState(false);

  const rawToken = import.meta.env.VITE_MAPBOX_TOKEN;
  const hasValidToken =
    typeof rawToken === "string" &&
    rawToken.trim() !== "" &&
    rawToken.trim() !== "your_mapbox_token_here";

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRefs = useRef([]);

  const osmContainerRef = useRef(null);
  const osmMapRef = useRef(null);
  const osmMarkerLayerRef = useRef(null);

  // Filter markers with valid numeric geographic coordinates only
  const validMarkers = markers.filter((marker) =>
    isValidCoordinate(marker.location?.lat, marker.location?.lng)
  );

  // Default geographic center based on available complaint coordinates (Kolkata default if nearby)
  const defaultCenter = (() => {
    const kolkataMarker = validMarkers.find(
      (m) =>
        m.location?.city?.toLowerCase() === "kolkata" ||
        m.location?.state?.toLowerCase() === "west bengal" ||
        m.location?.lat > 20 && m.location?.lat < 24 && m.location?.lng > 86 && m.location?.lng < 90
    );
    if (kolkataMarker) {
      return [kolkataMarker.location.lng, kolkataMarker.location.lat];
    }
    if (validMarkers.length > 0) {
      return [validMarkers[0].location.lng, validMarkers[0].location.lat];
    }
    return [88.3639, 22.5726]; // Kolkata coordinates
  })();

  // 1. Mapbox GL JS Initialization
  useEffect(() => {
    if (!hasValidToken || !mapContainerRef.current) return;

    try {
      mapboxgl.accessToken = rawToken;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: isDark
          ? "mapbox://styles/mapbox/dark-v11"
          : "mapbox://styles/mapbox/streets-v12",
        center: defaultCenter,
        zoom: 11,
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");

      map.on("load", () => {
        // Build GeoJSON dataset for heatmap layer
        const geojsonData = {
          type: "FeatureCollection",
          features: validMarkers.map((m) => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [m.location.lng, m.location.lat],
            },
            properties: {
              id: m.id,
              aiScore: m.aiScore || 50,
            },
          })),
        };

        if (!map.getSource("complaints-geojson")) {
          map.addSource("complaints-geojson", {
            type: "geojson",
            data: geojsonData,
          });

          map.addLayer(
            {
              id: "complaints-heat",
              type: "heatmap",
              source: "complaints-geojson",
              maxzoom: 15,
              paint: {
                "heatmap-weight": [
                  "interpolate",
                  ["linear"],
                  ["get", "aiScore"],
                  0, 0.2,
                  50, 0.5,
                  100, 1.0,
                ],
                "heatmap-intensity": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  0, 1,
                  15, 3,
                ],
                "heatmap-color": [
                  "interpolate",
                  ["linear"],
                  ["heatmap-density"],
                  0, "rgba(33,102,172,0)",
                  0.2, "rgb(103,169,207)",
                  0.4, "rgb(209,229,240)",
                  0.6, "rgb(253,219,199)",
                  0.8, "rgb(239,138,98)",
                  1, "rgb(178,24,43)",
                ],
                "heatmap-radius": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  0, 4,
                  9, 20,
                  15, 30,
                ],
                "heatmap-opacity": viewMode === "markers" ? 0 : 0.85,
              },
            },
            "waterway-label"
          );
        }
      });

      map.on("error", (e) => {
        console.warn("Mapbox error encountered:", e.error?.message || e);
      });

      mapRef.current = map;
    } catch (err) {
      console.error("Mapbox initialization error:", err.message);
    }

    return () => {
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [hasValidToken]);

  // Update Mapbox theme style
  useEffect(() => {
    if (!mapRef.current) return;

    try {
      mapRef.current.setStyle(
        isDark
          ? "mapbox://styles/mapbox/dark-v11"
          : "mapbox://styles/mapbox/streets-v12"
      );
    } catch (err) {
      console.warn("Could not switch map style:", err.message);
    }
  }, [isDark]);

  // Update Heatmap GeoJSON Source and Layer opacity
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const updateSourceAndLayer = () => {
      const geojsonData = {
        type: "FeatureCollection",
        features: validMarkers.map((m) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [m.location.lng, m.location.lat],
          },
          properties: {
            id: m.id,
            aiScore: m.aiScore || 50,
          },
        })),
      };

      const source = map.getSource("complaints-geojson");
      if (source) {
        source.setData(geojsonData);
      }

      if (map.getLayer("complaints-heat")) {
        const targetOpacity = viewMode === "markers" ? 0 : 0.85;
        map.setPaintProperty("complaints-heat", "heatmap-opacity", targetOpacity);
      }
    };

    if (map.isStyleLoaded()) {
      updateSourceAndLayer();
    } else {
      map.once("style.load", updateSourceAndLayer);
    }
  }, [validMarkers, viewMode]);

  // Update Mapbox HTML Markers
  useEffect(() => {
    if (!mapRef.current) return;

    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = [];

    // Only render individual markers if in 'markers' or 'both' view mode
    if (viewMode === "heatmap") return;

    validMarkers.forEach((marker) => {
      const markerElement = document.createElement("div");
      markerElement.className = "custom-map-marker";
      markerElement.style.backgroundColor = getMarkerColor(marker.markerColor);

      if (activeMarkerId === marker.id || activeMarkerId === marker.complaintId) {
        markerElement.classList.add("active-marker");
      }

      const popupHtml = buildPopupHtml(marker);

      try {
        const popup = new mapboxgl.Popup({ offset: 20, maxWidth: "340px" }).setHTML(popupHtml);

        markerElement.addEventListener("click", () => {
          if (onMarkerSelect) onMarkerSelect(marker.id || marker.complaintId);
        });

        const mapMarker = new mapboxgl.Marker(markerElement)
          .setLngLat([marker.location.lng, marker.location.lat])
          .setPopup(popup)
          .addTo(mapRef.current);

        markerRefs.current.push(mapMarker);

        // If this marker is active, automatically open its popup
        if (activeMarkerId === marker.id || activeMarkerId === marker.complaintId) {
          popup.addTo(mapRef.current);
        }
      } catch (err) {
        console.warn("Failed to add marker:", err.message);
      }
    });

    // Fit bounds automatically when not zoomed to a specific zone
    if (!selectedZone && !activeMarkerId && validMarkers.length > 0) {
      try {
        const bounds = new mapboxgl.LngLatBounds();
        validMarkers.forEach((marker) => {
          bounds.extend([marker.location.lng, marker.location.lat]);
        });

        mapRef.current.fitBounds(bounds, {
          padding: 80,
          maxZoom: 13,
        });
      } catch (err) {
        console.warn("Could not fit Mapbox bounds:", err.message);
      }
    }
  }, [validMarkers, isDark, hasValidToken, viewMode, activeMarkerId, selectedZone, onMarkerSelect]);

  // Fly to active marker if selected from outside
  useEffect(() => {
    if (!activeMarkerId) return;
    const targetMarker = validMarkers.find(
      (m) => m.id === activeMarkerId || m.complaintId === activeMarkerId
    );
    if (!targetMarker) return;

    if (hasValidToken && mapRef.current) {
      mapRef.current.flyTo({
        center: [targetMarker.location.lng, targetMarker.location.lat],
        zoom: 14,
        speed: 1.2,
        essential: true,
      });
    } else if (osmMapRef.current) {
      osmMapRef.current.flyTo([targetMarker.location.lat, targetMarker.location.lng], 14);
    }
  }, [activeMarkerId, hasValidToken, validMarkers]);

  // Fly to selected zone when user clicks an Area Zone card
  useEffect(() => {
    if (!selectedZone) return;

    const center = selectedZone.centerLocation;
    if (center && isValidCoordinate(center.lat, center.lng)) {
      if (hasValidToken && mapRef.current) {
        mapRef.current.flyTo({
          center: [center.lng, center.lat],
          zoom: 13,
          speed: 1.2,
          curve: 1.4,
          essential: true,
        });
      } else if (osmMapRef.current) {
        osmMapRef.current.flyTo([center.lat, center.lng], 13);
      }
    }
  }, [selectedZone, hasValidToken]);

  // 2. Leaflet OpenStreetMap Fallback Mode (when Mapbox token is not configured)
  useEffect(() => {
    if (hasValidToken || !showOsmFallback || !osmContainerRef.current) return;

    if (!osmMapRef.current) {
      const centerLat = defaultCenter[1];
      const centerLng = defaultCenter[0];

      const map = L.map(osmContainerRef.current).setView([centerLat, centerLng], 11);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      osmMarkerLayerRef.current = L.layerGroup().addTo(map);
      osmMapRef.current = map;
    }

    // Refresh markers on Leaflet map
    if (osmMarkerLayerRef.current) {
      osmMarkerLayerRef.current.clearLayers();

      const leafletMarkers = [];

      validMarkers.forEach((marker) => {
        const markerColor = getMarkerColor(marker.markerColor);
        const isActive = activeMarkerId === marker.id || activeMarkerId === marker.complaintId;

        const customIcon = L.divIcon({
          className: "custom-leaflet-marker",
          html: `<div style="background-color: ${markerColor}; width: ${isActive ? "26px" : "20px"}; height: ${isActive ? "26px" : "20px"}; border-radius: 999px; border: 3px solid white; box-shadow: 0 4px 14px rgba(0,0,0,0.4); transform: ${isActive ? "scale(1.2)" : "scale(1)"}; transition: transform 0.2s;"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
          popupAnchor: [0, -12],
        });

        const popupContent = buildPopupHtml(marker);

        const lMarker = L.marker([marker.location.lat, marker.location.lng], {
          icon: customIcon,
        }).bindPopup(popupContent, { maxWidth: 340 });

        lMarker.on("click", () => {
          if (onMarkerSelect) onMarkerSelect(marker.id || marker.complaintId);
        });

        osmMarkerLayerRef.current.addLayer(lMarker);
        leafletMarkers.push([marker.location.lat, marker.location.lng]);

        if (isActive) {
          lMarker.openPopup();
        }
      });

      if (!selectedZone && !activeMarkerId && leafletMarkers.length > 0) {
        try {
          osmMapRef.current.fitBounds(leafletMarkers, { padding: [50, 50], maxZoom: 13 });
        } catch (err) {
          console.warn("Could not fit Leaflet bounds:", err.message);
        }
      }
    }

    return () => {
      if (osmMapRef.current) {
        osmMapRef.current.remove();
        osmMapRef.current = null;
        osmMarkerLayerRef.current = null;
      }
    };
  }, [hasValidToken, showOsmFallback, validMarkers, activeMarkerId, selectedZone, onMarkerSelect]);

  const handleFocusKolkata = () => {
    const kolkataCoords = [88.3639, 22.5726];
    if (hasValidToken && mapRef.current) {
      mapRef.current.flyTo({
        center: kolkataCoords,
        zoom: 12,
        speed: 1.2,
        essential: true,
      });
    } else if (osmMapRef.current) {
      osmMapRef.current.flyTo([kolkataCoords[1], kolkataCoords[0]], 12);
    }
  };

  const handleFitAllBounds = () => {
    if (validMarkers.length === 0) return;
    if (hasValidToken && mapRef.current) {
      try {
        const bounds = new mapboxgl.LngLatBounds();
        validMarkers.forEach((m) => bounds.extend([m.location.lng, m.location.lat]));
        mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 13 });
      } catch (e) {
        console.warn(e);
      }
    } else if (osmMapRef.current) {
      try {
        const coords = validMarkers.map((m) => [m.location.lat, m.location.lng]);
        osmMapRef.current.fitBounds(coords, { padding: [40, 40], maxZoom: 13 });
      } catch (e) {
        console.warn(e);
      }
    }
  };

  // When valid Mapbox token is configured
  if (hasValidToken) {
    return (
      <div className="map-wrapper" style={{ position: "relative", width: "100%", height: "100%" }}>
        <div className="map-view-controls">
          {onViewModeChange && (
            <div className="view-mode-group">
              <button
                type="button"
                className={`view-mode-btn ${viewMode === "both" ? "active" : ""}`}
                onClick={() => onViewModeChange("both")}
                title="Show both markers and heatmap"
              >
                <Layers size={14} /> Both
              </button>
              <button
                type="button"
                className={`view-mode-btn ${viewMode === "markers" ? "active" : ""}`}
                onClick={() => onViewModeChange("markers")}
                title="Show individual markers"
              >
                <MapPin size={14} /> Markers
              </button>
              <button
                type="button"
                className={`view-mode-btn ${viewMode === "heatmap" ? "active" : ""}`}
                onClick={() => onViewModeChange("heatmap")}
                title="Show complaint density heatmap"
              >
                <Flame size={14} /> Heatmap
              </button>
            </div>
          )}

          <div className="map-nav-helpers">
            <button
              type="button"
              className="map-nav-btn"
              onClick={handleFocusKolkata}
              title="Focus Kolkata Area"
            >
              📍 Kolkata
            </button>
            <button
              type="button"
              className="map-nav-btn"
              onClick={handleFitAllBounds}
              title="Fit all complaint markers"
            >
              ⛶ Fit All
            </button>
          </div>
        </div>
        <div ref={mapContainerRef} className="map-container"></div>
      </div>
    );
  }

  // When Mapbox token is not configured and user requested OpenStreetMap fallback
  if (showOsmFallback) {
    return (
      <div className="map-wrapper" style={{ position: "relative", width: "100%", height: "100%" }}>
        <div className="osm-fallback-banner">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Layers size={16} color="#38bdf8" />
            <span>
              Rendering via OpenStreetMap fallback ({validMarkers.length} markers plotted). Add{" "}
              <code>VITE_MAPBOX_TOKEN</code> in <code>frontend/.env</code> for Mapbox vector tiles.
            </span>
          </div>
          <button
            type="button"
            className="osm-token-btn"
            onClick={() => setShowOsmFallback(false)}
          >
            Token Setup Info
          </button>
        </div>
        <div ref={osmContainerRef} className="map-container"></div>
      </div>
    );
  }

  // Exact required message and empty state when Mapbox token is not configured
  return (
    <div className="map-token-missing">
      <AlertTriangle size={42} color="#f59e0b" style={{ marginBottom: "14px" }} />
      <h3>Map unavailable — Mapbox token is not configured.</h3>
      <p>
        Add <b>VITE_MAPBOX_TOKEN</b> in <code>frontend/.env</code> to show the vector map.
      </p>

      {validMarkers.length > 0 && (
        <div style={{ marginTop: "18px" }}>
          <button
            type="button"
            className="secondary-action-btn"
            onClick={() => setShowOsmFallback(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
          >
            <Map size={18} />
            Preview {validMarkers.length} Markers on OpenStreetMap (Fallback)
          </button>
        </div>
      )}
    </div>
  );
};

export default MapComponent;