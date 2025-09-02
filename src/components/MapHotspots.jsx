// src/components/MapHotspots.jsx
import React from "react";
import "maplibre-gl/dist/maplibre-gl.css";

let MaplibreGLPromise = null;
async function loadMaplibre() {
  if (!MaplibreGLPromise) {
    MaplibreGLPromise = import("maplibre-gl");
  }
  return MaplibreGLPromise;
}

/**
 * Mapa con MapLibre + MapTiler (streets) o OSM (fallback).
 * Soporta:
 *  - routeOverlays: rutas guardadas (FeatureCollection)
 *  - Dibujo de línea actual (routePath) con click (editable && drawing)
 *  - Fit a "selected" / "path" / "all"
 *  - Marcadores con popup (cerrado por defecto; abre en hover/click)
 */
export default function MapHotspots({
  height = 560,
  tile = "mt_streets",
  maptilerKey,
  routeOverlays = [],
  visibleRouteNames = [],
  fitStrategy = "all",
  editable = false,
  drawing = false,
  routePath = [],
  onRouteChange,
  drawColor = "#2563eb",
  drawWidth = 4,
  // Marcadores del fotógrafo
  // Acepta `markers` o `points` (alias). Cada item: { id?, nombre?, lat, lon, horarios?[] }
  markers = [],
  points = [],
  markerSize = 22,
  openPopups = false,          // 👈 ocultos por defecto
  markerPx,
  showTooltips,
  mode,
  onChange,
  filterRouteNames = false,
  fitToMarkers = false,
  fitPaddingTop = 140,
}) {
  const ref = React.useRef(null);
  const mapRef = React.useRef(null);
  const glRef = React.useRef(null);
  const pathRef = React.useRef(routePath);
  React.useEffect(() => { pathRef.current = routePath; }, [routePath]);

  const markersRef = React.useRef([]);
  const finalMarkerSize = Number.isFinite(markerPx) ? markerPx : markerSize;
  const finalOpenPopups = typeof showTooltips === "boolean" ? showTooltips : openPopups;
  const allowDrag = editable || mode === "edit";

  // Estilo “anterior”: MapTiler Streets si hay key; si no OSM raster
  const style = React.useMemo(() => {
    if (tile === "mt_streets" && maptilerKey) {
      return `https://api.maptiler.com/maps/streets/style.json?key=${maptilerKey}`;
    }
    return {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
      },
      layers: [{ id: "osm", type: "raster", source: "osm", minzoom: 0, maxzoom: 20 }],
    };
  }, [tile, maptilerKey]);

  React.useEffect(() => {
    let disposed = false;
    (async () => {
      const maplibre = await loadMaplibre();
      if (disposed) return;
      glRef.current = maplibre;

      const map = new maplibre.Map({
        container: ref.current,
        style,
        center: [-90.5132, 14.6349], // GUA
        zoom: 8,
        attributionControl: true,
      });
      mapRef.current = map;
      map.addControl(new maplibre.NavigationControl({ visualizePitch: true }), "top-right");

      map.on("load", () => {
        // Línea dibujada (editable)
        map.addSource("draw-route", { type: "geojson", data: lineStringFromPath(pathRef.current) });
        map.addLayer({
          id: "draw-line",
          type: "line",
          source: "draw-route",
          paint: { "line-color": drawColor, "line-width": drawWidth },
          layout: { "line-join": "round", "line-cap": "round" },
        });

        // Overlays guardados
        map.addSource("routes-overlays", {
          type: "geojson",
          data: routesToCollection(
            routeOverlays,
            filterRouteNames ? visibleRouteNames : null
          ),
        });
        map.addLayer({
          id: "routes-lines",
          type: "line",
          source: "routes-overlays",
          paint: { "line-color": ["get", "color"], "line-width": 3 },
          layout: { "line-join": "round", "line-cap": "round" },
        });

        fitToStrategy(
          map,
          maplibre,
          routeOverlays,
          pathRef.current,
          fitStrategy,
          visibleRouteNames,
          {
            fitToMarkers,
            markers: normalizeMarkers(markers, points),
            fitPaddingTop,
          }
        );

        // Pintar marcadores iniciales
        renderMarkers(map, maplibre, {
          data: normalizeMarkers(markers, points),
          markerSize: finalMarkerSize,
          openPopups: finalOpenPopups, // por si querés forzar abierto
          markersRef,
          allowDrag,
          onChange,
        });
      });

      // Dibujo de ruta
      map.on("click", (e) => {
        if (!editable || !drawing) return;
        const { lng, lat } = e.lngLat;
        const next = [...pathRef.current, [lat, lng]];
        pathRef.current = next;
        onRouteChange?.(next);
      });
    })();

    return () => {
      disposed = true;
      try { markersRef.current.forEach((m) => m.remove()); } catch {}
      markersRef.current = [];
      try { mapRef.current?.remove(); } catch {}
      mapRef.current = null;
      glRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, editable, drawing, onRouteChange]);

  // Actualizar línea dibujada y color
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource("draw-route");
    if (src) src.setData(lineStringFromPath(routePath));
    if (map.getLayer("draw-line")) {
      map.setPaintProperty("draw-line", "line-color", drawColor);
      map.setPaintProperty("draw-line", "line-width", drawWidth);
    }
  }, [routePath, drawColor, drawWidth]);

  // Actualizar overlays
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource("routes-overlays");
    if (src)
      src.setData(
        routesToCollection(
          routeOverlays,
          filterRouteNames ? visibleRouteNames : null
        )
      );
  }, [routeOverlays, filterRouteNames, visibleRouteNames]);

  // Fit según estrategia
  React.useEffect(() => {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!map || !gl) return;
    fitToStrategy(
      map,
      gl,
      routeOverlays,
      routePath,
      fitStrategy,
      visibleRouteNames,
      {
        fitToMarkers,
        markers: normalizeMarkers(markers, points),
        fitPaddingTop,
      }
    );
  }, [fitStrategy, visibleRouteNames, routePath, routeOverlays, fitToMarkers, markers, points, fitPaddingTop]);

  // Actualizar marcadores cuando cambien
  React.useEffect(() => {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!map || !gl) return;
    renderMarkers(map, gl, {
      data: normalizeMarkers(markers, points),
      markerSize: finalMarkerSize,
      openPopups: finalOpenPopups,
      markersRef,
      allowDrag,
      onChange,
    });
  }, [markers, points, finalMarkerSize, finalOpenPopups, allowDrag, onChange]);

  return (
    <div
      ref={ref}
      className="w-full rounded-xl overflow-hidden border border-slate-200"
      style={{ height: `${height}px` }}
    />
  );
}

/* ================= Helpers ================= */

function lineStringFromPath(path) {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: (path || []).map(([lat, lon]) => [lon, lat]),
    },
  };
}

function routesToCollection(routes = [], onlyNames = null) {
  return {
    type: "FeatureCollection",
    features: routes
      .filter(Boolean)
      .filter((r) => (!onlyNames?.length ? true : onlyNames.includes(r.name)))
      .map((r) => ({
        type: "Feature",
        properties: {
          name: r.name || "",
          color: (r.color || "#111827").toLowerCase(),
        },
        geometry: r.geojson?.geometry || null,
      }))
      .filter((f) => !!f.geometry),
  };
}

function fitToStrategy(map, gl, routes, path, strategy, names, extra = {}) {
  try {
    const bounds = new gl.LngLatBounds();

    // Fit a marcadores primero si lo piden
    if (extra?.fitToMarkers && Array.isArray(extra?.markers) && extra.markers.length) {
      extra.markers.forEach((m) => bounds.extend([m.lon, m.lat]));
      if (!isEmptyBounds(bounds)) {
        map.fitBounds(bounds, {
          padding: { top: extra.fitPaddingTop || 140, bottom: 40, left: 40, right: 40 },
          duration: 450,
        });
        return;
      }
    }

    if (strategy === "selected" && names?.length) {
      const selected = routes.filter((r) => names.includes(r.name));
      addGeoBounds(bounds, selected.map((r) => r.geojson?.geometry).filter(Boolean));
    } else if (strategy === "path" && path?.length >= 2) {
      addPathBounds(bounds, path);
    } else {
      addGeoBounds(bounds, routes.map((r) => r.geojson?.geometry).filter(Boolean));
    }

    if (!isEmptyBounds(bounds)) map.fitBounds(bounds, { padding: 40, duration: 450 });
  } catch {}
}

function addGeoBounds(bounds, geoms) {
  geoms.forEach((g) => {
    if (!g) return;
    if (g.type === "LineString") {
      (g.coordinates || []).forEach(([lng, lat]) => bounds.extend([lng, lat]));
    } else if (g.type === "MultiLineString") {
      (g.coordinates || []).forEach((ls) => ls.forEach(([lng, lat]) => bounds.extend([lng, lat])));
    }
  });
}
function addPathBounds(bounds, path) {
  (path || []).forEach(([lat, lon]) => bounds.extend([lon, lat]));
}
function isEmptyBounds(b) {
  // @ts-ignore
  const sw = b._sw, ne = b._ne;
  return !sw || !ne || (sw.lng === ne.lng && sw.lat === ne.lat);
}

/* ================= Marcadores ================= */

function normalizeMarkers(markers, points) {
  const arr = (Array.isArray(markers) && markers.length ? markers : points) || [];
  return arr
    .map((p) => {
      const lat = Number(p.lat ?? p.latitude ?? p.coords?.lat);
      const lon = Number(p.lon ?? p.lng ?? p.longitude ?? p.coords?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      return {
        id: p.id || `${lat},${lon}`,
        nombre: p.nombre || p.label || "Punto",
        lat, lon,
        horarios: Array.isArray(p.horarios) ? p.horarios : [],
        ruta: p.ruta || p.route || "",
        raw: p,
      };
    })
    .filter(Boolean);
}

function renderMarkers(map, gl, { data, markerSize, openPopups, markersRef, allowDrag, onChange }) {
  // limpiar anteriores
  try { markersRef.current.forEach((m) => m.remove()); } catch {}
  markersRef.current = [];
  if (!Array.isArray(data) || data.length === 0) return;

  data.forEach((m) => {
    const el = document.createElement("div");
    el.style.width = `${markerSize}px`;
    el.style.height = `${markerSize}px`;
    el.style.borderRadius = "50%";
    el.style.background = "#ef4444"; // rojo
    el.style.border = "2px solid #fff";
    el.style.boxShadow = "0 2px 8px rgba(0,0,0,.35)";
    if (allowDrag) {
      el.style.cursor = "grab";
      el.addEventListener("mousedown", () => (el.style.cursor = "grabbing"));
      window.addEventListener("mouseup", () => (el.style.cursor = "grab"), { once: true });
    }

    const marker = new gl.Marker({ element: el, anchor: "center", draggable: !!allowDrag })
      .setLngLat([m.lon, m.lat])
      .addTo(map);

    // Popup (CERRADO por defecto)
    const content = document.createElement("div");
    content.style.fontSize = "12px";
    content.style.lineHeight = "1.2";
    content.style.color = "#111";
    content.style.background = "#fff";
    content.style.padding = "4px 0";
    content.innerHTML = `
      <div style="font-weight:700;margin-bottom:4px;color:#000">${escapeHtml(m.nombre)}</div>
      ${m.ruta ? `<div style="opacity:.8;margin-bottom:4px;color:#111">${escapeHtml(m.ruta)}</div>` : ""}
      ${
        (m.horarios || []).length
          ? `<ul style="margin:0;padding-left:16px">${m.horarios
              .map(
                (h) =>
                  `<li>${escapeHtml(h.dia || "")}: ${escapeHtml(h.inicio || "")} – ${escapeHtml(
                    h.fin || ""
                  )}</li>`
              )
              .join("")}</ul>`
          : `<div style="opacity:.8">Sin horarios</div>`
      }
    `;

    const popup = new gl.Popup({
      offset: 16,
      closeButton: false,
      closeOnClick: true, // clic en el mapa lo cierra
    }).setDOMContent(content);

    marker.setPopup(popup);
    // si alguien quiere abrir todos de una, puede pasar openPopups=true
    if (openPopups) marker.togglePopup();

    // Estilo del contenedor del popup
    const restyle = () => {
      const elp = popup.getElement();
      if (!elp) return;
      const c = elp.querySelector(".maplibregl-popup-content");
      if (c) {
        c.style.background = "#fff";
        c.style.color = "#111";
        c.style.borderRadius = "10px";
        c.style.boxShadow = "0 8px 24px rgba(0,0,0,.25)";
        c.style.padding = "10px 12px";
      }
    };

    popup.on?.("open", restyle);

    // 👇 Mostrar en hover y/o click (cerrado por defecto)
    let hideTimer = null;
    const open = () => {
      if (!popup.isOpen()) marker.togglePopup();
      restyle();
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    };
    const close = () => {
      hideTimer = setTimeout(() => {
        if (popup.isOpen()) marker.togglePopup();
      }, 120);
    };

    const node = marker.getElement();
    // Hover (en desktop)
    node.addEventListener("mouseenter", open);
    node.addEventListener("mouseleave", close);
    // Click (desktop y móvil)
    node.addEventListener("click", (e) => {
      e.stopPropagation();
      if (popup.isOpen()) close();
      else open();
    });

    // Drag-end → actualizar coords
    if (allowDrag && typeof onChange === "function") {
      marker.on("dragend", () => {
        const { lng, lat } = marker.getLngLat();
        const updated = data.map((d) => (d.id === m.id ? { ...d.raw, lon: lng, lat } : d.raw));
        try { onChange(updated); } catch {}
      });
    }

    markersRef.current.push(marker);
  });
}

function escapeHtml(str) {
  if (typeof str !== "string") return String(str ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
