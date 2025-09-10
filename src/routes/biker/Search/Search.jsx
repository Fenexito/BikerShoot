// src/routes/biker/Search/Search.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";

import {
  fetchEvent,
  fetchHotspot,
  fetchHotspotsByEvent,
  fetchPhotos,
  getRouteName,
} from "../../../lib/searchApi.js";

import SearchResults from "./SearchResults";
import MultiSelectCheckbox from "./MultiSelectCheckbox.jsx";

/* ================== Constantes ================== */
const RUTAS_FIJAS = [
  "Ruta Interamericana",
  "RN-14",
  "Carretera al Salvador",
  "Carretera al Atlántico",
  "RN-10 (Cañas)",
];

/* ======= Tiempo (paso de 15 min) ======= */
const MIN_STEP = 5 * 4;   // 5:00
const MAX_STEP = 15 * 4;  // 15:00
const clampStep = (s) => Math.max(MIN_STEP, Math.min(MAX_STEP, Number(s) || MIN_STEP));
const timeToStep = (t = "06:00") => {
  const [h, m] = (t || "00:00").split(":").map((n) => parseInt(n || "0", 10));
  return clampStep(h * 4 + Math.round((m || 0) / 15));
};
const stepToTime24 = (s) => {
  const c = clampStep(s);
  const h = Math.floor(c / 4);
  const m = (c % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
const to12h = (t24) => {
  const [H, M] = (t24 || "00:00").split(":").map((x) => parseInt(x || "0", 10));
  const ampm = H >= 12 ? "PM" : "AM";
  const h12 = H % 12 === 0 ? 12 : H % 12;
  return `${h12}:${String(M).padStart(2, "0")} ${ampm}`;
};
const csvToArr = (v) => (!v ? [] : v.split(",").filter(Boolean));
const arrToCsv = (a) => (Array.isArray(a) ? a.join(",") : "");

/* ======= Dual Slider (igual al de tu perfil) ======= */
function DualSlider({ min, max, a, b, onChangeA, onChangeB, width = 260 }) {
  const ref = React.useRef(null);
  const dragging = React.useRef(null);
  const clamp = (v) => Math.max(min, Math.min(max, v));
  const toPct = (v) => ((v - min) / (max - min)) * 100;

  const onMove = React.useCallback(
    (ev) => {
      if (!dragging.current || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const raw = min + Math.round(ratio * (max - min));
      const val = clamp(raw);
      if (dragging.current === "a") onChangeA(Math.min(val, b - 1));
      else onChangeB(Math.max(val, a + 1));
    },
    [a, b, min, max, onChangeA, onChangeB]
  );

  const stop = React.useCallback(() => {
    dragging.current = null;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", stop);
  }, [onMove]);

  const startDrag = (which) => (ev) => {
    dragging.current = which;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", stop);
    ev.preventDefault();
  };

  return (
    <div style={{ width }} className="select-none">
      <div className="flex items-center justify-between text-xs text-slate-600 mb-1 font-mono">
        <span>{to12h(stepToTime24(a))}</span>
        <span>{to12h(stepToTime24(b))}</span>
      </div>
      <div ref={ref} className="relative h-8">
        <div className="absolute inset-0 rounded-full bg-slate-200" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full bg-blue-500"
          style={{ left: `${toPct(a)}%`, width: `${toPct(b) - toPct(a)}%` }}
        />
        <button
          type="button"
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full border border-slate-300 bg-white shadow"
          style={{ left: `${toPct(a)}%` }}
          onMouseDown={startDrag("a")}
          aria-label="Hora inicio"
          title="Mover hora de inicio"
        />
        <button
          type="button"
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full border border-slate-300 bg-white shadow"
          style={{ left: `${toPct(b)}%` }}
          onMouseDown={startDrag("b")}
          aria-label="Hora final"
          title="Mover hora final"
        />
      </div>
    </div>
  );
}

/* ======= Helpers Supabase locales ======= */
async function getRouteIdByName(routeName) {
  if (!routeName) return null;
  const { data, error } = await supabase
    .from("photo_routes")
    .select("id, name")
    .ilike("name", routeName.trim());
  if (error) throw error;
  const row =
    (data || []).find(
      (r) => r.name.trim().toLowerCase() === routeName.trim().toLowerCase()
    ) || data?.[0];
  return row?.id || null;
}

async function getAllHotspotsForRoute(routeName) {
  const routeId = await getRouteIdByName(routeName);
  if (!routeId) return [];
  const { data, error } = await supabase
    .from("event_hotspot")
    .select("id, name")
    .eq("route_id", routeId);
  if (error) throw error;
  return data || [];
}

async function mapPointNamesToHotspotIds(routeName, pointNames = []) {
  if (!routeName || !pointNames?.length) return [];
  const routeId = await getRouteIdByName(routeName);
  if (!routeId) return [];
  const { data, error } = await supabase
    .from("event_hotspot")
    .select("id, name")
    .eq("route_id", routeId)
    .in("name", pointNames);
  if (error) throw error;
  return (data || []).map((r) => String(r.id));
}

/* ================== Componente ================== */
export default function BikerSearch() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  // -------- filtros en una sola fila --------
  const [fecha, setFecha] = useState(() => params.get("fecha") || new Date().toISOString().slice(0, 10));
  const [iniStep, setIniStep] = useState(() => clampStep(timeToStep(params.get("inicio") || "06:00")));
  const [finStep, setFinStep] = useState(() => clampStep(timeToStep(params.get("fin") || "12:00")));

  const [ruta, setRuta] = useState(() => {
    const r = params.get("ruta");
    return r && RUTAS_FIJAS.includes(r) ? r : "Todos";
  });

  const [selPhotogs, setSelPhotogs] = useState(() => csvToArr(params.get("photogs"))); // ids
  const [selHotspots, setSelHotspots] = useState(() => {
    const unique = params.get("hotspot") || params.get("hotspots");
    return csvToArr(unique); // nombres de punto
  });

  const forcedFromEvent = !!(params.get("evento") || params.get("hotspot"));
  const [confIA, setConfIA] = useState(() =>
    params.has("conf") ? Number(params.get("conf")) : forcedFromEvent ? 0 : 70
  );

  // catálogos (desde RPC get_photographers_cards)
  const [rows, setRows] = useState([]);         // fotógrafos + rutas + puntos (strings)
  const [loading, setLoading] = useState(false);

  // resolutores para mostrar nombres en resultados
  const [resolver, setResolver] = useState({
    photographerById: new Map(),   // id -> {label}
    hotspotById: new Map(),        // hotspot_id -> {name}
  });

  // fotos
  const [allPhotos, setAllPhotos] = useState([]);

  /* ---------- si venís de ?evento/?hotspot ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const evento = params.get("evento");
        const hotspotParam = params.get("hotspot");
        let photographer_id = null;

        if (evento) {
          const ev = await fetchEvent(evento);
          if (ev) {
            const r = ev.ruta && RUTAS_FIJAS.includes(ev.ruta) ? ev.ruta : null;
            if (!params.get("ruta") && r) setRuta(r);
            if (!params.get("fecha") && ev.fecha) setFecha(ev.fecha.slice(0, 10));
            if (ev.photographer_id) photographer_id = String(ev.photographer_id);

            const pts = await fetchHotspotsByEvent(evento);
            if (!alive) return;
            const hsMap = new Map(pts.map((p) => [String(p.id), { name: p.name }]));
            setResolver((prev) => ({ ...prev, hotspotById: hsMap }));
          }
        }

        if (hotspotParam) {
          const hs = await fetchHotspot(hotspotParam);
          if (hs) {
            if (!params.get("inicio") && hs.horaIni) setIniStep(clampStep(timeToStep(hs.horaIni)));
            if (!params.get("fin") && hs.horaFin) setFinStep(clampStep(timeToStep(hs.horaFin)));
            if (!params.get("ruta") && hs.route_id) {
              const name = await getRouteName(hs.route_id);
              if (name && RUTAS_FIJAS.includes(name)) setRuta(name);
            }
            if (!selHotspots.length) setSelHotspots([String(hs.name)]); // nombre de punto
          }
        }

        // si venía fotógrafo amarrado
        const photogsCsv = params.get("photogs") || (photographer_id ? photographer_id : "");
        const photogIds = csvToArr(photogsCsv);
        if (!selPhotogs.length && photogIds.length) setSelPhotogs(photogIds);
      } catch (e) {
        console.error("Preconfig buscar:", e);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- cargar fotógrafos y puntos vía RPC (igual a photographers.jsx) ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (ruta === "Todos") {
          setRows([]);
          setResolver((prev) => ({ ...prev, photographerById: new Map() }));
          return;
        }
        setLoading(true);
        const { data, error } = await supabase.rpc("get_photographers_cards", {
          q: null,
          ruta,          // filtra por la ruta seleccionada
          punto: null,   // acá no filtramos por nombre de punto (queremos TODOS los de esa ruta)
          orden: "nombre",
          limit_n: 500,
          offset_n: 0,
        });
        if (error) throw error;
        if (!alive) return;

        const mapped = (data || []).map((r) => ({
          id: String(r.id),
          estudio: r.estudio,
          username: (r.username || "").replace(/^@/, ""),
          rutas: Array.isArray(r.rutas) ? r.rutas : [],
          puntos: Array.isArray(r.puntos) ? r.puntos : [], // asumimos strings
        }));
        setRows(mapped);

        // resolver de nombres de fotógrafo
        const phMap = new Map(
          mapped.map((p) => [
            p.id,
            { label: p.estudio || p.username || p.id },
          ])
        );
        setResolver((prev) => ({ ...prev, photographerById: phMap }));
      } catch (e) {
        console.error("RPC get_photographers_cards:", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [ruta]);

  /* ---------- opciones para selects (multi) ---------- */
  const photogOptions = useMemo(() => {
    // fotógrafos que SÍ tienen la ruta (por si el RPC trae alguno sin esa ruta)
    const list = rows.filter((r) => (r.rutas || []).includes(ruta));
    // si hay selección previa que no exista, se limpia abajo
    return list
      .map((p) => ({ value: p.id, label: resolver.photographerById.get(p.id)?.label || p.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, ruta, resolver.photographerById]);

  const hotspotOptions = useMemo(() => {
    // puntos según ruta y (opcional) fotógrafos seleccionados
    const base = rows.filter((r) => (r.rutas || []).includes(ruta));
    const filteredByPhotog =
      selPhotogs.length > 0 ? base.filter((r) => selPhotogs.includes(r.id)) : base;

    const set = new Set(
      filteredByPhotog.flatMap((r) =>
        (r.puntos || []).map((p) => String(p))
      )
    );
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name, label: name }));
  }, [rows, ruta, arrToCsv(selPhotogs)]);

  // depurar selecciones inválidas al cambiar opciones
  useEffect(() => {
    const validPhotogIds = new Set(photogOptions.map((o) => String(o.value)));
    const cleanedPhotogs = selPhotogs.filter((id) => validPhotogIds.has(String(id)));
    if (cleanedPhotogs.length !== selPhotogs.length) setSelPhotogs(cleanedPhotogs);

    const validHotspotNames = new Set(hotspotOptions.map((o) => String(o.value)));
    const cleanedHotspots = selHotspots.filter((nm) => validHotspotNames.has(String(nm)));
    if (cleanedHotspots.length !== selHotspots.length) setSelHotspots(cleanedHotspots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photogOptions.length, hotspotOptions.length]);

  /* ---------- cargar fotos (mapear nombres de punto -> hotspot_id reales) ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);

        // mapear nombres de punto a ids reales (event_hotspot)
        let hotspot_ids = [];
        if (ruta !== "Todos") {
          if (selHotspots.length > 0) {
            hotspot_ids = await mapPointNamesToHotspotIds(ruta, selHotspots);
          } else {
            const allHs = await getAllHotspotsForRoute(ruta);
            hotspot_ids = allHs.map((h) => String(h.id));
            // resolver nombres
            const hsMap = new Map(allHs.map((h) => [String(h.id), { name: h.name }]));
            if (alive) setResolver((prev) => ({ ...prev, hotspotById: hsMap }));
          }
        }

        const fotos = await fetchPhotos({
          event_id: params.get("evento") || undefined,
          hotspot_ids: hotspot_ids.length ? hotspot_ids : undefined,
          photographer_ids: selPhotogs.length ? selPhotogs : undefined,
        });

        if (!alive) return;

        // si no teníamos resolver de hotspot, construirlo con lo que vino (por si faltó algún nombre)
        if (fotos.length && resolver.hotspotById.size === 0) {
          const ids = Array.from(new Set(fotos.map((f) => String(f.hotspotId)).filter(Boolean)));
          if (ids.length) {
            const routeId = await getRouteIdByName(ruta);
            if (routeId) {
              const { data } = await supabase
                .from("event_hotspot")
                .select("id, name")
                .eq("route_id", routeId)
                .in("id", ids);
              const hsMap = new Map((data || []).map((h) => [String(h.id), { name: h.name }]));
              if (alive) setResolver((prev) => ({ ...prev, hotspotById: hsMap }));
            }
          }
        }

        // Marcar ruta en UI
        const fotosWithRoute = ruta !== "Todos" ? fotos.map((f) => ({ ...f, route: ruta })) : fotos;
        setAllPhotos(fotosWithRoute);
      } catch (e) {
        console.error("Cargando fotos:", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta, arrToCsv(selHotspots), arrToCsv(selPhotogs)]);

  /* ---------- filtro front: fecha + horario + IA ---------- */
  const filtered = useMemo(() => {
    const d0 = new Date(fecha + "T00:00:00");
    const start = new Date(d0);
    start.setMinutes(clampStep(iniStep) * 15, 0, 0);
    const end = new Date(d0);
    end.setMinutes(clampStep(finStep) * 15 + 59, 59, 999);

    return (allPhotos || []).filter((ph) => {
      if (!ph?.timestamp) return false;
      const d = new Date(ph.timestamp);
      if (isNaN(d)) return false;
      if (!(d >= start && d <= end)) return false;
      if ((ph.aiConfidence || 0) < confIA) return false;
      return true;
    });
  }, [allPhotos, fecha, iniStep, finStep, confIA]);

  /* ---------- clusters & selección ---------- */
  const clusters = useMemo(() => {
    const map = new Map();
    for (const ph of filtered) {
      const d = new Date(ph.timestamp);
      const key =
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T` +
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ph);
    }
    return Array.from(map.entries())
      .map(([k, items]) => ({
        key: k,
        fecha: k.slice(0, 10),
        hora: k.slice(11, 16),
        items: items.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1)),
      }))
      .sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [filtered]);

  const [vista, setVista] = useState("mosaico");
  const [page, setPage] = useState(1);
  const pageSize = 60;
  useEffect(() => { setPage(1); }, [filtered.length, vista]);

  const totalPhotos = filtered.length;
  const totalClusters = clusters.length;
  const paginatedPhotos = useMemo(() => filtered.slice(0, page * pageSize), [filtered, page]);
  const paginatedClusters = useMemo(() => clusters.slice(0, page * 3), [clusters, page]);
  const hasMorePhotos = paginatedPhotos.length < totalPhotos;
  const hasMoreClusters = paginatedClusters.length < totalClusters;
  const onLoadMore = () => setPage((p) => p + 1);

  const [sel, setSel] = useState(() => new Set());
  const toggleSel = (id) =>
    setSel((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const clearSel = () => setSel(new Set());
  const totalQ = useMemo(() => sel.size * 50, [sel]);

  return (
    <div className="min-h-screen surface pb-28">
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        {/* ======= una sola fila ======= */}
        <div className="flex flex-wrap items-end gap-3">
          {/* FECHA */}
          <div>
            <label className="block text-sm font-medium text-slate-600">Fecha</label>
            <input
              type="date"
              className="h-9 border rounded-lg px-2 bg-white"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          {/* HORA */}
          <div className="min-w-[260px]">
            <label className="block text-sm font-medium text-slate-600">Hora (inicio–fin)</label>
            <DualSlider
              min={MIN_STEP}
              max={MAX_STEP}
              a={iniStep}
              b={finStep}
              onChangeA={setIniStep}
              onChangeB={setFinStep}
              width={260}
            />
          </div>

          {/* RUTA */}
          <div>
            <label className="block text-sm font-medium text-slate-600">Ruta</label>
            <select
              className="h-9 border rounded-lg px-2 bg-white min-w-[200px]"
              value={ruta}
              onChange={(e) => setRuta(e.target.value)}
            >
              <option value="Todos">Todas</option>
              {RUTAS_FIJAS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* FOTÓGRAFO (multi) */}
          <div className="min-w-[220px]">
            <label className="block text-sm font-medium text-slate-600">Fotógrafo(s)</label>
            <MultiSelectCheckbox
              options={
                photogOptions
              }
              value={selPhotogs}
              onChange={setSelPhotogs}
              placeholder={ruta === "Todos" ? "Elegí una ruta primero" : "Seleccionar fotógrafo(s)"}
            />
          </div>

          {/* PUNTO (multi) */}
          <div className="min-w-[220px]">
            <label className="block text-sm font-medium text-slate-600">Punto(s)</label>
            <MultiSelectCheckbox
              options={
                hotspotOptions
              }
              value={selHotspots}
              onChange={setSelHotspots}
              placeholder={ruta === "Todos" ? "Elegí una ruta primero" : "Seleccionar punto(s)"}
            />
          </div>
        </div>

        {/* ======= RESULTADOS ======= */}
        <div className="mt-5">
          {loading ? (
            <div className="text-slate-500">Buscando fotos…</div>
          ) : (
            <SearchResults
              vista={vista}
              setVista={setVista}
              paginatedPhotos={paginatedPhotos}
              totalPhotos={totalPhotos}
              paginatedClusters={paginatedClusters}
              totalClusters={totalClusters}
              onLoadMore={onLoadMore}
              hasMorePhotos={hasMorePhotos}
              hasMoreClusters={hasMoreClusters}
              onToggleSel={(id) => toggleSel(id)}
              selected={sel}
              thumbAspect={"square"}
              resolvePhotographerName={(id) => {
                const p = resolver.photographerById.get(String(id));
                return p?.label || id || "—";
              }}
              resolveHotspotName={(id) => {
                const h = resolver.hotspotById.get(String(id));
                return h?.name || id || "—";
              }}
              totalQ={totalQ}
              clearSel={clearSel}
            />
          )}
        </div>
      </div>
    </div>
  );
}
