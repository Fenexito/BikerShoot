// src/routes/biker/Search/Search.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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

const ROUTE_ALIAS = {
  "Ruta Interamericana": ["interamericana", "rn-1", "rn1", "ca-1"],
  "RN-14": ["rn-14", "rn14", "ruta nacional 14"],
  "Carretera al Salvador": ["salvador", "ca-1", "carretera al salvador"],
  "Carretera al Atlántico": ["atlántico", "atlantico", "ca-9", "carretera al atlantico"],
  "RN-10 (Cañas)": ["rn-10", "rn10", "cañas", "canas"],
};

const norm = (s) =>
  String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/* ======= Tiempo (paso de 15 min) ======= */
const MIN_STEP = 5 * 4;  // 05:00
const MAX_STEP = 15 * 4; // 15:00
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

/* ======= toYmd util (respetando local time) ======= */
const toYmd = (d) => {
  const date = typeof d === "string" ? new Date(d) : d;
  if (!date || isNaN(date)) return "";
  const off = date.getTimezoneOffset();
  const local = new Date(date.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
};

/* ======= Dual Slider ======= */
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

/* -------------------- Queries auxiliares -------------------- */
// Eventos del/los fotógrafos en la FECHA exacta para esa ruta
async function getEventIdsByDateRouteAndPhotogs({ fechaYmd, routeName, photographerIds = [] }) {
  if (!photographerIds.length || !fechaYmd) return [];
  const alias = (ROUTE_ALIAS[routeName] || [routeName]).map(norm);

  const { data: evs } = await supabase
    .from("event")
    .select("id, fecha, date, ruta, location, photographer_id")
    .in("photographer_id", photographerIds);

  const out = [];
  for (const e of (evs || [])) {
    const dStr = toYmd(e.fecha) || toYmd(e.date);
    if (!dStr || dStr !== fechaYmd) continue;
    const txt = norm(e.ruta || e.location || "");
    if (alias.some((a) => txt.includes(a))) out.push(String(e.id));
  }
  return out;
}

// Eventos (cualquier fotógrafo) por FECHA + RUTA
async function getEventsByDateAndRoute({ fechaYmd, routeName }) {
  if (!fechaYmd || !routeName) return { evIds: [], eventMap: new Map() };
  const alias = (ROUTE_ALIAS[routeName] || [routeName]).map(norm);

  const { data: evs, error } = await supabase
    .from("event")
    .select("id, fecha, date, ruta, location, photographer_id");
  if (error) throw error;

  const evIds = [];
  const eventMap = new Map(); // id -> photographer_id
  for (const e of evs || []) {
    const dStr = toYmd(e.fecha) || toYmd(e.date);
    if (!dStr || dStr !== fechaYmd) continue;
    const txt = norm(e.ruta || e.location || "");
    if (!alias.some((a) => txt.includes(a))) continue;
    evIds.push(String(e.id));
    eventMap.set(String(e.id), e.photographer_id ? String(e.photographer_id) : null);
  }
  return { evIds, eventMap };
}

// Eventos (cualquier fotógrafo) solo por RUTA (ignorar fecha/hora)
async function getEventsByRoute({ routeName }) {
  if (!routeName) return { evIds: [], eventMap: new Map() };
  const alias = (ROUTE_ALIAS[routeName] || [routeName]).map(norm);

  const { data: evs, error } = await supabase
    .from("event")
    .select("id, fecha, date, ruta, location, photographer_id");
  if (error) throw error;

  const evIds = [];
  const eventMap = new Map();
  for (const e of evs || []) {
    const txt = norm(e.ruta || e.location || "");
    if (!alias.some((a) => txt.includes(a))) continue;
    evIds.push(String(e.id));
    eventMap.set(String(e.id), e.photographer_id ? String(e.photographer_id) : null);
  }
  return { evIds, eventMap };
}

/* ==== Helpers Storage (URL pública y listado fallback) ==== */
async function getPublicUrl(storagePath) {
  if (!storagePath) return "";
  const raw = String(storagePath).trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const clean = raw.replace(/^\/+/, "").replace(/^fotos\//i, "");
  const { data } = supabase.storage.from("fotos").getPublicUrl(clean);
  if (data?.publicUrl) return data.publicUrl;
  const signed = await supabase.storage.from("fotos").createSignedUrl(clean, 3600);
  return signed?.data?.signedUrl || "";
}

async function listAssetsFromStorage(eventId, { onlyHotspots = [] } = {}) {
  const root = `events/${eventId}`;
  async function listAllFiles(folder) {
    const acc = [];
    const stack = [folder];
    while (stack.length) {
      const cur = stack.pop();
      const { data } = await supabase.storage.from("fotos").list(cur, { limit: 1000 });
      for (const entry of data || []) {
        if (entry.name && /\.[a-z0-9]{2,4}$/i.test(entry.name)) {
          acc.push(`${cur}/${entry.name}`);
        } else if (entry.name) {
          stack.push(`${cur}/${entry.name}`);
        }
      }
    }
    return acc;
  }
  const files = await listAllFiles(root);
  const items = [];
  for (const p of files) {
    const parts = p.split("/").filter(Boolean);
    const idxEv = parts.indexOf("events");
    const evId = parts[idxEv + 1];
    const hsId = parts[idxEv + 2] || null;
    if (String(evId) !== String(eventId)) continue;
    if (onlyHotspots.length && (!hsId || !onlyHotspots.includes(String(hsId)))) continue;
    const url = await getPublicUrl(p);
    items.push({
      id: p,
      url,
      timestamp: null,
      hotspotId: hsId,
      photographerId: null,
    });
  }
  return items;
}

/* ================== Componente ================== */
export default function BikerSearch() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  const forcedFromEvent = !!(params.get("evento") || params.get("hotspot") || params.get("punto"));

  // -------- filtros (una sola fila) --------
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

  // catálogos y resolutores
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [catalogReady, setCatalogReady] = useState(false);
  const [resolver, setResolver] = useState({
    photographerById: new Map(),
    hotspotById: new Map(),
  });

  // fotos (buscador principal)
  const [allPhotos, setAllPhotos] = useState([]);
  const [allHasMore, setAllHasMore] = useState(false);

  // --- Ocultar filtros al hacer scroll (solo aquí) ---
  const [hideFilters, setHideFilters] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const down = y > last + 6;
      const up = y < last - 6;
      if (down && y > 120) setHideFilters(true);
      else if (up) setHideFilters(false);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
          }
        }
        const eventoParam = params.get("evento");
        if (eventoParam && !selPhotogs.length) {
          const ev = await fetchEvent(eventoParam);
          if (ev?.photographer_id) setSelPhotogs([String(ev.photographer_id)]);
        }
      } catch { /* nop */ }
      if (alive) { /* noop */ }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Cargar catálogo (fotógrafos/puntos por ruta) ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setCatalogReady(false);

        // Catalogo base de fotógrafos con hotspots (por ruta si aplica)
        const { data, error } = await supabase.rpc("get_photographers_cards", {
          p_route: ruta && ruta !== "Todos" ? ruta : null,
        });
        if (error) throw error;

        const phById = new Map();
        const hsById = new Map();
        const tmp = [];

        for (const r of data || []) {
          const phId = String(r.photographer_id);
          phById.set(phId, { name: r.photographer_name });

          const hotspotName = r.hotspot_name;
          const hotspotId = String(r.hotspot_id || "");
          if (hotspotId) hsById.set(hotspotId, { name: hotspotName });

          const row = {
            id: cryptoRandomId(),
            photographerId: phId,
            photographerName: r.photographer_name,
            routeName: r.route_name || ruta || "—",
            hotspotId,
            hotspotName,
          };
          tmp.push(row);
        }

        setRows(tmp);
        setResolver({ photographerById: phById, hotspotById: hsById });
        setCatalogReady(true);
      } catch (e) {
        console.error("Cargar catálogo:", e);
        setRows([]);
        setResolver({ photographerById: new Map(), hotspotById: new Map() });
        setCatalogReady(false);
      } finally {
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [ruta]);

  function cryptoRandomId() {
    try {
      return [...crypto.getRandomValues(new Uint32Array(2))].map((n) => n.toString(16)).join("");
    } catch {
      return String(Math.random()).slice(2);
    }
  }

  /* ---------- Ejecutar búsqueda ---------- */
  async function runSearch() {
    try {
      setLoading(true);
      const fechaParam = toYmd(fecha);

      // ===== Con fotógrafos (prioridad si vienen seteados) =====
      if (selPhotogs.length) {
        // 1) Eventos exactos de esos fotógrafos (por fecha+ruta si no ignoramos hora)
        let evIds = [];
        if (ignorarHora) {
          // todos los eventos de los fotógrafos en la ruta
          const { data: evs } = await supabase
            .from("event")
            .select("id, ruta, location, photographer_id")
            .in("photographer_id", selPhotogs);
          const alias = (ROUTE_ALIAS[ruta] || [ruta]).map(norm);
          evIds = (evs || [])
            .filter((e) => (ruta === "Todos" ? true : alias.some((a) => norm(e.ruta || e.location || "").includes(a))))
            .map((e) => String(e.id));
        } else {
          evIds = await getEventIdsByDateRouteAndPhotogs({
            fechaYmd: fechaParam,
            routeName: ruta,
            photographerIds: selPhotogs,
          });
        }

        if (!evIds.length) {
          setAllPhotos([]);
          setAllHasMore(false);
          return;
        }

        // 2) Si hay hotspots filtrados, acotamos
        let scopedHotspotIds = [];
        if (selHotspots.length) {
          const { data: hsScoped } = await supabase
            .from("event_hotspot")
            .select("id, name, event_id")
            .in("event_id", evIds)
            .in("name", selHotspots);
          scopedHotspotIds = (hsScoped || []).map((h) => String(h.id));
        }

        // 3) Traer assets del event_asset (o del storage como fallback)
        let items = [];
        {
          try {
            let q = supabase
              .from("event_asset")
              .select("id, event_id, hotspot_id, storage_path, taken_at")
              .in("event_id", evIds)
              .order("taken_at", { ascending: false })
              .limit(1200);
            if (scopedHotspotIds.length) q = q.in("hotspot_id", scopedHotspotIds);

            const { data: assets } = await q;
            if (Array.isArray(assets) && assets.length) {
              const tmp = [];
              for (const a of assets) {
                const url = await getPublicUrl(a.storage_path);
                if (!url) continue;
                tmp.push({
                  id: String(a.id),
                  url,
                  timestamp: a.taken_at || null,
                  hotspotId: a.hotspot_id || null,
                  photographerId: selPhotogs[0] || null,
                  route: ruta !== "Todos" ? ruta : null,
                });
              }
              items = tmp;
              console.log("[RESULT B] event_asset items:", items.length);
            } else {
              const merged = [];
              for (const evId of evIds) {
                const listed = await listAssetsFromStorage(evId, {
                  onlyHotspots: scopedHotspotIds.length ? scopedHotspotIds : [],
                });
                merged.push(
                  ...listed.map((it) => ({
                    ...it,
                    photographerId: selPhotogs[0] || null,
                    route: ruta !== "Todos" ? ruta : null,
                  }))
                );
              }
              items = merged;
              console.log("[RESULT C] storage items:", items.length);
            }
          } catch (err) {
            console.log("[RESULT B] event_asset error, fallback storage:", err?.message || err);
            const merged = [];
            for (const evId of evIds) {
              const listed = await listAssetsFromStorage(evId, {
                onlyHotspots: [],
              });
              merged.push(
                ...listed.map((it) => ({
                  ...it,
                  photographerId: selPhotogs[0] || null,
                  route: ruta !== "Todos" ? ruta : null,
                }))
              );
            }
            items = merged;
            console.log("[RESULT C] storage items:", items.length);
          }
        }

        setAllHasMore(false);
        setAllPhotos(Array.isArray(items) ? items : []);
        console.log("[RESULT FINAL] allPhotos:", Array.isArray(items) ? items.length : 0);
        return;
      }

      // ======== SIN FOTÓGRAFOS ========
      if (ruta === "Todos") {
        setAllPhotos([]);
        setAllHasMore(false);
        console.log("[BUSCAR] NO-PHOTOG: ruta=Todos ⇒ 0");
        return;
      }

      let evIds = [];
      let eventMap = new Map(); // id -> photographer_id
      if (ignorarHora) {
        const r = await getEventsByRoute({ routeName: ruta });
        evIds = r.evIds;
        eventMap = r.eventMap;
        console.log("[BUSCAR] NO-PHOTOG ignorarHora=TRUE, eventos x ruta:", evIds.length);
      } else {
        const r = await getEventsByDateAndRoute({ fechaYmd: fechaParam, routeName: ruta });
        evIds = r.evIds;
        eventMap = r.eventMap;
        console.log("[BUSCAR] NO-PHOTOG ignorarHora=FALSE, eventos x fecha+ruta:", evIds.length, "fechaParam:", fechaParam);
      }

      let hotspotIds = [];
      if (selHotspots.length && evIds.length) {
        const { data: hsScoped } = await supabase
          .from("event_hotspot")
          .select("id, name, event_id")
          .in("event_id", evIds)
          .in("name", selHotspots);
        hotspotIds = (hsScoped || []).map((h) => String(h.id));
        const hsMap = new Map((hsScoped || []).map((h) => [String(h.id), { name: h.name }]));
        setResolver((prev) => ({ ...prev, hotspotById: hsMap }));
        console.log("[BUSCAR] NO-PHOTOG hotspots x evento:", hotspotIds.length, hotspotIds);
      }

      // event_asset / storage
      let items = [];
      try {
        let q = supabase
          .from("event_asset")
          .select("id, event_id, hotspot_id, storage_path, taken_at")
          .in("event_id", evIds)
          .order("taken_at", { ascending: false })
          .limit(1500);
        if (hotspotIds.length) q = q.in("hotspot_id", hotspotIds);
        const { data: assets } = await q;

        if (Array.isArray(assets) && assets.length) {
          const tmp = [];
          for (const a of assets) {
            const url = await getPublicUrl(a.storage_path);
            if (!url) continue;
            const pid = eventMap.get(String(a.event_id)) || null;
            tmp.push({
              id: String(a.id),
              url,
              timestamp: a.taken_at || null,
              hotspotId: a.hotspot_id || null,
              photographerId: pid,
              route: ruta,
            });
          }
          items = tmp;
          console.log("[RESULT NO-PHOTOG B] event_asset items:", items.length);
        } else {
          const merged = [];
          for (const evId of evIds) {
            const listed = await listAssetsFromStorage(evId, {
              onlyHotspots: hotspotIds.length ? hotspotIds : [],
            });
            merged.push(
              ...listed.map((it) => ({
                ...it,
                photographerId: eventMap.get(String(evId)) || null,
                route: ruta,
              }))
            );
          }
          items = merged;
          console.log("[RESULT NO-PHOTOG C] storage items:", items.length);
        }
      } catch (e) {
        console.log("[NO-PHOTOG] fallback storage por error:", e?.message || e);
        const merged = [];
        for (const evId of evIds) {
          const listed = await listAssetsFromStorage(evId, { onlyHotspots: [] });
          merged.push(
            ...listed.map((it) => ({
              ...it,
              photographerId: eventMap.get(String(evId)) || null,
              route: ruta,
            }))
          );
        }
        items = merged;
      }

      setAllHasMore(false);
      setAllPhotos(Array.isArray(items) ? items : []);
      console.log("[RESULT NO-PHOTOG FINAL] allPhotos:", Array.isArray(items) ? items.length : 0);
    } catch (e) {
      console.error("Buscar fotos:", e);
      setAllPhotos([]);
      setAllHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  // Ejecutar búsqueda cuando cambian filtros clave
  useEffect(() => {
    if (ruta === "Todos") {
      setAllPhotos([]);
      setAllHasMore(false);
      return;
    }
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta, arrToCsv(selPhotogs), arrToCsv(selHotspots), ignorarHora, iniStep, finStep, fecha]);

  /* ================== Filtro front por fecha/hora ================== */
  const filtered = useMemo(() => {
    const base = Array.isArray(allPhotos) ? allPhotos : [];
    if (ignorarHora) return base.slice();

    const fechaStr = toYmd(fecha);
    const dayStart = new Date(fechaStr + "T00:00:00");
    const dayEnd = new Date(fechaStr + "T23:59:59.999");

    const start = new Date(dayStart);
    start.setMinutes(clampStep(iniStep) * 15, 0, 0);
    const end = new Date(dayStart);
    end.setMinutes(clampStep(finStep) * 15 + 59, 59, 999);

    const out = base.filter((ph) => {
      if (!ph?.timestamp) return true;
      const d = new Date(ph.timestamp);
      if (isNaN(d)) return true;
      return d >= dayStart && d <= dayEnd && d >= start && d <= end;
    });

    return out;
  }, [allPhotos, fecha, iniStep, finStep, ignorarHora]);

  useEffect(() => {
    console.log(
      "[FILTER] base:",
      Array.isArray(allPhotos) ? allPhotos.length : 0,
      "filtered:",
      Array.isArray(filtered) ? filtered.length : 0,
      "ignorarHora:",
      ignorarHora
    );
  }, [allPhotos, filtered, ignorarHora]);

  /* ================== Paginación & selección ================== */
  const [page, setPage] = useState(1);
  const pageSize = 60;
  useEffect(() => { setPage(1); }, [filtered.length]);

  const totalPhotos = filtered.length;
  const paginatedPhotos = useMemo(() => filtered.slice(0, page * pageSize), [filtered, page]);
  const hasMorePhotos = paginatedPhotos.length < totalPhotos;
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

  /* ================== UI ================== */
  return (
    <div className="min-h-screen surface pb-10">{/* ↓ pb reducido para quitar el margen grande al final */}
      {/* Fila de filtros y navegación – FULL WIDTH */}
      <div className="w-screen ml-[calc(50%-50vw)]">
        <div
          className={
            "sticky top-[88px] z-40 border-y border-slate-200 bg-white/95 backdrop-blur " +
            "transition-all duration-300 " +
            (hideFilters ? "-translate-y-3 opacity-0 pointer-events-none" : "translate-y-0 opacity-100")
          }
        >
          <div className="px-2 sm:px-4">
            <div
              className={
                "flex items-center gap-2 sm:gap-3 py-2 " +
                "overflow-x-auto no-scrollbar"
              }
            >
              {/* Inicio */}
              <Link
                to="/app"
                className="shrink-0 h-9 px-3 rounded-lg border bg-white hover:bg-slate-50 text-slate-700"
                title="Ir al inicio"
              >
                Inicio
              </Link>

              <div className="shrink-0 w-px h-6 bg-slate-200 mx-1" />

              {/* Fecha */}
              <label className="shrink-0 flex items-center gap-2 text-sm">
                <span className="text-slate-600">Fecha</span>
                <input
                  type="date"
                  className="h-9 border rounded-lg px-2 bg-white"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </label>

              {/* Hora (toggle + rango) */}
              <label className="shrink-0 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={ignorarHora}
                  onChange={(e) => setIgnorarHora(e.target.checked)}
                />
                <span className="text-slate-600">Ignorar hora</span>
              </label>

              <div className={"shrink-0 " + (ignorarHora ? "opacity-40 pointer-events-none" : "")}>
                <DualSlider
                  min={MIN_STEP}
                  max={MAX_STEP}
                  a={iniStep}
                  b={finStep}
                  onChangeA={setIniStep}
                  onChangeB={setFinStep}
                  width={300}
                />
              </div>

              <div className="shrink-0 w-px h-6 bg-slate-200 mx-1" />

              {/* Ruta */}
              <label className="shrink-0 flex items-center gap-2 text-sm">
                <span className="text-slate-600">Ruta</span>
                <select
                  className="h-9 border rounded-lg px-2 bg-white"
                  value={ruta}
                  onChange={(e) => setRuta(e.target.value)}
                >
                  <option value="Todos">Todas</option>
                  {RUTAS_FIJAS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </label>

              {/* Fotógrafos */}
              <div className="shrink-0">
                <MultiSelectCheckbox
                  label="Fotógrafo(s)"
                  options={Array.from(resolver.photographerById.entries()).map(([id, v]) => ({
                    value: id,
                    label: v?.name || `#${id}`,
                  }))}
                  values={selPhotogs}
                  onChange={setSelPhotogs}
                  disabled={!catalogReady}
                  condensed
                />
              </div>

              {/* Puntos */}
              <div className="shrink-0">
                <MultiSelectCheckbox
                  label="Punto(s)"
                  options={
                    Array.from(resolver.hotspotById.entries()).map(([id, v]) => ({
                      value: v?.name || id,
                      label: v?.name || id,
                    }))
                  }
                  values={selHotspots}
                  onChange={setSelHotspots}
                  disabled={!catalogReady}
                  condensed
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resultados – mismo full width del mosaico */}
      <SearchResults
        paginatedPhotos={paginatedPhotos}
        totalPhotos={totalPhotos}
        onLoadMore={onLoadMore}
        hasMorePhotos={hasMorePhotos}
        onToggleSel={toggleSel}
        selected={sel}
        resolvePhotographerName={(id) => resolver.photographerById.get(String(id))?.name || ""}
        resolveHotspotName={(id) => resolver.hotspotById.get(String(id))?.name || ""}
        totalQ={totalQ}
        clearSel={clearSel}
      />
    </div>
  );
}
