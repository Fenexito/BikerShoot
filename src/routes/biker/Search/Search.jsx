// src/routes/biker/Search/Search.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  fetchRoutes,              // aunque usamos rutas fijas, lo dejamos por si luego querés validar
  fetchEvent,
  fetchHotspot,
  fetchHotspotsByEvent,
  fetchPhotographers,
  fetchPhotos,
  getRouteName,
  fetchRouteByName,
  fetchPhotographersByRoute,
  fetchHotspotsByRoute,
} from "../../../lib/searchApi.js";

import SearchResults from "./SearchResults";
import MultiSelectCheckbox from "./MultiSelectCheckbox.jsx";

/* ================== Constantes ================== */
// Rango horario: 5:00 a 15:00 en pasos de 15 min
const SLIDER_MIN = 5 * 60;   // 300
const SLIDER_MAX = 15 * 60;  // 900
const SLIDER_STEP = 15;

// Rutas fijas permitidas
const RUTAS_FIJAS = [
  "Ruta Interamericana",
  "RN-14",
  "Carretera al Salvador",
  "Carretera al Atlántico",
  "RN-10 (Cañas)",
];

/* ================== Utils ================== */
const HHMMtoMin = (hhmm) => {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const minToHHMM = (min) => {
  const x = Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, Number(min) || SLIDER_MIN));
  const h = Math.floor(x / 60);
  const m = x % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
const csvToArr = (v) => (!v ? [] : v.split(",").filter(Boolean));
const arrToCsv = (a) => (Array.isArray(a) ? a.join(",") : "");

/* ============ Slider doble clickeable (15 min) ============ */
function RangeTimeSlider({ iniMin, finMin, setIniMin, setFinMin, min = SLIDER_MIN, max = SLIDER_MAX, step = SLIDER_STEP }) {
  // Evitar cruce
  const onIni = (e) => setIniMin(Math.min(Math.max(min, Number(e.target.value)), finMin));
  const onFin = (e) => setFinMin(Math.max(Math.min(max, Number(e.target.value)), iniMin));
  const pct = (v) => ((v - min) / (max - min)) * 100;

  return (
    <div className="w-[340px]">
      <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
        <span>{minToHHMM(iniMin)}</span>
        <span>{minToHHMM(finMin)}</span>
      </div>

      <div className="relative h-8">
        {/* Track base */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 rounded-full bg-slate-200" />

        {/* Rango seleccionado */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-blue-500"
          style={{ left: `${pct(iniMin)}%`, right: `${100 - pct(finMin)}%` }}
        />

        {/* Inputs RANGO (ambos con pointer-events ACTIVOS) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={iniMin}
          onChange={onIni}
          className="absolute w-full appearance-none bg-transparent"
          style={{ zIndex: 30 }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={finMin}
          onChange={onFin}
          className="absolute w-full appearance-none bg-transparent"
          style={{ zIndex: 40 }}
        />

        {/* Thumbs decorativos (el input sigue siendo el control real) */}
        <div
          className="absolute h-4 w-4 rounded-full bg-white border border-slate-300 shadow cursor-pointer"
          style={{ left: `calc(${pct(iniMin)}% - 8px)`, top: "50%", transform: "translateY(-50%)" }}
        />
        <div
          className="absolute h-4 w-4 rounded-full bg-white border border-slate-300 shadow cursor-pointer"
          style={{ left: `calc(${pct(finMin)}% - 8px)`, top: "50%", transform: "translateY(-50%)" }}
        />
      </div>
    </div>
  );
}

/* ================== Componente ================== */
export default function BikerSearch() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  /** ---------- Estado de filtros con margen top ---------- **/
  const [fecha, setFecha] = useState(() => params.get("fecha") || new Date().toISOString().slice(0, 10));
  const [horaIniMin, setHoraIniMin] = useState(() => {
    const p = params.get("inicio");
    const base = p ? HHMMtoMin(p) : 6 * 60; // 06:00
    return Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, base));
  });
  const [horaFinMin, setHoraFinMin] = useState(() => {
    const p = params.get("fin");
    const base = p ? HHMMtoMin(p) : 12 * 60; // 12:00
    return Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, base));
  });

  // Ruta fija (default "Todos" para no filtrar)
  const [ruta, setRuta] = useState(() => {
    const r = params.get("ruta");
    return r && RUTAS_FIJAS.includes(r) ? r : "Todos";
  });

  // Multi-selects
  const [selPhotogs, setSelPhotogs] = useState(() => csvToArr(params.get("photogs"))); // ids seleccionados
  const [selHotspots, setSelHotspots] = useState(() => {
    const unique = params.get("hotspot") || params.get("hotspots");
    return csvToArr(unique);
  });

  // IA default 0 si venimos de evento/hotspot
  const forcedFromEvent = !!(params.get("evento") || params.get("hotspot"));
  const [confIA, setConfIA] = useState(() => (params.has("conf") ? Number(params.get("conf")) : forcedFromEvent ? 0 : 70));

  /** ---------- Catálogos / Resolvers ---------- **/
  // Aunque dejamos fetchRoutes, por UI sólo mostramos RUTAS_FIJAS
  const [routes, setRoutes] = useState(RUTAS_FIJAS.map((name, idx) => ({ id: String(idx + 1), name })));
  const [hotspots, setHotspots] = useState([]);    // puntos disponibles según ruta (+ fotógrafos)
  const [photogCats, setPhotogCats] = useState([]); // fotógrafos disponibles según ruta

  const [resolver, setResolver] = useState({
    photographerById: new Map(),
    hotspotById: new Map(),
  });

  /** ---------- Fotos ---------- **/
  const [allPhotos, setAllPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  /** ---------- Pre-hidratación si venimos desde ?evento / ?hotspot ---------- **/
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
            // Ruta: sólo aplicamos si es una de las fijas; si no, dejamos "Todos"
            const r = ev.ruta && RUTAS_FIJAS.includes(ev.ruta) ? ev.ruta : null;
            if (!params.get("ruta") && r) setRuta(r);
            if (!params.get("fecha") && ev.fecha) setFecha(ev.fecha.slice(0, 10));

            if (ev.photographer_id) photographer_id = String(ev.photographer_id);

            // Cargar puntos del evento (para resolver nombres cuando venís directo)
            const pts = await fetchHotspotsByEvent(evento);
            if (!alive) return;
            setResolver((prev) => ({ ...prev, hotspotById: new Map(pts.map((p) => [String(p.id), p])) }));
          }
        }

        if (hotspotParam) {
          const hs = await fetchHotspot(hotspotParam);
          if (hs) {
            if (!params.get("inicio") && hs.horaIni) setHoraIniMin(Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, HHMMtoMin(hs.horaIni))));
            if (!params.get("fin") && hs.horaFin) setHoraFinMin(Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, HHMMtoMin(hs.horaFin))));
            // Intentar ruta por route_id del hotspot
            if (!params.get("ruta") && hs.route_id) {
              const name = await getRouteName(hs.route_id);
              if (name && RUTAS_FIJAS.includes(name)) setRuta(name);
            }
            if (!selHotspots.length) setSelHotspots([String(hs.id)]);
          }
        }

        // Fotógrafos bloqueados desde URL o dueño del evento
        const photogsCsv = params.get("photogs") || (photographer_id ? photographer_id : "");
        const photogIds = csvToArr(photogsCsv);
        if (photogIds.length > 0) {
          const phs = await fetchPhotographers(photogIds);
          if (!alive) return;
          setPhotogCats((prev) => {
            // si ya cargamos por ruta luego, esto se puede sobreescribir; por ahora, dejamos que aparezcan
            return phs;
          });
          setResolver((prev) => ({ ...prev, photographerById: new Map(phs.map((p) => [String(p.id), p])) }));
          if (!selPhotogs.length) setSelPhotogs(photogIds);
        }
      } catch (e) {
        console.error("Error preconfig buscando:", e);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** ---------- Cargar catálogos en función de la RUTA (y fotógrafos seleccionados) ---------- **/
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Si ruta = "Todos", dejamos listas vacías para obligar a escoger una ruta (como pediste).
        if (ruta === "Todos") {
          setPhotogCats([]);
          setHotspots([]);
          setResolver((prev) => ({ ...prev, hotspotById: new Map(), photographerById: new Map() }));
          // Limpiar selecciones que ya no aplican
          if (selPhotogs.length) setSelPhotogs([]);
          if (selHotspots.length) setSelHotspots([]);
          return;
        }

        // 1) Fotógrafos disponibles en la ruta
        const phAvail = await fetchPhotographersByRoute(ruta);
        if (!alive) return;
        setPhotogCats(phAvail);
        const phMap = new Map(phAvail.map((p) => [String(p.id), p]));

        // Si algún fotógrafo seleccionado no está en la ruta, lo limpiamos
        let newSelPhotogs = selPhotogs.filter((id) => phMap.has(String(id)));
        if (newSelPhotogs.length !== selPhotogs.length) {
          setSelPhotogs(newSelPhotogs);
        }

        // 2) Puntos disponibles en la ruta, refinados por fotógrafos (si hay)
        const hsAvail = await fetchHotspotsByRoute(ruta, newSelPhotogs);
        if (!alive) return;
        setHotspots(hsAvail);
        const hsMap = new Map(hsAvail.map((h) => [String(h.id), h]));

        // Si algún hotspot seleccionado ya no pertenece a esta ruta/photogs, lo limpiamos
        let newSelHotspots = selHotspots.filter((id) => hsMap.has(String(id)));
        if (newSelHotspots.length !== selHotspots.length) {
          setSelHotspots(newSelHotspots);
        }

        setResolver({ photographerById: phMap, hotspotById: hsMap });
      } catch (e) {
        console.error("Error cargando catálogos por ruta:", e);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta]);

  /** ---------- Si cambian fotógrafos, recalcular puntos (misma ruta) ---------- **/
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (ruta === "Todos") return;
        const hsAvail = await fetchHotspotsByRoute(ruta, selPhotogs);
        if (!alive) return;
        setHotspots(hsAvail);
        const hsMap = new Map(hsAvail.map((h) => [String(h.id), h]));
        // depurar selecciones inválidas
        let newSelHotspots = selHotspots.filter((id) => hsMap.has(String(id)));
        if (newSelHotspots.length !== selHotspots.length) {
          setSelHotspots(newSelHotspots);
        }
        setResolver((prev) => ({ ...prev, hotspotById: hsMap }));
      } catch (e) {
        console.error("Error recalculando puntos por fotógrafos:", e);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrToCsv(selPhotogs)]);

  /** ---------- Cargar fotos (SQL: event_id/hotspot_id/photographer_id; horario en front) ---------- **/
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const evento = params.get("evento") || "";

        // Hotspots a consultar:
        // - si hay selección explícita -> usarla
        // - sino, si hay ruta elegida -> todos los hotspots de esa ruta (filtrados por fotógrafos si hay)
        // - sino -> undefined (sin filtro por hotspot)
        let hotspot_ids = selHotspots;
        if ((!hotspot_ids || hotspot_ids.length === 0) && ruta !== "Todos") {
          const hsAvail = await fetchHotspotsByRoute(ruta, selPhotogs);
          hotspot_ids = hsAvail.map((h) => String(h.id));
        }

        const photographer_ids = selPhotogs;

        const fotos = await fetchPhotos({
          event_id: evento || undefined,
          hotspot_ids: hotspot_ids && hotspot_ids.length ? hotspot_ids : undefined,
          photographer_ids: photographer_ids && photographer_ids.length ? photographer_ids : undefined,
        });

        if (!alive) return;

        // Si hay una ruta elegida, podemos marcarla en cada foto (para UI, opcional)
        const fotosWithRoute = ruta !== "Todos"
          ? fotos.map((f) => ({ ...f, route: ruta }))
          : fotos;

        setAllPhotos(fotosWithRoute);
      } catch (e) {
        console.error("Error cargando fotos:", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta, arrToCsv(selHotspots), arrToCsv(selPhotogs)]);

  /** ---------- Filtro en front: fecha + horario + IA ---------- **/
  const filtered = useMemo(() => {
    const d0 = new Date(fecha + "T00:00:00");
    const start = new Date(d0);
    start.setMinutes(horaIniMin, 0, 0);
    const end = new Date(d0);
    end.setMinutes(horaFinMin, 59, 999);

    return (allPhotos || []).filter((ph) => {
      if (!ph?.timestamp) return false;
      const d = new Date(ph.timestamp);
      if (isNaN(d)) return false;

      if (!(d >= start && d <= end)) return false;
      if ((ph.aiConfidence || 0) < confIA) return false;

      return true;
    });
  }, [allPhotos, fecha, horaIniMin, horaFinMin, confIA]);

  /** ---------- Clusters (momentos) ---------- **/
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

  /** ---------- Vista, paginación, selección ---------- **/
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

  /** ---------- Options para dropdowns multi ---------- **/
  const photogOptions = useMemo(
    () =>
      photogCats.map((p) => ({
        value: String(p.id),
        label: p.display_name || p.estudio || p.username || String(p.id),
      })),
    [photogCats]
  );

  const hotspotOptions = useMemo(
    () =>
      hotspots.map((h) => ({
        value: String(h.id),
        label: h.name || String(h.id),
      })),
    [hotspots]
  );

  return (
    <div className="min-h-screen surface pb-28">
      {/* pt-8: margencito top para despegar del header del biker */}
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        {/* ======= FILTROS ARRIBA ======= */}
        <div className="flex flex-wrap items-end gap-4">

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

          {/* HORA INICIO - HORA FINAL (slider doble 5am–3pm) */}
          <div>
            <label className="block text-sm font-medium text-slate-600">Hora (inicio - fin)</label>
            <RangeTimeSlider
              iniMin={horaIniMin}
              finMin={horaFinMin}
              setIniMin={setHoraIniMin}
              setFinMin={setHoraFinMin}
              min={SLIDER_MIN}
              max={SLIDER_MAX}
              step={SLIDER_STEP}
            />
          </div>

          {/* RUTA (single, fijas) */}
          <div>
            <label className="block text-sm font-medium text-slate-600">Ruta</label>
            <select
              className="h-9 border rounded-lg px-2 bg-white min-w-[220px]"
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
          <div className="min-w-[240px]">
            <label className="block text-sm font-medium text-slate-600">Fotógrafo(s)</label>
            <MultiSelectCheckbox
              options={photogOptions}
              value={selPhotogs}
              onChange={setSelPhotogs}
              placeholder={ruta === "Todos" ? "Elegí una ruta primero" : "Seleccionar fotógrafo(s)"}
            />
          </div>

          {/* PUNTOS (multi) */}
          <div className="min-w-[240px]">
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
