import React from "react";
import { supabase } from "../lib/supabaseClient";
import MapHotspots from "../components/MapHotspots";

/**
 * Editor de rutas (admin)
 * - Mapa más grande (680px)
 * - Dibujo de líneas (click agrega vértices) — FIX del closure stale
 * - Select de NOMBRE restringido a rutas oficiales + “Nueva ruta…”
 * - Select de COLOR fijo por ruta (y respeta colores ya guardados en BD)
 * - Carga ruta existente para editar si el admin selecciona su nombre
 * - Guardado con upsert por name (geojson + bbox + color + is_active)
 */

// Lista oficial de nombres de rutas
const RUTAS_OFICIALES = [
  "Ruta Interamericana",
  "RN-14",
  "Carretera al Salvador",
  "Carretera al Atlántico",
  "RN-10 (Cañas)",
];

// Colores por defecto por ruta (podés cambiarlos si querés)
const ROUTE_COLOR_DEFAULTS = {
  "Ruta Interamericana": "#2563eb", // azul
  "RN-14": "#8b5cf6",               // morado
  "Carretera al Salvador": "#16a34a", // verde
  "Carretera al Atlántico": "#f59e0b", // naranja
  "RN-10 (Cañas)": "#ef4444",         // rojo
};

const FALLBACK_COLORS = [
  "#2563eb", "#16a34a", "#ef4444", "#f59e0b", "#8b5cf6", "#0ea5e9",
];

export default function AdminRoutesEditor() {
  const [routes, setRoutes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");

  // UI
  const [selectedName, setSelectedName] = React.useState("__new__");
  const [newName, setNewName] = React.useState("");
  const [color, setColor] = React.useState("#2563eb");
  const [path, setPath] = React.useState([]); // [[lat, lon], ...]
  const [drawing, setDrawing] = React.useState(true);

  // Cargar rutas existentes
  React.useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("photo_routes")
          .select("*")
          .eq("is_active", true)
          .order("name", { ascending: true });
        if (error) throw error;
        if (!alive) return;
        setRoutes(data || []);
      } catch (e) {
        if (alive) setErr(e.message || "No se pudo cargar rutas");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  // Nombres: solo oficiales + “Nueva...”
  const nameOptions = React.useMemo(() => {
    return ["__new__", ...RUTAS_OFICIALES];
  }, []);

  // Colores: si hay BD, usar colores existentes por nombre; si no, defaults; y si falta, fallback
  const colorOptions = React.useMemo(() => {
    const mapBD = new Map(routes.map(r => [r.name, (r.color || "").toLowerCase()]));
    const list = RUTAS_OFICIALES.map(n => mapBD.get(n) || ROUTE_COLOR_DEFAULTS[n] || FALLBACK_COLORS[0]);
    // única lista de colores (sin duplicados) para el selector
    return Array.from(new Set(list));
  }, [routes]);

  // Cuando cambia selección de nombre
  function onSelectName(e) {
    const val = e.target.value;
    setSelectedName(val);

    if (val === "__new__") {
      setNewName("");
      setPath([]);
      // color default (el primero del selector)
      setColor(colorOptions[0] || "#2563eb");
      setDrawing(true);
      return;
    }

    // Ruta oficial seleccionada: si existe en BD, cargar; sino empezar en blanco con color default para ese nombre
    const found = routes.find(r => r.name === val);
    if (found?.geojson?.geometry?.coordinates?.length) {
      const coords = found.geojson.geometry.coordinates; // [lon, lat]
      const pts = coords.map(([lon, lat]) => [lat, lon]);
      setPath(pts);
      setColor((found.color || ROUTE_COLOR_DEFAULTS[val] || colorOptions[0] || "#2563eb").toLowerCase());
    } else {
      setPath([]);
      setColor(ROUTE_COLOR_DEFAULTS[val] || colorOptions[0] || "#2563eb");
    }
    setDrawing(true);
  }

  async function guardar() {
    try {
      setErr("");
      const finalName = selectedName === "__new__" ? (newName || "").trim() : selectedName;
      if (!finalName) throw new Error("Elegí un nombre de ruta (o escribí uno nuevo).");
      // Bloquear crear rutas con nombres fuera del catálogo oficial (temporal)
      if (selectedName !== "__new__" && !RUTAS_OFICIALES.includes(finalName)) {
        throw new Error("Nombre no permitido por ahora.");
      }
      if (path.length < 2) throw new Error("Dibujá al menos dos puntos en la ruta.");

      const c = color || ROUTE_COLOR_DEFAULTS[finalName] || colorOptions[0] || "#2563eb";

      const geojson = {
        type: "Feature",
        properties: { name: finalName },
        geometry: {
          type: "LineString",
          coordinates: path.map(([lat, lon]) => [lon, lat]),
        },
      };

      const lats = path.map(([lat]) => lat);
      const lons = path.map(([, lon]) => lon);
      const bbox = [Math.min(...lats), Math.min(...lons), Math.max(...lats), Math.max(...lons)];

      const up = { name: finalName, color: c, geojson, bbox, is_active: true };
      const { error } = await supabase.from("photo_routes").upsert(up, { onConflict: "name" });
      if (error) throw error;

      // recargar
      const { data } = await supabase
        .from("photo_routes")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });
      setRoutes(data || []);

      alert("¡Ruta guardada!");
    } catch (e) {
      setErr(e.message || "No se pudo guardar");
    }
  }

  function undo() {
    setPath(prev => prev.slice(0, -1));
  }
  function clearAll() {
    setPath([]);
  }

  // Fit: si es ruta oficial seleccionada, que ajuste a esa; si estás dibujando, a tu path; si no, a todas
  const fitNames = React.useMemo(() => {
    return selectedName !== "__new__" ? [selectedName] : [];
  }, [selectedName]);

  return (
    <main className="pb-8">
      <h1 className="text-2xl font-display font-bold mb-4">Editor de Rutas</h1>

      <section className="rounded-2xl border border-slate-200 p-4 bg-white mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto] gap-3">
          {/* Nombre */}
          <div className="flex flex-col">
            <label className="text-sm text-slate-600 mb-1">Nombre de la ruta</label>
            <div className="flex gap-2">
              <select
                className="h-11 px-3 border rounded-lg flex-1"
                value={selectedName}
                onChange={onSelectName}
              >
                <option value="__new__">Nueva ruta…</option>
                {RUTAS_OFICIALES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              {selectedName === "__new__" && (
                <input
                  className="h-11 px-3 border rounded-lg w-1/2"
                  placeholder="Escribí el nombre"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              )}
            </div>
          </div>

          {/* Color */}
          <div className="flex flex-col">
            <label className="text-sm text-slate-600 mb-1">Color de la ruta</label>
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-6 h-6 rounded border"
                style={{ background: color }}
                title={color}
              />
              <select
                className="h-11 px-3 border rounded-lg flex-1"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              >
                {colorOptions.map((c) => (
                  <option key={c} value={c}>{c.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Guardar */}
          <div className="flex items-end">
            <button
              className="h-11 px-4 rounded-lg bg-blue-600 text-white font-display font-bold w-full"
              onClick={guardar}
            >
              Guardar
            </button>
          </div>
        </div>

        {err && <div className="text-red-600 mt-3">{err}</div>}
      </section>

      <section className="rounded-2xl border border-slate-200 p-4 bg-white">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            className={`h-10 px-3 rounded-lg border ${drawing ? "bg-slate-900 text-white border-slate-900" : "bg-white"}`}
            onClick={() => setDrawing(d => !d)}
            title="Click en el mapa para agregar puntos"
          >
            {drawing ? "Dibujando: ON" : "Dibujar: OFF"}
          </button>
          <button className="h-10 px-3 rounded-lg border" onClick={undo} disabled={path.length === 0}>
            Deshacer
          </button>
          <button className="h-10 px-3 rounded-lg border" onClick={clearAll} disabled={path.length === 0}>
            Limpiar
          </button>
          <button
            className="h-10 px-3 rounded-lg border"
            onClick={() => setPath((p) => [...p])}
            title="Ajustar vista"
          >
            Fit
          </button>
          <div className="text-sm text-slate-500 ml-auto">
            Tip: hacé click en el mapa para agregar vértices. Guardá cuando termines.
          </div>
        </div>

        <MapHotspots
          height={680}
          // Forzamos estilo anterior “streets” (si hay key). Si no, OSM fallback.
          tile={import.meta.env.VITE_MAPTILER_KEY ? "mt_streets" : "osm"}
          maptilerKey={import.meta.env.VITE_MAPTILER_KEY}
          // overlays existentes (para ver rutas guardadas)
          routeOverlays={routes}
          // visibilidad / fit
          visibleRouteNames={fitNames}
          fitStrategy={fitNames.length ? "selected" : (path.length ? "path" : "all")}
          // edición
          editable
          drawing={drawing}
          routePath={path}
          onRouteChange={setPath}
          drawColor={color}
          drawWidth={4}
        />
      </section>
    </main>
  );
}
