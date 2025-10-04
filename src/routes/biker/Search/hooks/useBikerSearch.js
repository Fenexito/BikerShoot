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
  getEventIdsByDateRouteAndPhotogs, getEventsByDateAndRoute,
  cryptoRandomId,
} from "../lib/searchShared";
import { fetchPhotos } from "../../../../lib/searchApi";

/* ======================= useSearchFilters ======================= */
export function useSearchFilters() {
  const [params] = useSearchParams();
  const forcedFromEvent = !!(params.get("evento") || params.get("hotspot") || params.get("punto"));

  const [fecha, setFecha] = React.useState(() => params.get("fecha") || new Date().toISOString().slice(0, 10));
  const [iniStep, _setIniStep] = React.useState(() => clampStep(timeToStep(params.get("inicio") || "06:00")));
  const [finStep, _setFinStep] = React.useState(() => clampStep(timeToStep(params.get("fin") || "12:00")));
  const [ruta, setRuta] = React.useState(() => {
    const r = params.get("ruta");
    return r && RUTAS_FIJAS.includes(r) ? r : "Todos";
  });

  const [selPhotogs, setSelPhotogs] = React.useState(() => csvToArr(params.get("photogs")));
  const [selHotspots, setSelHotspots] = React.useState(() => (params.get("punto") ? [params.get("punto")] : []));

  // ---- Preferencias de vista persistentes ----
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

  // ---- sticky para filtros ----
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
    ruta, setRuta,
    selPhotogs, setSelPhotogs,
    selHotspots, setSelHotspots,
    pinned,
    forcedFromEvent,
    // vista
    cols, setCols,
    showLabels, setShowLabels,
  };
}

/* ======================= useSearchCatalog ======================= */
export function useSearchCatalog({
  ruta, selPhotogs, setSelPhotogs, selHotspots, setSelHotspots, setResolver,
  fecha,
}) {
  const [params] = useSearchParams();
  const fromEventParams = !!(params.get("evento") || params.get("hotspot") || params.get("punto"));

  const [rows, setRows] = React.useState([]);
  const [loadingCatalog, setLoadingCatalog] = React.useState(false);
  const [catalogReady, setCatalogReady] = React.useState(false);

  // Catálogo base de fotógrafos (por ruta)
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

  const [photogOptions, setPhotogOptions] = React.useState([]);
  const [hotspotOptions, setHotspotOptions] = React.useState([]);

  // === HOTFIX: asegurar que los SELECTS muestren la selección inicial aunque las opciones tarden en llegar ===
  React.useEffect(() => {
    if (!Array.isArray(selPhotogs) || selPhotogs.length === 0) return;
    setPhotogOptions((prev) => {
      const prevArr = Array.isArray(prev) ? prev : [];
      const seen = new Set(prevArr.map(o => String(o.value)));
      let changed = false;
      const next = [...prevArr];
      for (const id of selPhotogs) {
        const k = String(id);
        if (!seen.has(k)) {
          // Evitar que se vea el ID crudo: usar label provisional
          next.push({ value: k, label: "Cargando…" });
          seen.add(k);
          changed = true;
        }
      }
      if (!changed) return prevArr;
      const dedup = [];
      const seen2 = new Set();
      for (const o of next) {
        const v = String(o.value);
        if (!seen2.has(v)) { seen2.add(v); dedup.push(o); }
      }
      return dedup;
    });
  }, [selPhotogs]);

  React.useEffect(() => {
    if (!Array.isArray(selHotspots) || selHotspots.length === 0) return;
    setHotspotOptions((prev) => {
      const prevArr = Array.isArray(prev) ? prev : [];
      const seen = new Set(prevArr.map(o => String(o.value)));
      let changed = false;
      const next = [...prevArr];
      for (const name of selHotspots) {
        const k = String(name);
        if (!seen.has(k)) {
          next.push({ value: k, label: "Cargando…" });
          seen.add(k);
          changed = true;
        }
      }
      if (!changed) return prevArr;
      const dedup = [];
      const seen2 = new Set();
      for (const o of next) {
        const v = String(o.value);
        if (!seen2.has(v)) { seen2.add(v); dedup.push(o); }
      }
      return dedup;
    });
  }, [selHotspots]);

  // Opciones reales según FECHA+RUTA con fotos (incluye fallback a Storage)
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (ruta === "Todos") { setPhotogOptions([]); setHotspotOptions([]); return; }
        const ymd = toYmd(fecha);
        if (!ymd) { setPhotogOptions([]); setHotspotOptions([]); return; }

        // Eventos por FECHA+RUTA
        const { evIds, eventMap } = await getEventsByDateAndRoute({ fechaYmd: ymd, routeName: ruta });
        if (!evIds.length) { setPhotogOptions([]); setHotspotOptions([]); return; }

        // Intento A: event_asset
        const { data: assetsA } = await supabase
          .from("event_asset")
          .select("event_id, hotspot_id")
          .in("event_id", evIds)
          .limit(20000);

        let evWithAssets = new Set((assetsA || []).map(a => String(a.event_id)));
        let hotspotIdsFromAssets = new Set((assetsA || []).map(a => a.hotspot_id && String(a.hotspot_id)).filter(Boolean));

        // Fallback B: Storage
        if (!evWithAssets.size) {
          const hsFromStorage = new Set();
          const evsWithFiles = new Set();
          for (const eid of evIds) {
            const listed = await listAssetsFromStorage(eid, { onlyHotspots: [] });
            if (listed && listed.length) {
              evsWithFiles.add(String(eid));
              for (const it of listed) if (it.hotspotId) hsFromStorage.add(String(it.hotspotId));
            }
          }
          evWithAssets = evsWithFiles;
          hotspotIdsFromAssets = hsFromStorage;
        }

        if (!evWithAssets.size) { setPhotogOptions([]); setHotspotOptions([]); return; }

        // Fotógrafos con fotos
        const labelById = new Map(rows.map(r => [String(r.id), r.estudio || r.username || r.id]));
        const needPhotogFor = Array.from(evWithAssets).filter(eid => !eventMap.get(String(eid)));
        if (needPhotogFor.length) {
          const { data: evRows } = await supabase.from("event").select("id, photographer_id").in("id", needPhotogFor);
          for (const row of evRows || []) {
            if (row?.id) eventMap.set(String(row.id), row?.photographer_id ? String(row.photographer_id) : null);
          }
        }
        const phSet = new Set(
          Array.from(evWithAssets)
            .map(eid => eventMap.get(String(eid)) || null)
            .filter(Boolean)
            .map(String)
        );
        const phOptions = Array.from(phSet)
          .map(id => ({ value: id, label: labelById.get(id) || id }))
          .sort((a, b) => a.label.localeCompare(b.label));
        if (!alive) return;
        setPhotogOptions(phOptions);

        // Hotspots con fotos (si hay fotógrafos seleccionados, acotar por esos eventos)
        const selSet = new Set((selPhotogs || []).map(String));
        const candidateEvIds = selSet.size
          ? Array.from(evWithAssets).filter(eid => selSet.has(String(eventMap.get(eid) || "")))
          : Array.from(evWithAssets);

        let hsIdsFinal = [];
        if (assetsA?.length) {
          const hsIds = new Set(
            assetsA
              .filter(a => candidateEvIds.includes(String(a.event_id)) && a.hotspot_id)
              .map(a => String(a.hotspot_id))
          );
          hsIdsFinal = Array.from(hsIds);
        } else {
          hsIdsFinal = Array.from(hotspotIdsFromAssets);
        }

        if (!hsIdsFinal.length) { setHotspotOptions([]); return; }

        const { data: hsRows } = await supabase
          .from("event_hotspot")
          .select("id, name")
          .in("id", hsIdsFinal);

        const uniqNames = Array.from(new Set((hsRows || []).map(h => String(h.name)).filter(Boolean)));
        const hsOptions = uniqNames.sort((a, b) => a.localeCompare(b)).map(name => ({ value: name, label: name }));
        if (!alive) return;
        setHotspotOptions(hsOptions);

        const hsMap = new Map((hsRows || []).map(h => [String(h.id), { name: h.name }]));
        setResolver(prev => ({ ...prev, hotspotById: hsMap }));
      } catch (err) {
        console.error("Catalogo por fecha+ruta:", err);
        if (!alive) return;
        setPhotogOptions([]); setHotspotOptions([]);
      }
    })();
    return () => { alive = false; };
  }, [ruta, fecha, arrToCsv(selPhotogs), rows.length, setResolver]);

  // ====== Revalidar selecciones SOLO cuando cambia el "scope" (fecha/ruta) ======
  const scopeRef = React.useRef(`${fecha}__${ruta}`);
  React.useEffect(() => {
    if (!catalogReady) return;
    const key = `${fecha}__${ruta}`;
    const scopeChanged = key !== scopeRef.current;
    scopeRef.current = key;
    if (!scopeChanged) return; // no barrer por re-render de opciones durante BUSCAR

    const validPhotogIds = new Set(photogOptions.map((o) => String(o.value)));
    const keepPhotogs = selPhotogs.filter((id) => validPhotogIds.has(String(id)));
    if (keepPhotogs.length !== selPhotogs.length) setSelPhotogs(keepPhotogs);

    const validHotspotNames = new Set(hotspotOptions.map((o) => String(o.value)));
    const keepHotspots = selHotspots.filter((nm) => validHotspotNames.has(String(nm)));
    if (keepHotspots.length !== selHotspots.length) setSelHotspots(keepHotspots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogReady, fecha, ruta]);

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

/* ======================= useSearchPhotos ======================= */
export function useSearchPhotos({
  fecha, iniStep, finStep,
  ruta, selPhotogs, selHotspots,
  resolver, setResolver,
}) {
  const [allPhotos, setAllPhotos] = React.useState([]);
  const [allHasMore, setAllHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const locallyFilterBySelectedHotspots = (items, selectedHotspotIds, selectedHotspotNames) => {
    if (!Array.isArray(items) || !items.length) return [];
    // 1) por ID
    if (selectedHotspotIds && selectedHotspotIds.length) {
      const allowed = new Set(selectedHotspotIds.map(String));
      return items.filter((ph) => ph.hotspotId && allowed.has(String(ph.hotspotId)));
    }
    // 2) fallback por nombre (si el item trae nombre o el resolver lo sabe)
    if (selectedHotspotNames && selectedHotspotNames.length) {
      const allowedNames = new Set(selectedHotspotNames.map(String));
      return items.filter((ph) => {
        const byResolver = resolver?.hotspotById?.get?.(String(ph.hotspotId))?.name;
        return (ph.hotspotName && allowedNames.has(String(ph.hotspotName))) ||
               (byResolver && allowedNames.has(String(byResolver)));
      });
    }
    return items;
  };

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
            ? await getEventRouteIdsByName(ruta, { photographerIds: selPhotogs, eventId: null })
            : [];

        // Eventos por FECHA + RUTA + FOTÓGRAFOS
        let evIdsScope = [];
        if (ruta !== "Todos") {
          const evIds = await getEventIdsByDateRouteAndPhotogs({
            fechaYmd: fechaParam,
            routeName: ruta,
            photographerIds: selPhotogs,
          });
          evIdsScope = evIds;
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

        // Hotspots acotados (por NOMBRE → IDs) priorizando eventos del scope
        let selectedHotspotIds = [];
        if (selHotspots.length && evIdsScope.length) {
          const { data: hsAll } = await supabase
            .from("event_hotspot")
            .select("id, name, route_id, event_id")
            .in("event_id", evIdsScope);
          const wanted = new Set(selHotspots.map((s) => norm(String(s))));
          const hsScoped = (hsAll || []).filter((h) => wanted.has(norm(h.name)));
          selectedHotspotIds = hsScoped.map((h) => String(h.id));
          const hsMap = new Map(hsScoped.map((h) => [String(h.id), { name: h.name }]));
          setResolver((prev) => ({ ...prev, hotspotById: hsMap }));
        } else if (routeIds.length && selHotspots.length) {
          const hs = await getHotspotsByRouteIds(routeIds, { names: selHotspots });
          selectedHotspotIds = hs.map((h) => String(h.id));
          const hsMap = new Map(hs.map((h) => [String(h.id), { name: h.name }]));
          setResolver((prev) => ({ ...prev, hotspotById: hsMap }));
        } else if (routeIds.length) {
          const hs = await getHotspotsByRouteIds(routeIds);
          const hsMap = new Map(hs.map((h) => [String(h.id), { name: h.name }]));
          setResolver((prev) => ({ ...prev, hotspotById: hsMap }));
        }

        // A) fetchPhotos (si devuelve algo, igual re-filtramos local por punto)
        let items = [];
        try {
          const resp = await fetchPhotos({
            routeIds,
            hotspotIds: selectedHotspotIds,
            photographerIds: selPhotogs,
            fecha: fechaParam,
            inicioHHMM,
            finHHMM,
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
              eventId: x.event_id || null,
            });
          }

          items = locallyFilterBySelectedHotspots(normed, selectedHotspotIds, selHotspots);
        } catch {
          // caeremos a B/C
        }

        // B/C) event_asset o Storage
        if ((!items || !items.length) && (evIdsScope.length || routeIds.length)) {
          const evIds = evIdsScope.slice();
          if (!evIds.length && routeIds.length) {
            const { data: evFromRoutes } = await supabase
              .from("event_route")
              .select("event_id")
              .in("id", routeIds);
            const uniq = Array.from(new Set((evFromRoutes || []).map((r) => String(r.event_id)).filter(Boolean)));
            evIds.push(...uniq);
          }

          try {
            let q = supabase
              .from("event_asset")
              .select("id, event_id, hotspot_id, storage_path, taken_at")
              .in("event_id", evIds)
              .order("taken_at", { ascending: false })
              .limit(1500);

            if (selectedHotspotIds.length) {
              q = q.in("hotspot_id", selectedHotspotIds);
            } else if (selHotspots.length && routeIds.length) {
              const hs = await getHotspotsByRouteIds(routeIds);
              const byName = new Map(hs.map(h => [norm(String(h.name)), String(h.id)]));
              const hsIds = selHotspots.map(n => byName.get(norm(String(n)))).filter(Boolean);
              if (hsIds.length) q = q.in("hotspot_id", hsIds);
            } else if (selHotspots.length && evIds.length && !routeIds.length) {
              const { data: hsAll } = await supabase
                .from("event_hotspot")
                .select("id, name, event_id")
                .in("event_id", evIds);
              const wanted = new Set(selHotspots.map(s => norm(String(s))));
              const hsIds = (hsAll || []).filter(h => wanted.has(norm(h.name))).map(h => String(h.id));
              if (hsIds.length) q = q.in("hotspot_id", hsIds);
            }

            const { data: assets } = await q;

            if (Array.isArray(assets) && assets.length) {
              const tmp = [];
              const { data: evs } = await supabase
                .from("event")
                .select("id, photographer_id")
                .in("id", evIds);
              const eventPhotogMap = new Map((evs || []).map(e => [String(e.id), e?.photographer_id ? String(e.photographer_id) : null]));

              for (const a of assets) {
                const url = await getPublicUrl(a.storage_path);
                if (!url) continue;
                const pid = eventPhotogMap.get(String(a.event_id)) || (selPhotogs.length === 1 ? selPhotogs[0] : null);
                tmp.push({
                  id: String(a.id),
                  url,
                  timestamp: a.taken_at || null,
                  hotspotId: a.hotspot_id || null,
                  photographerId: pid,
                  route: ruta !== "Todos" ? ruta : null,
                  eventId: String(a.event_id),
                });
              }
              items = locallyFilterBySelectedHotspots(tmp, selectedHotspotIds, selHotspots);
            } else {
              const merged = [];
              for (const evId of evIds) {
                const onlyHs = selectedHotspotIds.length ? selectedHotspotIds : [];
                const listed = await listAssetsFromStorage(evId, { onlyHotspots: onlyHs });
                const pid = (await supabase.from("event").select("photographer_id").eq("id", evId).maybeSingle()).data?.photographer_id || null;
                merged.push(
                  ...listed.map((it) => ({
                    ...it,
                    photographerId: pid ? String(pid) : null,
                    route: ruta !== "Todos" ? ruta : null,
                    eventId: String(evId),
                  }))
                );
              }
              items = locallyFilterBySelectedHotspots(merged, selectedHotspotIds, selHotspots);
            }
          } catch (e) {
            console.error("Fallback event_asset/storage:", e);
          }
        }

        setAllHasMore(false);
        setAllPhotos(Array.isArray(items) ? items : []);
        setLoading(false);
        return;
      }

      // ======== SIN FOTÓGRAFOS ========
      if (ruta === "Todos") {
        setAllPhotos([]); setAllHasMore(false); setLoading(false); return;
      }

      // Eventos por FECHA + RUTA
      const { evIds, eventMap } = await getEventsByDateAndRoute({ fechaYmd: fechaParam, routeName: ruta });

      // Hotspots por nombre dentro de esos eventos
      let selectedHotspotIds = [];
      if (selHotspots.length && evIds.length) {
        const { data: hsAll } = await supabase
          .from("event_hotspot")
          .select("id, name, event_id")
          .in("event_id", evIds);
        const wanted = new Set(selHotspots.map((s) => norm(String(s))));
        const hsScoped = (hsAll || []).filter((h) => wanted.has(norm(h.name)));
        selectedHotspotIds = hsScoped.map((h) => String(h.id));
        const hsMap = new Map(hsScoped.map((h) => [String(h.id), { name: h.name }]));
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
        if (selectedHotspotIds.length) q = q.in("hotspot_id", selectedHotspotIds);
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
              photographerId: eventMap.get(String(a.event_id)) || null,
              route: ruta !== "Todos" ? ruta : null,
              eventId: String(a.event_id),
            });
          }
          items = locallyFilterBySelectedHotspots(tmp, selectedHotspotIds, selHotspots);
        } else {
          const merged = [];
          for (const evId of evIds) {
            const listed = await listAssetsFromStorage(evId, { onlyHotspots: selectedHotspotIds });
            merged.push(
              ...listed.map((it) => ({
                ...it,
                photographerId: eventMap.get(String(evId)) || null,
                route: ruta !== "Todos" ? ruta : null,
                eventId: String(evId),
              }))
            );
          }
          items = locallyFilterBySelectedHotspots(merged, selectedHotspotIds, selHotspots);
        }
      } catch (e) {
        console.error("SIN FOTÓGRAFOS fallback:", e);
      }

      setAllHasMore(false);
      setAllPhotos(Array.isArray(items) ? items : []);
      setLoading(false);
    } catch (e) {
      console.error("runSearch:", e);
      setAllHasMore(false);
      setAllPhotos([]);
      setLoading(false);
    }
  }

  // Expuesto (compat con tu UI actual)
  const [page] = React.useState(0);
  const paginatedPhotos = allPhotos;
  const totalPhotos = allPhotos.length;
  const hasMorePhotos = allHasMore;
  const onLoadMore = () => {};
  const [selected, setSelected] = React.useState(new Set());
  const onToggleSel = (id) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const clearSel = () => setSelected(new Set());
  const totalQ = selected.size;
  const resetPhotos = () => { setAllPhotos([]); setAllHasMore(false); };

  return {
    loading,
    runSearch,
    paginatedPhotos, totalPhotos, hasMorePhotos, onLoadMore,
    selected, onToggleSel, clearSel, totalQ,
    resetPhotos,
  };
}
