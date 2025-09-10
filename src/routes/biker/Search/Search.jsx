// src/routes/biker/Search/Search.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  fetchRoutes,
  fetchEvent,
  fetchHotspot,
  fetchHotspotsByEvent,
  fetchPhotographers,
  fetchPhotos,
  getRouteName,
} from "../../../lib/searchApi.js";

import SearchResults from "./SearchResults";
import MultiSelectCheckbox from "./MultiSelectCheckbox.jsx";

/* ================== Utils ================== */
const HHMMtoMin = (hhmm) => {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const minToHHMM = (min) => {
  const x = Math.max(0, Math.min(1439, Number(min) || 0));
  const h = Math.floor(x / 60);
  const m = x % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
const csvToArr = (v) => (!v ? [] : v.split(",").filter(Boolean));
const arrToCsv = (a) => (Array.isArray(a) ? a.join(",") : "");

/* Rango horario con doble slider (paso 15 min) */
function RangeTimeSlider({ iniMin, finMin, setIniMin, setFinMin, min = 0, max = 1439, step = 15 }) {
  // Evitar que se crucen
  const onIni = (e) => setIniMin(Math.min(Number(e.target.value), finMin));
  const onFin = (e) => setFinMin(Math.max(Number(e.target.value), iniMin));
  const pct = (v) => ((v - min) / (max - min)) * 100;

  return (
    <div className="w-[320px]">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>{minToHHMM(iniMin)}</span>
        <span>{minToHHMM(finMin)}</span>
      </div>
      <div className="relative h-8">
        {/* Track */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 rounded-full bg-slate-200" />
        {/* Selected range */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-blue-500"
          style={{ left: `${pct(iniMin)}%`, right: `${100 - pct(finMin)}%` }}
        />
        {/* Two range inputs superpuestos */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={iniMin}
          onChange={onIni}
          className="absolute w-full appearance-none bg-transparent pointer-events-none"
          style={{ zIndex: 20 }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={finMin}
          onChange={onFin}
          className="absolute w-full appearance-none bg-transparent pointer-events-none"
          style={{ zIndex: 20 }}
        />
        {/* Thumbs (visuales clicables) */}
        <div
          className="absolute -mt-2 h-4 w-4 rounded-full bg-white border border-slate-300 shadow cursor-pointer"
          style={{ left: `calc(${pct(iniMin)}% - 8px)`, top: "50%", transform: "translateY(-50%)" }}
        />
        <div
          className="absolute -mt-2 h-4 w-4 rounded-full bg-white border border-slate-300 shadow cursor-pointer"
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

  /** ---------- Estado de filtros (con margen top) ---------- **/
  const [fecha, setFecha] = useState(() => params.get("fecha") || new Date().toISOString().slice(0, 10));
  const [horaIniMin, setHoraIniMin] = useState(() => {
    const p = params.get("inicio");
    return p ? HHMMtoMin(p) : 6 * 60; // 06:00
  });
  const [horaFinMin, setHoraFinMin] = useState(() => {
    const p = params.get("fin");
    return p ? HHMMtoMin(p) : 12 * 60; // 12:00
  });

  const [ruta, setRuta] = useState(() => params.get("ruta") || "Todos");
  const [selPhotogs, setSelPhotogs] = useState(() => csvToArr(params.get("photogs"))); // multi
  const [selHotspots, setSelHotspots] = useState(() => {
    const unique = params.get("hotspot") || params.get("hotspots");
    return csvToArr(unique);
  }); // multi

  // IA por default en 0 si venimos de evento/punto
  const forcedFromEvent = !!(params.get("evento") || params.get("hotspot"));
  const [confIA, setConfIA] = useState(() => (params.has("conf") ? Number(params.get("conf")) : forcedFromEvent ? 0 : 70));

  /** ---------- Catálogos backend ---------- **/
  const [routes, setRoutes] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [photogCats, setPhotogCats] = useState([]);

  // maps auxiliares para mostrar nombres correctos:
  const [resolver, setResolver] = useState({
    photographerById: new Map(),
    hotspotById: new Map(),
  });

  /** ---------- Datos de fotos ---------- **/
  const [allPhotos, setAllPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  /** ---------- Cargar rutas activas al inicio ---------- **/
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetchRoutes();
        if (!alive) return;
        setRoutes(r);
      } catch (e) {
        console.error("Error cargando rutas:", e);
      }
    })();
    return () => { alive = false; };
  }, []);

  /** ---------- Hidratar desde ?evento / ?hotspot ---------- **/
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
            if (!params.get("ruta") && ev.ruta) setRuta(ev.ruta);
            if (!params.get("fecha") && ev.fecha) setFecha(ev.fecha.slice(0, 10));

            if (ev.photographer_id) photographer_id = String(ev.photographer_id);

            // cargar puntos del evento
            const pts = await fetchHotspotsByEvent(evento);
            if (!alive) return;
            setHotspots(pts);
            setResolver((prev) => ({ ...prev, hotspotById: new Map(pts.map((p) => [String(p.id), p])) }));
          }
        }

        if (hotspotParam) {
          const hs = await fetchHotspot(hotspotParam);
          if (hs) {
            if (!params.get("inicio") && hs.horaIni) setHoraIniMin(HHMMtoMin(hs.horaIni.slice(0, 5)));
            if (!params.get("fin") && hs.horaFin) setHoraFinMin(HHMMtoMin(hs.horaFin.slice(0, 5)));
            if (!params.get("ruta") && hs.route_id) {
              const name = await getRouteName(hs.route_id);
              if (name) setRuta(name);
            }
            // asegurar que el hotspot llegue seleccionado
            if (!selHotspots.length) setSelHotspots([String(hs.id)]);
          }
        }

        // fotógrafos bloqueados en URL o dueño del evento
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
        console.error("Error preconfig buscando:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** ---------- Cargar fotos (SQL: evento/hotspots/fotógrafos; HORARIO solo en front) ---------- **/
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const evento = params.get("evento") || "";
        const hotspotInUrl = params.get("hotspot") || "";
        const hotspot_ids = selHotspots.length ? selHotspots : (hotspotInUrl ? [hotspotInUrl] : []);
        const photographer_ids = selPhotogs;

        const fotos = await fetchPhotos({
          event_id: evento || undefined,
          hotspot_ids: hotspot_ids.length ? hotspot_ids : undefined,
          photographer_ids: photographer_ids.length ? photographer_ids : undefined,
        });
        if (!alive) return;
        setAllPhotos(fotos);
      } catch (e) {
        console.error("Error cargando fotos:", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrToCsv(selHotspots), arrToCsv(selPhotogs), ruta, fecha]);

  /** ---------- Filtro en front: fecha + horario + ruta + IA ---------- **/
  const filtered = useMemo(() => {
    const today = new Date(fecha + "T00:00:00");
    const start = new Date(today);
    start.setMinutes(horaIniMin, 0, 0);
    const end = new Date(today);
    end.setMinutes(horaFinMin, 59, 999);

    return (allPhotos || []).filter((ph) => {
      if (!ph?.timestamp) return false;
      const d = new Date(ph.timestamp);
      if (isNaN(d)) return false;
      // fecha misma (por si hay zonas)
      if (!(d >= start && d <= end)) return false;

      // ruta: si seleccionaste una ruta específica y la foto trae route (lo dejamos opcional)
      if (ruta !== "Todos" && ph.route && ph.route !== ruta) return false;

      // IA mínima
      if ((ph.aiConfidence || 0) < confIA) return false;

      return true;
    });
  }, [allPhotos, fecha, horaIniMin, horaFinMin, ruta, confIA]);

  /** ---------- Clusters (momentos) ---------- **/
  const clusters = useMemo(() => {
    const map = new Map(); // key = YYYY-MM-DDTHH:MM
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

  /** ---------- Vista, paginación y selección ---------- **/
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
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">{/* pt-6 = margen superior */}
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

          {/* HORA INICIO - HORA FINAL (slider doble, 15 min) */}
          <div>
            <label className="block text-sm font-medium text-slate-600">Hora (inicio - fin)</label>
            <RangeTimeSlider
              iniMin={horaIniMin}
              finMin={horaFinMin}
              setIniMin={setHoraIniMin}
              setFinMin={setHoraFinMin}
              step={15}
            />
          </div>

          {/* RUTA (single) */}
          <div>
            <label className="block text-sm font-medium text-slate-600">Ruta</label>
            <select
              className="h-9 border rounded-lg px-2 bg-white min-w-[160px]"
              value={ruta}
              onChange={(e) => setRuta(e.target.value)}
            >
              <option value="Todos">Todos</option>
              {routes.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
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
              placeholder="Seleccionar fotógrafo(s)"
            />
          </div>

          {/* PUNTOS (multi) */}
          <div className="min-w-[220px]">
            <label className="block text-sm font-medium text-slate-600">Punto(s)</label>
            <MultiSelectCheckbox
              options={hotspotOptions}
              value={selHotspots}
              onChange={setSelHotspots}
              placeholder="Seleccionar punto(s)"
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
