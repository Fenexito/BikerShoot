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
  fetchPhotographersByRoute,
  fetchHotspotsByRoute,
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

/* ======= Dual Slider (igual al del perfil) ======= */
function DualSlider({ min, max, a, b, onChangeA, onChangeB, width = 280 }) {
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

  const [selPhotogs, setSelPhotogs] = useState(() => csvToArr(params.get("photogs")));
  const [selHotspots, setSelHotspots] = useState(() => {
    const unique = params.get("hotspot") || params.get("hotspots");
    return csvToArr(unique);
  });

  const forcedFromEvent = !!(params.get("evento") || params.get("hotspot"));
  const [confIA, setConfIA] = useState(() => (params.has("conf") ? Number(params.get("conf")) : forcedFromEvent ? 0 : 70));

  // catálogos
  const [photogCats, setPhotogCats] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [resolver, setResolver] = useState({
    photographerById: new Map(),
    hotspotById: new Map(),
  });

  // fotos
  const [allPhotos, setAllPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

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

  /* ---------- al elegir RUTA: cargar fotógrafos y puntos ---------- */
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

        // Fotógrafos por ruta
        const phAvail = await fetchPhotographersByRoute(ruta);
        if (!alive) return;
        setPhotogCats(phAvail);
        const phMap = new Map(phAvail.map((p) => [String(p.id), p]));

        // depurar selección fuera de ruta
        const validPhotogs = selPhotogs.filter((id) => phMap.has(String(id)));
        if (validPhotogs.length !== selPhotogs.length) setSelPhotogs(validPhotogs);

        // Puntos por ruta (opcionalmente por fotógrafos)
        const hsAvail = await fetchHotspotsByRoute(ruta, validPhotogs);
        if (!alive) return;
        setHotspots(hsAvail);
        const hsMap = new Map(hsAvail.map((h) => [String(h.id), h]));

        // depurar selección de puntos inválidos
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

  /* ---------- si cambian fotógrafos, recalcular puntos ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (ruta === "Todos") return;
        const hsAvail = await fetchHotspotsByRoute(ruta, selPhotogs);
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

  /* ---------- cargar fotos (hotspots reales; horario en front) ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const evento = params.get("evento") || "";

        let hotspot_ids = selHotspots;
        const photographer_ids = selPhotogs;

        // Si no hay hotspots seleccionados pero hay ruta, traemos TODOS los reales de esa ruta
        if ((!hotspot_ids || hotspot_ids.length === 0) && ruta !== "Todos") {
          const hsAvail = await fetchHotspotsByRoute(ruta, selPhotogs);
          hotspot_ids = hsAvail.map((h) => String(h.id)); // todos son reales
        }

        const fotos = await fetchPhotos({
          event_id: evento || undefined,
          hotspot_ids: hotspot_ids && hotspot_ids.length ? hotspot_ids : undefined,
          photographer_ids: photographer_ids && photographer_ids.length ? photographer_ids : undefined,
        });

        if (!alive) return;
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

  const photogOptions = useMemo(
    () => photogCats.map((p) => ({
      value: String(p.id),
      label: p.display_name || p.estudio || p.username || String(p.id),
    })),
    [photogCats]
  );
  const hotspotOptions = useMemo(
    () => hotspots.map((h) => ({ value: String(h.id), label: h.name || String(h.id) })),
    [hotspots]
  );

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

          {/* FOTÓGRAFO */}
          <div className="min-w-[220px]">
            <label className="block text-sm font-medium text-slate-600">Fotógrafo(s)</label>
            <MultiSelectCheckbox
              options={photogOptions}
              value={selPhotogs}
              onChange={setSelPhotogs}
              placeholder={ruta === "Todos" ? "Elegí una ruta primero" : "Seleccionar fotógrafo(s)"}
            />
          </div>

          {/* PUNTO */}
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
