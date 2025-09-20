// src/routes/biker/Search/hooks/useBikerSearch.js
import React from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../../../lib/supabaseClient";
import {
  RUTAS_FIJAS, ROUTE_ALIAS, norm,
  MIN_STEP, MAX_STEP, clampStep,
  timeToStep, stepToTime24,
  toYmd, csvToArr, arrToCsv,
  getPublicUrl, listAssetsFromStorage,
  getEventRouteIdsByName, getHotspotsByRouteIds,
  getEventIdsByDateRouteAndPhotogs, getEventsByDateAndRoute, getEventsByRoute,
  cryptoRandomId,
} from "../lib/searchShared";
import { fetchPhotos } from "../../../../lib/searchApi";

// -------------------- useSearchFilters --------------------
export function useSearchFilters() {
  const [params] = useSearchParams();
  const forcedFromEvent = !!(params.get("evento") || params.get("hotspot") || params.get("punto"));

  const [fecha, setFecha] = React.useState(() => params.get("fecha") || new Date().toISOString().slice(0, 10));
  const [iniStep, _setIniStep] = React.useState(() => clampStep(timeToStep(params.get("inicio") || "06:00")));
  const [finStep, _setFinStep] = React.useState(() => clampStep(timeToStep(params.get("fin") || "12:00")));
  const [ignorarHora, setIgnorarHora] = React.useState(() => !forcedFromEvent);
  const [ruta, setRuta] = React.useState(() => {
    const r = params.get("ruta");
    return r && RUTAS_FIJAS.includes(r) ? r : "Todos";
  });

  const [selPhotogs, setSelPhotogs] = React.useState(() => csvToArr(params.get("photogs")));
  const [selHotspots, setSelHotspots] = React.useState(() => (params.get("punto") ? [params.get("punto")] : []));

  // ===== Controles de vista (persistentes) =====
  const [cols, setCols] = React.useState(() => {
    try { return Math.max(4, Math.min(12, parseInt(localStorage.getItem("view.cols") || "6", 10))); }
    catch { return 6; }
  });
  const [showLabels, setShowLabels] = React.useState(() => {
    try { return localStorage.getItem("view.showLabels") === "1"; }
    catch { return false; }
  });
  React.useEffect(() => {
    try { localStorage.setItem("view.cols", String(Math.max(4, Math.min(12, cols)))); } catch {}
  }, [cols]);
  React.useEffect(() => {
    try { localStorage.setItem("view.showLabels", showLabels ? "1" : "0"); } catch {}
  }, [showLabels]);

  // setters que aceptan HH:MM opcional (por compat con prefill)
  const setIniStep = (valOrPrev, hhmmMaybe) => {
    if (typeof valOrPrev === "number") return _setIniStep(clampStep(valOrPrev));
    if (typeof hhmmMaybe === "string") return _setIniStep(clampStep(timeToStep(hhmmMaybe)));
    return _setIniStep((s) => clampStep(s));
  };
  const setFinStep = (valOrPrev, hhmmMaybe) => {
    if (typeof valOrPrev === "number") return _setFinStep(clampStep(valOrPrev));
    if (typeof hhmmMaybe === "string") return _setFinStep(clampStep(timeToStep(hhmmMaybe)));
    return _setFinStep((s) => clampStep(s));
  };

  // pinned (barra fija al pasar header ~90px)
  const [pinned, setPinned] = React.useState(false);
  React.useEffect(() => {
    const HEADER_H = 90;
    const onScroll = () => setPinned(window.scrollY >= HEADER_H);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return {
    fecha, setFecha,
    iniStep, setIniStep,
    finStep, setFinStep,
    ignorarHora, setIgnorarHora,
    ruta, setRuta,
    selPhotogs, setSelPhotogs,
    selHotspots, setSelHotspots,
    pinned,
    forcedFromEvent,
    // nuevos
    cols, setCols,
    showLabels, setShowLabels,
  };
}

// -------------------- useSearchCatalog --------------------
export function useSearchCatalog({
  ruta, selPhotogs, setSelPhotogs, selHotspots, setSelHotspots, setResolver,
}) {
  const [rows, setRows] = React.useState([]);
  const [loadingCatalog, setLoadingCatalog] = React.useState(false);
  const [catalogReady, setCatalogReady] = React.useState(false);

  // Cargar fotógrafos/puntos por RPC
  React.useEffect(() => {
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
        setLoadingCatalog(true);
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

        const phMap = new Map(mapped.map((p) => [p.id, { label: p.estudio || p.username || p.id }]));
        setResolver((prev) => ({ ...prev, photographerById: phMap }));
      } catch (e) {
        console.error("RPC get_photographers_cards:", e);
      } finally {
        if (alive) {
          setLoadingCatalog(false);
          setCatalogReady(true);
        }
      }
    })();
    return () => { alive = false; };
  }, [ruta, setResolver]);

  // Opciones multi
  const photogOptions = React.useMemo(() => {
    const list = rows.filter((r) => (r.rutas || []).includes(ruta));
    return list
      .map((p) => ({ value: p.id, label: p.estudio || p.username || p.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, ruta]);

  const hotspotOptions = React.useMemo(() => {
    const base = rows.filter((r) => (r.rutas || []).includes(ruta));
    const filteredByPhotog = selPhotogs.length > 0 ? base.filter((r) => selPhotogs.includes(r.id)) : base;
    const set = new Set(filteredByPhotog.flatMap((r) => (r.puntos || []).map((p) => String(p))));
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name, label: name }));
  }, [rows, ruta, arrToCsv(selPhotogs)]);

  // Limpieza post-catálogo
  React.useEffect(() => {
    if (!catalogReady) return;
    const validPhotogIds = new Set(photogOptions.map((o) => String(o.value)));
    const cleanedPhotogs = selPhotogs.filter((id) => validPhotogIds.has(String(id)));
    if (cleanedPhotogs.length !== selPhotogs.length) setSelPhotogs(cleanedPhotogs);

    const validHotspotNames = new Set(hotspotOptions.map((o) => String(o.value)));
    const cleanedHotspots = selHotspots.filter((nm) => validHotspotNames.has(String(nm)));
    if (cleanedHotspots.length !== selHotspots.length) setSelHotspots(cleanedHotspots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogReady, photogOptions.length, hotspotOptions.length]);

  // API pública para que Search.jsx meta hotspots por nombre cuando viene ?evento
  const mergeHotspotNamesIntoResolver = React.useCallback((hsMapByIdToName) => {
    setResolver((prev) => ({ ...prev, hotspotById: new Map(hsMapByIdToName) }));
  }, [setResolver]);

  return {
    loadingCatalog,
    photogOptions,
    hotspotOptions,
    mergeHotspotNamesIntoResolver,
  };
}

// -------------------- useSearchPhotos --------------------
export function useSearchPhotos({
  fecha, iniStep, finStep, ignorarHora,
  ruta, selPhotogs, selHotspots,
  resolver, setResolver,
}) {
  const [allPhotos, setAllPhotos] = React.useState([]);
  const [allHasMore, setAllHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function runSearch() {
    try {
      setLoading(true);

      const fechaParam = toYmd(fecha) || new Date().toISOString().slice(0, 10);
      const inicioHHMM = stepToTime24(iniStep);
      const finHHMM = stepToTime24(finStep);

      // ======== CON FOTÓGRAFOS ========
      if (selPhotogs.length > 0) {
        let routeIds =
          ruta !== "Todos"
            ? await getEventRouteIdsByName(ruta, {
                photographerIds: selPhotogs,
                eventId: null,
              })
            : [];

        // Eventos por fecha+ruta (o solo ruta si ignorás)
        let evIdsScope = [];
        if (ruta !== "Todos") {
          if (ignorarHora) {
            const { evIds } = await getEventsByRoute({ routeName: ruta });
            evIdsScope = evIds;
          } else {
            const evIds = await getEventIdsByDateRouteAndPhotogs({
              fechaYmd: fechaParam,
              routeName: ruta,
              photographerIds: selPhotogs,
            });
            evIdsScope = evIds;
          }
        }

        if ((!routeIds || routeIds.length === 0) && evIdsScope.length) {
          const { data: routesEvs } = await supabase
            .from("event_route")
            .select("id, event_id, name")
            .in("event_id", evIdsScope);
          const alias = (ROUTE_ALIAS[ruta] || [ruta]).map(norm);
          const keep = (routesEvs || []).filter((r) => alias.some((a) => norm(r.name).includes(a)));
          if (keep.length) routeIds = keep.map((r) => String(r.id));
        }

        // Hotspots acotados al evento
        let hotspotIds = [];
        if (selHotspots.length && evIdsScope.length) {
          const { data: hsScoped } = await supabase
            .from("event_hotspot")
            .select("id, name, route_id, event_id")
            .in("event_id", evIdsScope)
            .in("name", selHotspots);
          hotspotIds = (hsScoped || []).map((h) => String(h.id));
          const hsMap = new Map((hsScoped || []).map((h) => [String(h.id), { name: h.name }]));
          setResolver((prev) => ({ ...prev, hotspotById: hsMap }));
        } else if (routeIds.length && selHotspots.length) {
          const hs = await getHotspotsByRouteIds(routeIds, { names: selHotspots });
          hotspotIds = hs.map((h) => String(h.id));
          const hsMap = new Map(hs.map((h) => [String(h.id), { name: h.name }]));
          setResolver((prev) => ({ ...prev, hotspotById: hsMap }));
        } else if (routeIds.length) {
          const hs = await getHotspotsByRouteIds(routeIds);
          const hsMap = new Map(hs.map((h) => [String(h.id), { name: h.name }]));
          setResolver((prev) => ({ ...prev, hotspotById: hsMap }));
        }

        // A) fetchPhotos (si falla/0 → B/C)
        let items = [];
        try {
          const resp = await fetchPhotos({
            routeIds,
            hotspotIds,
            photographerIds: selPhotogs,
            fecha: ignorarHora ? undefined : fechaParam,
            inicioHHMM: ignorarHora ? undefined : inicioHHMM,
            finHHMM: ignorarHora ? undefined : finHHMM,
            ignorarHora,
            page: 0,
            limit: 200,
          });

          const arr = Array.isArray(resp) ? resp : Array.isArray(resp?.items) ? resp.items : [];
          const normed = [];
          for (const x of arr) {
            const id = x.id || x.asset_id || x.storage_path || x.url || cryptoRandomId();
            const url = x.url || (x.storage_path ? await getPublicUrl(x.storage_path) : "");
            if (!url) continue;
            normed.push({
              id: String(id),
              url,
              timestamp: x.timestamp || x.taken_at || x.created_at || null,
              hotspotId: x.hotspotId || x.hotspot_id || null,
              photographerId: x.photographerId
                || x.photographer_id
                || (selPhotogs.length === 1 ? selPhotogs[0] : null),
              route: ruta !== "Todos" ? ruta : (x.route || null),
            });
          }
          items = normed;
        } catch (e) {
          // caemos a B/C
        }

        // B/C) event_asset o Storage
        if (!items.length && (evIdsScope.length || routeIds.length)) {
          const evIds = evIdsScope.slice();
          if (!evIds.length && routeIds.length) {
            const { data: evFromRoutes } = await supabase.from("event_route").select("event_id").in("id", routeIds);
            const uniq = Array.from(new Set((evFromRoutes || []).map((r) => String(r.event_id)).filter(Boolean)));
            evIds.push(...uniq);
          }

          // 🔑 Mapa: event_id -> photographer_id (para etiquetar bien cada foto)
            let eventPhotogMap = new Map();
            if (evIds.length) {
                const { data: evInfo } = await supabase
                .from("event")
                .select("id, photographer_id")
                .in("id", evIds);
                for (const e of evInfo || []) {
                eventPhotogMap.set(String(e.id), e.photographer_id ? String(e.photographer_id) : null);
                }
            }

          let scopedHotspotIds = [];
          if (selHotspots.length) {
            const { data: hsScoped } = await supabase
              .from("event_hotspot")
              .select("id, name, event_id")
              .in("event_id", evIds)
              .in("name", selHotspots);
            scopedHotspotIds = (hsScoped || []).map((h) => String(h.id));
          }

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
                  photographerId: eventPhotogMap.get(String(a.event_id))
                    || (selPhotogs.length === 1 ? selPhotogs[0] : null),
                  route: ruta !== "Todos" ? ruta : null,
                });
              }
              items = tmp;
            } else {
              const merged = [];
              for (const evId of evIds) {
                const listed = await listAssetsFromStorage(evId, {
                  onlyHotspots: scopedHotspotIds.length ? scopedHotspotIds : [],
                });
                const pid = eventPhotogMap.get(String(evId))
                  || (selPhotogs.length === 1 ? selPhotogs[0] : null);
                merged.push(
                  ...listed.map((it) => ({
                    ...it,
                    photographerId: pid,
                    route: ruta !== "Todos" ? ruta : null,
                  }))
                );
              }
              items = merged;
            }
          } catch (err) {
            const merged = [];
            for (const evId of evIds) {
              const listed = await listAssetsFromStorage(evId, { onlyHotspots: [] });
                merged.push(
                ...listed.map((it) => ({
                    ...it,
                    photographerId: pid,
                    route: ruta !== "Todos" ? ruta : null,
                })))
            }
            items = merged;
          }
        }

        setAllHasMore(false);
        setAllPhotos(Array.isArray(items) ? items : []);
        return;
      }

      // ======== SIN FOTÓGRAFOS ========
      if (ruta === "Todos") {
        setAllPhotos([]);
        setAllHasMore(false);
        return;
      }

      let evIds = [];
      let eventMap = new Map(); // id -> photographer_id
      if (ignorarHora) {
        const r = await getEventsByRoute({ routeName: ruta });
        evIds = r.evIds;
        eventMap = r.eventMap;
      } else {
        const r = await getEventsByDateAndRoute({ fechaYmd: fechaParam, routeName: ruta });
        evIds = r.evIds;
        eventMap = r.eventMap;
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
        } else {
          const merged = [];
          for (const evId of evIds) {
            const listed = await listAssetsFromStorage(evId, {
              onlyHotspots: hotspotIds.length ? hotspotIds : [],
            });
            const pid = eventMap.get(String(evId)) || null;
            merged.push(
              ...listed.map((it) => ({
                ...it,
                photographerId: pid,
                route: ruta,
              }))
            );
          }
          items = merged;
        }
      } catch (e) {
        items = [];
      }

      setAllHasMore(false);
      setAllPhotos(Array.isArray(items) ? items : []);
    } catch (e) {
      console.error("Buscar fotos:", e);
      setAllPhotos([]);
      setAllHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  // Filtro front por fecha/hora
  const filtered = React.useMemo(() => {
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

  // Paginación & selección
  const [page, setPage] = React.useState(1);
  const pageSize = 60;
  React.useEffect(() => { setPage(1); }, [filtered.length]);

  const totalPhotos = filtered.length;
  const paginatedPhotos = React.useMemo(() => filtered.slice(0, page * pageSize), [filtered, page]);
  const hasMorePhotos = paginatedPhotos.length < totalPhotos;
  const onLoadMore = () => setPage((p) => p + 1);

  const [sel, setSel] = React.useState(() => new Set());
  const onToggleSel = (id) =>
    setSel((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const clearSel = () => setSel(new Set());
  const totalQ = React.useMemo(() => sel.size * 50, [sel]);

  return {
    loading, runSearch,
    paginatedPhotos, totalPhotos, hasMorePhotos, onLoadMore,
    selected: sel, onToggleSel, clearSel, totalQ,
  };
}
