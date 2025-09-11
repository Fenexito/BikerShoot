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

/* ======= Helpers Supabase (NUEVOS / corregidos) ======= */

/** Devuelve TODOS los event_route.id cuyo name machee, opcionalmente filtrados por fotógrafos o evento. */
async function getEventRouteIdsByName(routeName, { photographerIds = [], eventId = null } = {}) {
  if (!routeName) return [];
  let base = supabase.from("event_route").select("id, name, event_id");

  base = base.ilike("name", routeName.trim());

  if (eventId) {
    base = base.eq("event_id", eventId);
  } else if (Array.isArray(photographerIds) && photographerIds.length > 0) {
    // Saco los eventos de esos fotógrafos y filtro routes por esos event_id
    const { data: evs, error: errEvs } = await supabase
      .from("event")
      .select("id, photographer_id")
      .in("photographer_id", photographerIds);
    if (errEvs) throw errEvs;
    const evIds = (evs || []).map((e) => String(e.id));
    if (evIds.length === 0) return [];
    base = base.in("event_id", evIds);
  }

  const { data, error } = await base;
  if (error) throw error;
  return (data || []).map((r) => String(r.id));
}

/** Lista de hotspots (id,name) para VARIOS route_id */
async function getAllHotspotsForRoute(routeName, opts) {
  const routeIds = await getEventRouteIdsByName(routeName, opts);
  if (!routeIds.length) return [];
  const { data, error } = await supabase
    .from("event_hotspot")
    .select("id, name, route_id")
    .in("route_id", routeIds);
  if (error) throw error;
  return data || [];
}

/** Mapea nombres de puntos → IDs de hotspot considerando VARIOS route_id */
async function mapPointNamesToHotspotIds(routeName, pointNames = [], opts) {
  if (!routeName || !pointNames?.length) return [];
  const routeIds = await getEventRouteIdsByName(routeName, opts);
  if (!routeIds.length) return [];
  const { data, error } = await supabase
    .from("event_hotspot")
    .select("id, name, route_id")
    .in("route_id", routeIds)
    .in("name", pointNames);
  if (error) throw error;
  return (data || []).map((r) => String(r.id));
}

/* ================== Componente ================== */
export default function BikerSearch() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  // -------- flags de origen (evento/hotspot) --------
  const forcedFromEvent = !!(params.get("evento") || params.get("hotspot") || params.get("punto"));

  // -------- filtros en una sola fila --------
  const [fecha, setFecha] = useState(() => params.get("fecha") || new Date().toISOString().slice(0, 10));
  const [iniStep, setIniStep] = useState(() => clampStep(timeToStep(params.get("inicio") || "06:00")));
  const [finStep, setFinStep] = useState(() => clampStep(timeToStep(params.get("fin") || "12:00")));

  // 🔥 Ignorar fecha y hora (por defecto, activado si NO venís de evento/hotspot)
  const [ignorarHora, setIgnorarHora] = useState(() => !forcedFromEvent);

  const [ruta, setRuta] = useState(() => {
    const r = params.get("ruta");
    return r && RUTAS_FIJAS.includes(r) ? r : "Todos";
  });

  // Multi-selects (fotógrafo: IDs, punto: NOMBRES)
  const [selPhotogs, setSelPhotogs] = useState(() => csvToArr(params.get("photogs")));
  const [selHotspots, setSelHotspots] = useState(() => {
    const fromPunto = params.get("punto");
    return fromPunto ? [fromPunto] : [];
  });

  // catálogos (RPC)
  const [rows, setRows] = useState([]);         // {id, rutas[], puntos[]}
  const [loading, setLoading] = useState(false);
  const [catalogReady, setCatalogReady] = useState(false);

  // resolutores
  const [resolver, setResolver] = useState({
    photographerById: new Map(),   // id -> {label}
    hotspotById: new Map(),        // hotspot_id -> {name}
  });

  // fotos
  const [allPhotos, setAllPhotos] = useState([]);

  /* ---------- si venís de ?evento/?hotspot: prefills ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const hotspotParam = params.get("hotspot"); // UUID real
        if (hotspotParam) {
          const hs = await fetchHotspot(hotspotParam);
          if (hs) {
            // ruta por route_id del hotspot
            if (!params.get("ruta") && hs.route_id) {
              const name = await getRouteName(hs.route_id);
              if (name && RUTAS_FIJAS.includes(name)) setRuta(name);
            }
            // horas
            if (!params.get("inicio") && hs.horaIni) setIniStep(clampStep(timeToStep(hs.horaIni)));
            if (!params.get("fin") && hs.horaFin) setFinStep(clampStep(timeToStep(hs.horaFin)));
            // punto por NOMBRE
            if (!params.get("punto") && hs.name) {
              setSelHotspots([String(hs.name)]);
            }
            // fotógrafo dueño del evento del hotspot
            if (!selPhotogs.length && hs.event_id) {
              const evOfHotspot = await fetchEvent(hs.event_id);
              if (evOfHotspot?.photographer_id) {
                setSelPhotogs([String(evOfHotspot.photographer_id)]);
              }
            }
            // si venís de botón, respetá horas -> desactiva "ignorar hora"
            setIgnorarHora(false);
          }
        }
        // Si vino explícito ?photogs=
        const photogsCsv = params.get("photogs");
        if (photogsCsv && !selPhotogs.length) {
          setSelPhotogs(csvToArr(photogsCsv));
        }

        // Resolver del evento (si vino ?evento=) para nombres de hotspots directos
        const evento = params.get("evento");
        if (evento) {
          const pts = await fetchHotspotsByEvent(evento);
          if (!alive) return;
          const hsMap = new Map(pts.map((p) => [String(p.id), { name: p.name }]));
          setResolver((prev) => ({ ...prev, hotspotById: hsMap }));
        }
      } catch (e) {
        console.error("Preconfig buscar:", e);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- cargar fotógrafos y puntos vía RPC (igual photographers.jsx) ---------- */
  useEffect(() => {
    let alive = true;
    setCatalogReady(false);
    (async () => {
      try {
        if (ruta === "Todos") {
          setRows([]);
          setResolver((prev) => ({ ...prev, photographerById: new Map() }));
          setCatalogReady(true);
          return;
        }
        setLoading(true);
        const { data, error } = await supabase.rpc("get_photographers_cards", {
          q: null,
          ruta,
          punto: null,
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
          puntos: Array.isArray(r.puntos) ? r.puntos : [], // strings (nombres)
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
        if (alive) {
          setLoading(false);
          setCatalogReady(true);
        }
      }
    })();
    return () => { alive = false; };
  }, [ruta]);

  /* ---------- opciones para selects (multi) ---------- */
  const photogOptions = useMemo(() => {
    const list = rows.filter((r) => (r.rutas || []).includes(ruta));
    return list
      .map((p) => ({ value: p.id, label: resolver.photographerById.get(p.id)?.label || p.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, ruta, resolver.photographerById]);

  const hotspotOptions = useMemo(() => {
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

  /* ---------- aplicar prefill SOLO cuando ya hay catálogo ---------- */
  useEffect(() => {
    if (!catalogReady) return;

    // Punto
    const puntoParam = params.get("punto");
    if (puntoParam && !selHotspots.length) {
      const ok = hotspotOptions.some((o) => o.value === puntoParam);
      if (ok) setSelHotspots([puntoParam]);
    }

    // Photogs
    const photogsCsv = params.get("photogs");
    if (photogsCsv && !selPhotogs.length) {
      const ids = csvToArr(photogsCsv);
      const validIds = new Set(photogOptions.map((o) => String(o.value)));
      const keep = ids.filter((id) => validIds.has(id));
      if (keep.length) setSelPhotogs(keep);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogReady, photogOptions.length, hotspotOptions.length]);

  /* ---------- NO limpiar selecciones hasta que el catálogo esté listo ---------- */
  useEffect(() => {
    if (!catalogReady) return;
    const validPhotogIds = new Set(photogOptions.map((o) => String(o.value)));
    const cleanedPhotogs = selPhotogs.filter((id) => validPhotogIds.has(String(id)));
    if (cleanedPhotogs.length !== selPhotogs.length) setSelPhotogs(cleanedPhotogs);

    const validHotspotNames = new Set(hotspotOptions.map((o) => String(o.value)));
    const cleanedHotspots = selHotspots.filter((nm) => validHotspotNames.has(String(nm)));
    if (cleanedHotspots.length !== selHotspots.length) setSelHotspots(cleanedHotspots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogReady, photogOptions.length, hotspotOptions.length]);

  /* ================== Ejecutar búsqueda ================== */
  const [vista, setVista] = useState("mosaico");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const fechaStr = fecha; // 'YYYY-MM-DD'
  const inicioHHMM = stepToTime24(iniStep);
  const finHHMM = stepToTime24(finStep);

  async function doSearch(resetPage = true) {
    try {
      // Resolver routeIds según ruta seleccionada y fotógrafos (si hay)
      let routeIds = [];
      if (ruta && ruta !== "Todos") {
        routeIds = await getEventRouteIdsByName(ruta, {
          photographerIds: selPhotogs.length ? selPhotogs : [],
          eventId: params.get("evento") || null,
        });
      }

      // Resolver hotspotIds según nombres (si hay y hay ruta)
      let hotspotIds = [];
      if (routeIds.length && selHotspots.length) {
        hotspotIds = await mapPointNamesToHotspotIds(ruta, selHotspots, {
          photographerIds: selPhotogs.length ? selPhotogs : [],
          eventId: params.get("evento") || null,
        });
      }

      const nextPage = resetPage ? 0 : page + 1;
      const res = await fetchPhotos({
        routeIds,
        hotspotIds,
        photographerIds: selPhotogs,
        fecha: fechaStr,
        inicioHHMM,
        finHHMM,
        ignorarHora,
        page: nextPage,
        limit: 200,
      });

      const items = res.items || [];
      setHasMore(!!res.hasMore);

      if (resetPage) {
        setAllPhotos(items);
        setPage(0);
      } else {
        const map = new Map(allPhotos.map((x) => [x.id, x]));
        for (const it of items) map.set(it.id, it);
        setAllPhotos(Array.from(map.values()));
        setPage(nextPage);
      }
    } catch (e) {
      console.error("Buscar fotos:", e);
    }
  }

  useEffect(() => {
    // search al cargar si hay ruta fija
    if (ruta !== "Todos") {
      doSearch(true);
    } else {
      setAllPhotos([]);
      setHasMore(false);
      setPage(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta, arrToCsv(selPhotogs), arrToCsv(selHotspots), fechaStr, ignorarHora, inicioHHMM, finHHMM]);

  /* ================== UI ================== */
  const totalPhotos = allPhotos.length;
  const paginatedPhotos = allPhotos; // ya paginamos vía API

  const resolvePhotographerName = (id) => {
    return resolver.photographerById.get(String(id))?.label || "—";
  };
  const resolveHotspotName = (id) => {
    return resolver.hotspotById.get(String(id))?.name || "—";
  };

  const onToggleSel = (id) =>
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const clearSel = () => setSelected(new Set());

  return (
    <main className="w-full max-w-6xl mx-auto px-4 md:px-6 xl:px-8 py-6">
      <header className="mb-4">
        <h1 className="text-2xl md:text-3xl font-black">Buscar fotos</h1>
        <p className="text-slate-600 mt-1 text-sm">
          Filtrá por fecha, ruta, fotógrafo y punto. Si venís desde un evento/punto, respetamos su horario.
        </p>
      </header>

      {/* ====== Barra de filtros (NO SE TOCA TU UX) ====== */}
      <section className="mb-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-xs text-slate-500">Fecha</label>
          <input
            type="date"
            className="h-10 border rounded-lg px-2 bg-white w-full"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>

        <div className="flex flex-col">
          <label className="block text-xs text-slate-500 mb-1">Ruta</label>
          <select
            className="h-10 border rounded-lg px-2 bg-white"
            value={ruta}
            onChange={(e) => setRuta(e.target.value)}
          >
            <option value="Todos">Todas</option>
            {RUTAS_FIJAS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="block text-xs text-slate-500 mb-1">Fotógrafo(s)</label>
          <MultiSelectCheckbox
            options={useMemo(() => photogOptions, [photogOptions])}
            value={selPhotogs}
            onChange={setSelPhotogs}
            placeholder="Seleccionar estudio(s)…"
          />
        </div>

        <div className="flex flex-col">
          <label className="block text-xs text-slate-500 mb-1">Punto(s)</label>
          <MultiSelectCheckbox
            options={useMemo(() => hotspotOptions, [hotspotOptions])}
            value={selHotspots}
            onChange={setSelHotspots}
            placeholder="Seleccionar punto(s)…"
          />
        </div>
      </section>

      {/* Rango de hora + toggle ignorar */}
      <section className="mb-4 flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={ignorarHora}
            onChange={(e) => setIgnorarHora(e.target.checked)}
          />
          <span>Ignorar fecha/hora</span>
        </label>

        {!ignorarHora && (
          <DualSlider
            min={MIN_STEP}
            max={MAX_STEP}
            a={iniStep}
            b={finStep}
            onChangeA={setIniStep}
            onChangeB={setFinStep}
            width={280}
          />
        )}

        <button
          type="button"
          onClick={() => doSearch(true)}
          className="ml-auto h-10 px-4 rounded-lg bg-blue-600 text-white font-display font-bold"
        >
          Buscar
        </button>
      </section>

      {/* Resultados */}
      <SearchResults
        vista={vista}
        setVista={setVista}
        paginatedPhotos={paginatedPhotos}
        totalPhotos={totalPhotos}
        paginatedClusters={[]}  // por ahora no usamos "momentos"
        totalClusters={0}
        onLoadMore={() => doSearch(false)}
        hasMorePhotos={hasMore}
        hasMoreClusters={false}
        onToggleSel={onToggleSel}
        selected={selected}
        thumbAspect="3:4"
        resolvePhotographerName={resolvePhotographerName}
        resolveHotspotName={resolveHotspotName}
        totalQ={null}
        clearSel={clearSel}
      />
    </main>
  );
}
