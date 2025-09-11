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

/* ======= Helpers Supabase (CORRECTOS) ======= */
// 👇 Reemplaza tu getEventRouteIdsByName por esta versión más tolerante
async function getEventRouteIdsByName(routeName, { photographerIds = [], eventId = null } = {}) {
  if (!routeName) return [];

  // Alias por ruta fija (ajustá si tus datos usan otros nombres)
  const ALIAS = {
    "Ruta Interamericana": ["interamericana", "rn-1", "rn1", "interamericana (rn-1)"],
    "RN-14": ["rn-14", "rn14", "ruta nacional 14"],
    "Carretera al Salvador": ["salvador", "ca-1", "carretera al salvador"],
    "Carretera al Atlántico": ["atlántico", "atlantico", "ca-9", "carretera al atlántico"],
    "RN-10 (Cañas)": ["rn-10", "rn10", "cañas", "canas"],
  };
  const wanted = String(routeName || "").trim();
  const alias = (ALIAS[wanted] || [wanted])
    .map(t => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase());

  // 1) Traer candidates de event_route (filtrados por event si aplica)
  let q = supabase.from("event_route").select("id, name, event_id");
  if (eventId) q = q.eq("event_id", eventId);

  // si hay fotógrafos, primero sacamos sus eventos y filtramos por esos event_id
  if (!eventId && Array.isArray(photographerIds) && photographerIds.length) {
    const { data: evs, error: evErr } = await supabase
      .from("event")
      .select("id, photographer_id")
      .in("photographer_id", photographerIds);
    if (evErr) throw evErr;
    const evIds = (evs || []).map(e => String(e.id));
    if (evIds.length === 0) return [];
    q = q.in("event_id", evIds);
  }

  const { data: routes, error } = await q;
  if (error) throw error;

  // 2) Matching tolerante por texto (client-side)
  const norm = s => String(s || "")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

  const matched = (routes || []).filter(r => {
    const n = norm(r.name);
    return alias.some(a => n.includes(a));
  });

  // 3) Si no encontramos nada, último intento: buscar por columnas de la tabla event
  if (matched.length === 0 && Array.isArray(photographerIds) && photographerIds.length) {
    const { data: evs2 } = await supabase
      .from("event")
      .select("id, ruta, location")
      .in("photographer_id", photographerIds);
    const evIds2 = [];
    for (const e of (evs2 || [])) {
      const txt = norm(e.ruta || e.location || "");
      if (alias.some(a => txt.includes(a))) evIds2.push(String(e.id));
    }
    if (evIds2.length) {
      const { data: routes2 } = await supabase
        .from("event_route").select("id, name, event_id")
        .in("event_id", evIds2);
      const again = (routes2 || []).filter(r => alias.some(a => norm(r.name).includes(a)));
      return again.map(r => String(r.id));
    }
  }

  return matched.map(r => String(r.id));
}

/** 2) Todos los hotspots de varias rutas (routeIds) */
async function getHotspotsByRouteIds(routeIds = [], { names = [] } = {}) {
  if (!routeIds.length) return [];
  let q = supabase.from("event_hotspot").select("id, name, route_id").in("route_id", routeIds);
  if (names?.length) q = q.in("name", names.map(String));
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/* ================== Componente ================== */
export default function BikerSearch() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  const forcedFromEvent = !!(params.get("evento") || params.get("hotspot") || params.get("punto"));

  // -------- filtros (una sola fila, intacto) --------
  const [fecha, setFecha] = useState(() => params.get("fecha") || new Date().toISOString().slice(0, 10));
  const [iniStep, setIniStep] = useState(() => clampStep(timeToStep(params.get("inicio") || "06:00")));
  const [finStep, setFinStep] = useState(() => clampStep(timeToStep(params.get("fin") || "12:00")));
  const [ignorarHora, setIgnorarHora] = useState(() => !forcedFromEvent);
  const [ruta, setRuta] = useState(() => {
    const r = params.get("ruta");
    return r && RUTAS_FIJAS.includes(r) ? r : "Todos";
  });

  // Multi-selects (fotógrafo: IDs, punto: NOMBRES)
  const [selPhotogs, setSelPhotogs] = useState(() => csvToArr(params.get("photogs")));
  const [selHotspots, setSelHotspots] = useState(() => (params.get("punto") ? [params.get("punto")] : []));

  // catálogos (RPC → misma UX)
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [catalogReady, setCatalogReady] = useState(false);

  const [resolver, setResolver] = useState({
    photographerById: new Map(),
    hotspotById: new Map(),
  });

  const [allPhotos, setAllPhotos] = useState([]);

  /* ---------- Prefill si venís de ?hotspot/?evento ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const hotspotParam = params.get("hotspot");
        if (hotspotParam) {
          const hs = await fetchHotspot(hotspotParam);
          if (hs) {
            if (!params.get("ruta") && hs.route_id) {
              const name = await getRouteName(hs.route_id);
              if (name && RUTAS_FIJAS.includes(name)) setRuta(name);
            }
            if (!params.get("inicio") && hs.horaIni) setIniStep(clampStep(timeToStep(hs.horaIni)));
            if (!params.get("fin") && hs.horaFin) setFinStep(clampStep(timeToStep(hs.horaFin)));
            if (!params.get("punto") && hs.name) setSelHotspots([String(hs.name)]);
            if (!selPhotogs.length && hs.event_id) {
              const ev = await fetchEvent(hs.event_id);
              if (ev?.photographer_id) setSelPhotogs([String(ev.photographer_id)]);
            }
            setIgnorarHora(false);
          }
        }
        const photogsCsv = params.get("photogs");
        if (photogsCsv && !selPhotogs.length) setSelPhotogs(csvToArr(photogsCsv));

        const evento = params.get("evento");
        if (evento) {
          const pts = await fetchHotspotsByEvent(evento);
          if (!alive) return;
          const hsMap = new Map((pts || []).map((p) => [String(p.id), { name: p.name }]));
          setResolver((prev) => ({ ...prev, hotspotById: hsMap }));
        }
      } catch (e) {
        console.error("Preconfig buscar:", e);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Cargar fotógrafos/puntos (RPC) ---------- */
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

        const mapped = (data || []).map((r) => ({
          id: String(r.id),
          estudio: r.estudio,
          username: (r.username || "").replace(/^@/, ""),
          rutas: Array.isArray(r.rutas) ? r.rutas : [],
          puntos: Array.isArray(r.puntos) ? r.puntos : [],
        }));
        if (!alive) return;
        setRows(mapped);

        const phMap = new Map(
          mapped.map((p) => [p.id, { label: p.estudio || p.username || p.id }])
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

  /* ---------- Opciones multi ---------- */
  const photogOptions = useMemo(() => {
    const list = rows.filter((r) => (r.rutas || []).includes(ruta));
    return list
      .map((p) => ({ value: p.id, label: resolver.photographerById.get(p.id)?.label || p.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, ruta, resolver.photographerById]);

  const hotspotOptions = useMemo(() => {
    const base = rows.filter((r) => (r.rutas || []).includes(ruta));
    const filteredByPhotog = selPhotogs.length > 0 ? base.filter((r) => selPhotogs.includes(r.id)) : base;
    const set = new Set(filteredByPhotog.flatMap((r) => (r.puntos || []).map((p) => String(p))));
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name, label: name }));
  }, [rows, ruta, arrToCsv(selPhotogs)]);

  /* ---------- Limpieza de selecciones inválidas al cargar catálogo ---------- */
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

  /* ================== Buscar fotos (modo compat) ================== */
  const [allHasMore, setAllHasMore] = useState(false);

  async function runSearch(reset = true) {
    try {
      setLoading(true);

      // 1) Resolver routeIds correctos (event_route)
      let routeIds = ruta !== "Todos"
        ? await getEventRouteIdsByName(ruta, {
            photographerIds: selPhotogs.length ? selPhotogs : [],
            eventId: params.get("evento") || null,
          })
        : [];

        if ((!routeIds || routeIds.length === 0) && selHotspots.length) {
          const { data: hsByName } = await supabase
            .from("event_hotspot")
            .select("id, name, route_id")
            .in("name", selHotspots);
          const rs = Array.from(new Set((hsByName || []).map(h => String(h.route_id)).filter(Boolean)));
          if (rs.length) {
            console.log("[BUSCAR][fallback por puntos] routeIds:", rs);
            routeIds = rs;
          }
        }

        // 🧠 2.5) Filtro por FECHA + alias de Ruta + Punto para amarrar el evento correcto
        if ((!routeIds || routeIds.length === 0) && ruta !== "Todos" && (selPhotogs?.length || 0) > 0) {
          // normalizar fecha "YYYY-MM-DD" → rango del día
          const fechaStr = (typeof fecha === "string" ? fecha : new Date().toISOString().slice(0,10));
          const dayStart = `${fechaStr}T00:00:00`;
          const dayEnd   = `${fechaStr}T23:59:59.999`;

          // alias tolerantes para Interamericana
          const alias = ["interamericana", "rn-1", "rn1", "ca-1"].map(s =>
            s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
          );
          const norm = (s) => String(s||"").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

          // 1) eventos del/los fotógrafos ese día
          const { data: evs } = await supabase
            .from("event")
            .select("id, fecha, date, ruta, location, photographer_id")
            .in("photographer_id", selPhotogs);

          const evIdsByDay = [];
          for (const e of (evs || [])) {
            // fecha del evento en cualquiera de los dos campos
            const fIso = e.fecha || e.date || null;
            if (!fIso) continue;
            const d = new Date(fIso);
            if (isNaN(d)) continue;
            const iso = d.toISOString();
            if (iso >= new Date(dayStart).toISOString() && iso <= new Date(dayEnd).toISOString()) {
              // check alias de ruta contra ruta/location
              const txt = norm(e.ruta || e.location || "");
              if (alias.some(a => txt.includes(a))) {
                evIdsByDay.push(String(e.id));
              }
            }
          }

          // 2) si hay eventos del día, tratar de obtener routeIds desde el hotspot por NOMBRE
          if (evIdsByDay.length) {
            let routeIdsFromHotspot = [];
            if (selHotspots.length) {
              const { data: hs } = await supabase
                .from("event_hotspot")
                .select("id, name, route_id, event_id")
                .in("event_id", evIdsByDay)
                .in("name", selHotspots);
              routeIdsFromHotspot = Array.from(
                new Set((hs || []).map(h => String(h.route_id)).filter(Boolean))
              );
            }

            // 3) si con hotspot no salió, sacar routeIds desde event_route del mismo evento
            if (!routeIdsFromHotspot.length) {
              const { data: routesEvs } = await supabase
                .from("event_route")
                .select("id, event_id, name")
                .in("event_id", evIdsByDay);
              // filtrar por alias de Interamericana
              const keep = (routesEvs || []).filter(r => alias.some(a => norm(r.name).includes(a)));
              routeIdsFromHotspot = keep.map(r => String(r.id));
            }

            if (routeIdsFromHotspot.length) {
              console.log("[BUSCAR][por fecha+punto] routeIds:", routeIdsFromHotspot);
              routeIds = routeIdsFromHotspot; // ← gracias al 'let' de arriba
            }
          }
        }

        // 🛟 Fallback que ya tenías: derivar desde puntos si aún vacío
        if ((!routeIds || routeIds.length === 0) && selHotspots.length) {
          const { data: hsByName } = await supabase
            .from("event_hotspot")
            .select("id, name, route_id")
            .in("name", selHotspots);
          const rs = Array.from(new Set((hsByName || []).map(h => String(h.route_id)).filter(Boolean)));
          if (rs.length) {
            console.log("[BUSCAR][fallback por puntos] routeIds:", rs);
            routeIds = rs;
          }
        }

      // 2) Resolver hotspotIds por nombre sobre esas rutas
      let hotspotIds = [];
      if (routeIds.length && selHotspots.length) {
        const hs = await getHotspotsByRouteIds(routeIds, { names: selHotspots });
        hotspotIds = hs.map((h) => String(h.id));
        // cache nombres
        const hsMap = new Map(hs.map((h) => [String(h.id), { name: h.name }]));
        setResolver((prev) => ({ ...prev, hotspotById: hsMap }));
      } else if (routeIds.length) {
        const hs = await getHotspotsByRouteIds(routeIds);
        const hsMap = new Map(hs.map((h) => [String(h.id), { name: h.name }]));
        setResolver((prev) => ({ ...prev, hotspotById: hsMap }));
      }

      // 3) Intentar fetchPhotos “estilo nuevo” (routeIds[])
      const fechaParam = typeof fecha === "string" ? fecha : new Date().toISOString().slice(0,10);
      const inicioHHMM = stepToTime24(iniStep);
      const finHHMM = stepToTime24(finStep);

      console.log("[BUSCAR] ruta:", ruta, "routeIds:", routeIds, "hotspotIds:", hotspotIds, "photogs:", selPhotogs);

      const tryNew = await fetchPhotos({
        routeIds,
        hotspotIds,
        photographerIds: selPhotogs,
        fecha: fechaParam,
        inicioHHMM,
        finHHMM,
        ignorarHora,
        page: 0,
        limit: 200,
      }).catch(() => null);

      let items = [];
      let hasMore = false;

      if (tryNew && (Array.isArray(tryNew) || Array.isArray(tryNew.items))) {
        const arr = Array.isArray(tryNew) ? tryNew : tryNew.items;
        items = Array.isArray(arr) ? arr : [];
        hasMore = !Array.isArray(tryNew) && !!tryNew.hasMore;
      } else {
        // 4) Compat: fan-out por cada route_id usando la firma vieja { route_id, hotspot_ids, photographer_ids }
        const merged = new Map();
        const routeList = routeIds.length ? routeIds : [null]; // si no hay ruta, probá sin route_id
        for (const rId of routeList) {
          const resp = await fetchPhotos({
            event_id: params.get("evento") || undefined,
            hotspot_ids: hotspotIds.length ? hotspotIds : undefined,
            photographer_ids: selPhotogs.length ? selPhotogs : undefined,
            route_id: rId || undefined,
          }).catch(() => null);

          const arr = Array.isArray(resp) ? resp : Array.isArray(resp?.items) ? resp.items : [];
          for (const it of arr) merged.set(it.id, it);
          hasMore = hasMore || (!!resp && !Array.isArray(resp) && !!resp.hasMore);
        }
        items = Array.from(merged.values());
      }

      // 5) Guardar
      setAllHasMore(hasMore);
      setAllPhotos(Array.isArray(items) ? items : []);
    } catch (e) {
      console.error("Buscar fotos:", e);
      setAllPhotos([]);
      setAllHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  // Disparar cuando cambian filtros base (como lo tenías)
  useEffect(() => {
    if (ruta === "Todos") {
      setAllPhotos([]);
      setAllHasMore(false);
      return;
    }
    runSearch(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta, arrToCsv(selPhotogs), arrToCsv(selHotspots), ignorarHora, iniStep, finStep]);

  /* ================== Filtro front por fecha/hora ================== */
  const filtered = useMemo(() => {
    const base = Array.isArray(allPhotos) ? allPhotos : []; // blindaje
    if (ignorarHora) return base.slice();

    const fechaStr = fecha;
    const dayStart = new Date(fechaStr + "T00:00:00");
    const dayEnd = new Date(fechaStr + "T23:59:59.999");

    const start = new Date(dayStart);
    start.setMinutes(clampStep(iniStep) * 15, 0, 0);
    const end = new Date(dayStart);
    end.setMinutes(clampStep(finStep) * 15 + 59, 59, 999);

    return base.filter((ph) => {
      if (!ph?.timestamp) return false;
      const d = new Date(ph.timestamp);
      if (isNaN(d)) return false;
      return d >= dayStart && d <= dayEnd && d >= start && d <= end;
    });
  }, [allPhotos, fecha, iniStep, finStep, ignorarHora]);

  /* ================== Paginación & selección (igual) ================== */
  const clusters = useMemo(() => [], [filtered]);
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
        {/* ======= una sola fila (NO se movió) ======= */}
        <div className="flex flex-wrap items-end gap-3">
          {/* FECHA */}
          <div>
            <label className="block text-sm font-medium text-slate-600">Fecha</label>
            <input
              type="date"
              className="h-9 border rounded-lg px-2 bg-white"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              disabled={ignorarHora}
              title={ignorarHora ? "Ignorando fecha/hora" : ""}
            />
          </div>

          {/* HORA */}
          <div className="min-w-[260px]">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-600">Hora (inicio–fin)</label>
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={ignorarHora}
                  onChange={(e) => setIgnorarHora(e.target.checked)}
                />
                Ignorar fecha/hora
              </label>
            </div>
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
              options={useMemo(() => {
                const list = rows.filter((r) => (r.rutas || []).includes(ruta));
                return list
                  .map((p) => ({ value: p.id, label: resolver.photographerById.get(p.id)?.label || p.id }))
                  .sort((a, b) => a.label.localeCompare(b.label));
              }, [rows, ruta, resolver.photographerById])}
              value={selPhotogs}
              onChange={setSelPhotogs}
              placeholder={ruta === "Todos" ? "Elegí una ruta primero" : "Seleccionar fotógrafo(s)"}
            />
          </div>

          {/* PUNTO (multi) */}
          <div className="min-w-[220px]">
            <label className="block text-sm font-medium text-slate-600">Punto(s)</label>
            <MultiSelectCheckbox
              options={useMemo(() => {
                const base = rows.filter((r) => (r.rutas || []).includes(ruta));
                const filteredByPhotog = selPhotogs.length > 0 ? base.filter((r) => selPhotogs.includes(r.id)) : base;
                const set = new Set(filteredByPhotog.flatMap((r) => (r.puntos || []).map((p) => String(p))));
                return Array.from(set)
                  .sort((a, b) => a.localeCompare(b))
                  .map((name) => ({ value: name, label: name }));
              }, [rows, ruta, arrToCsv(selPhotogs)])}
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
              thumbAspect={"3:4"}
              resolvePhotographerName={(id) => resolver.photographerById.get(String(id))?.label || id || "—"}
              resolveHotspotName={(id) => resolver.hotspotById.get(String(id))?.name || id || "—"}
              totalQ={totalQ}
              clearSel={clearSel}
            />
          )}
        </div>
      </div>
    </div>
  );
}
