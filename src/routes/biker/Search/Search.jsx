// src/routes/biker/Search/Search.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  fetchEvent,
  fetchHotspot,
  fetchHotspotsByEvent,
  fetchPhotographers,
  fetchPhotos,
  getRouteName,
  // nuevos “smart” (con fallback a photographer_profile.puntos)
  fetchPhotographersByRouteSmart,
  fetchHotspotsByRouteSmart,
} from "../../../lib/searchApi.js";

import SearchResults from "./SearchResults";
import MultiSelectCheckbox from "./MultiSelectCheckbox.jsx";

/* ================== Constantes ================== */
// Slider 15 min desde 5:00 a 15:00 (igual UX que PhotographerProfile, pero con estos límites)
const STEP_MIN = 5 * 4;   // 5:00 AM
const STEP_MAX = 15 * 4;  // 3:00 PM
const STEP = 1;           // cada “step” = 15 min (manejamos los 15 min internamente)

// Rutas fijas permitidas
const RUTAS_FIJAS = [
  "Ruta Interamericana",
  "RN-14",
  "Carretera al Salvador",
  "Carretera al Atlántico",
  "RN-10 (Cañas)",
];

/* ================== Helpers tiempo ================== */
function clampStep(s) {
  return Math.max(STEP_MIN, Math.min(STEP_MAX, Number(s) || STEP_MIN));
}
function timeToStep(t = "06:00") {
  const [h, m] = (t || "00:00").split(":").map((n) => parseInt(n || "0", 10));
  return clampStep(h * 4 + Math.round((m || 0) / 15));
}
function stepToTime24(s) {
  const clamped = clampStep(s);
  const h = Math.floor(clamped / 4);
  const m = (clamped % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function to12h(time24) {
  const [hStr, mStr] = (time24 || "00:00").split(":");
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}
const csvToArr = (v) => (!v ? [] : v.split(",").filter(Boolean));
const arrToCsv = (a) => (Array.isArray(a) ? a.join(",") : "");

/* ============== DualSlider (idéntico UX a PhotographerProfile, límites 5–15) ============== */
function DualSlider({ min, max, a, b, onChangeA, onChangeB, width = 300 }) {
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
      if (dragging.current === "a") {
        onChangeA(Math.min(val, b - 1));
      } else {
        onChangeB(Math.max(val, a + 1));
      }
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
          aria-label="Hora fin"
          title="Mover hora final"
        />
      </div>
    </div>
  );
}

/* ================== Componente principal ================== */
export default function BikerSearch() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  // ------ Estado de filtros (en una sola fila) ------
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
    return csvToArr(unique);
  }); // ids

  // IA: si venís desde evento/hotspot arranca en 0
  const forcedFromEvent = !!(params.get("evento") || params.get("hotspot"));
  const [confIA, setConfIA] = useState(() => (params.has("conf") ? Number(params.get("conf")) : forcedFromEvent ? 0 : 70));

  // ------ Catálogos / resolutores ------
  const [photogCats, setPhotogCats] = useState([]); // [{id, display_name, ...}]
  const [hotspots, setHotspots] = useState([]);     // [{id, name, ...}]
  const [resolver, setResolver] = useState({
    photographerById: new Map(),
    hotspotById: new Map(),
  });

  // Fotos
  const [allPhotos, setAllPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  // ------ Pre-hidratación si venís de ?evento / ?hotspot ------
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

            // Puntos del evento: sólo para resolver nombres cuando venís directo
            const pts = await fetchHotspotsByEvent(evento);
            if (!alive) return;
            const hsMap = new Map(pts.map((p) => [String(p.id), p]));
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
            if (!selHotspots.length) setSelHotspots([String(hs.id)]);
          }
        }

        // Fotógrafo pre-fijado (dueño del evento o ?photogs=)
        const photogsCsv = params.get("photogs") || (photographer_id ? photographer_id : "");
        const photogIds = csvToArr(photogsCsv);
        if (photogIds.length > 0) {
          const phs = await fetchPhotographers(photogIds);
          if (!alive) return;
          setPhotogCats(phs);
          setResolver((prev) => ({ ...prev, photographerById: new Map(phs.map((p) => [String(p.id), p])) }));
          if (!selPhotogs.length) setSelPhotogs(photogIds);
        }
      } catch (e) {
        console.error("Preconfig buscar:", e);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------ Cargar catálogos cuando elegís RUTA ------
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (ruta === "Todos") {
          setPhotogCats([]);
          setHotspots([]);
          setResolver({ photographerById: new Map(), hotspotById: new Map() });
          if (selPhotogs.length) setSelPhotogs([]);
          if (selHotspots.length) setSelHotspots([]);
          return;
        }

        // 1) Fotógrafos disponibles en la ruta (smart: event_hotspot -> event; fallback: photographer_profile.puntos)
        const phAvail = await fetchPhotographersByRouteSmart(ruta);
        if (!alive) return;
        setPhotogCats(phAvail);
        const phMap = new Map(phAvail.map((p) => [String(p.id), p]));

        // depurar selección fuera de ruta
        const validPhotogs = selPhotogs.filter((id) => phMap.has(String(id)));
        if (validPhotogs.length !== selPhotogs.length) setSelPhotogs(validPhotogs);

        // 2) Puntos disponibles en la ruta, opcionalmente filtrados por fotógrafos
        const hsAvail = await fetchHotspotsByRouteSmart(ruta, validPhotogs);
        if (!alive) return;
        setHotspots(hsAvail);
        const hsMap = new Map(hsAvail.map((h) => [String(h.id), h]));

        const validHotspots = selHotspots.filter((id) => hsMap.has(String(id)));
        if (validHotspots.length !== selHotspots.length) setSelHotspots(validHotspots);

        setResolver({ photographerById: phMap, hotspotById: hsMap });
      } catch (e) {
        console.error("Catálogos por ruta:", e);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta]);

  // ------ Si cambian fotógrafos, recalcular puntos (misma ruta) ------
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (ruta === "Todos") return;
        const hsAvail = await fetchHotspotsByRouteSmart(ruta, selPhotogs);
        if (!alive) return;
        setHotspots(hsAvail);
        const hsMap = new Map(hsAvail.map((h) => [String(h.id), h]));
        const validHotspots = selHotspots.filter((id) => hsMap.has(String(id)));
        if (validHotspots.length !== selHotspots.length) setSelHotspots(validHotspots);
        setResolver((prev) => ({ ...prev, hotspotById: hsMap }));
      } catch (e) {
        console.error("Recalc puntos por fotógrafos:", e);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrToCsv(selPhotogs)]);

  // ------ Cargar fotos (SQL por event_id/hotspot_id/photographer_id; horario en front) ------
  const isSyntheticHotspot = (id) => String(id || "").startsWith("profile:");
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const evento = params.get("evento") || "";
        let hotspot_ids = selHotspots;
        // Si todos los hotspots seleccionados son sintéticos (fallback), NO filtremos por hotspot en SQL
        if (hotspot_ids.length && hotspot_ids.every(isSyntheticHotspot)) {
          hotspot_ids = [];
        }
        const photographer_ids = selPhotogs;

        // Si no hay selección de hotspots y sí hay ruta, podemos traer todos los hotspots REALES de la ruta (no sintéticos)
        if ((!hotspot_ids || hotspot_ids.length === 0) && ruta !== "Todos") {
          const hsAvail = await fetchHotspotsByRouteSmart(ruta, selPhotogs);
          const reales = hsAvail.filter((h) => !isSyntheticHotspot(h.id)).map((h) => String(h.id));
          if (reales.length) hotspot_ids = reales;
        }

        const fotos = await fetchPhotos({
          event_id: evento || undefined,
          hotspot_ids: hotspot_ids && hotspot_ids.length ? hotspot_ids : undefined,
          photographer_ids: photographer_ids && photographer_ids.length ? photographer_ids : undefined,
        });

        if (!alive) return;
        // Marcar ruta seleccionada para la UI (no afecta filtros)
        const fotosWithRoute = ruta !== "Todos" ? fotos.map((f) => ({ ...f, route: ruta })) : fotos;

        setAllPhotos(fotosWithRoute);
      } catch (e) {
        console.error("Cargando fotos:", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta, arrToCsv(selHotspots), arrToCsv(selPhotogs)]);

  // ------ Filtrado front: fecha + horario + IA ------
  const filtered = useMemo(() => {
    const d0 = new Date(fecha + "T00:00:00");
    const start = new Date(d0);
    start.setMinutes((clampStep(iniStep) - STEP_MIN) * 15 + 5 * 60); // normalizado a día
    const end = new Date(d0);
    end.setMinutes((clampStep(finStep) - STEP_MIN) * 15 + 5 * 60 + 59);

    return (allPhotos || []).filter((ph) => {
      if (!ph?.timestamp) return false;
      const d = new Date(ph.timestamp);
      if (isNaN(d)) return false;
      if (!(d >= start && d <= end)) return false;
      if ((ph.aiConfidence || 0) < confIA) return false;
      return true;
    });
  }, [allPhotos, fecha, iniStep, finStep, confIA]);

  // ------ Clusters (momentos) ------
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

  // ------ Vista/Paginación/Selección ------
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

  // ------ Options para dropdowns ------
  const photogOptions = useMemo(
    () => photogCats.map((p) => ({
      value: String(p.id),
      label: p.display_name || p.estudio || p.username || String(p.id),
    })),
    [photogCats]
  );
  const hotspotOptions = useMemo(
    () => hotspots.map((h) => ({ value: String(h.id), label: h.name || h.nombre || String(h.id) })),
    [hotspots]
  );

  return (
    <div className="min-h-screen surface pb-28">
      {/* margen top para despegar del header del biker */}
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        {/* ======= FILA ÚNICA DE FILTROS ======= */}
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
              min={STEP_MIN}
              max={STEP_MAX}
              a={iniStep}
              b={finStep}
              onChangeA={setIniStep}
              onChangeB={setFinStep}
              width={280} // más corto para que quepa en una sola fila
            />
          </div>

          {/* RUTA (fija) */}
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
              options={photogOptions}
              value={selPhotogs}
              onChange={setSelPhotogs}
              placeholder={ruta === "Todos" ? "Elegí una ruta primero" : "Seleccionar fotógrafo(s)"}
            />
          </div>

          {/* PUNTOS (multi) */}
          <div className="min-w-[220px]">
            <label className="block text-sm font-medium text-slate-600">Punto(s)</label>
            <MultiSelectCheckbox
              options={hotspotOptions}
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
                return p?.display_name || p?.estudio || p?.username || id || "—";
              }}
              resolveHotspotName={(id) => {
                const h = resolver.hotspotById.get(String(id));
                return h?.name || h?.nombre || id || "—";
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
