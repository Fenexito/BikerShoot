// src/routes/biker/Search/Search.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";

import {
  fetchEvent,
  fetchHotspot,
  fetchHotspotsByEvent,
  getRouteName,
} from "../../../lib/searchApi.js";

import SearchResults from "./SearchResults";
import SearchFiltersBar from "./SearchFiltersBar.jsx";
import {
  RUTAS_FIJAS,
  clampStep,
  timeToStep,
} from "./lib/searchShared";
import { useSearchFilters, useSearchCatalog, useSearchPhotos } from "./hooks/useBikerSearch";
import SearchGuideMessage from "./SearchGuideMessage.jsx";

export default function BikerSearch() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  const {
    fecha, setFecha,
    iniStep, setIniStep, finStep, setFinStep,
    ruta, setRuta,
    selPhotogs, setSelPhotogs,
    selHotspots, setSelHotspots,
    pinned,
    forcedFromEvent,
    // vista
    cols, setCols,
    showLabels, setShowLabels,
  } = useSearchFilters();

  const [resolver, setResolver] = useState({
    photographerById: new Map(),
    hotspotById: new Map(),
  });

  const {
    loadingCatalog,
    photogOptions,
    hotspotOptions,
    mergeHotspotNamesIntoResolver,
  } = useSearchCatalog({
    ruta, selPhotogs, setSelPhotogs, selHotspots, setSelHotspots, setResolver,
    fecha, // el catálogo usa fecha+ruta para poblar opciones reales
  });

  const {
    loading, runSearch,
    paginatedPhotos, totalPhotos, hasMorePhotos, onLoadMore,
    selected, onToggleSel, clearSel, totalQ,
    resetPhotos, // ⟵ NUEVO
  } = useSearchPhotos({
    fecha, iniStep, finStep,
    ruta, selPhotogs, selHotspots,
    resolver, setResolver,
  });

  // ===== Estado para saber si ya se hizo una búsqueda =====
  const [hasSearched, setHasSearched] = useState(false);

  // Prefill cuando vienen params (?hotspot/?punto/?evento/photogs)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const hotspotParam = params.get("hotspot") || params.get("punto");
        if (hotspotParam) {
          const hs = await fetchHotspot(hotspotParam);
          if (hs) {
            if (!params.get("ruta") && hs.route_id) {
              const { data: rname } = { data: await getRouteName(hs.route_id) };
              const name = rname || await getRouteName(hs.route_id);
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

        const photogsCsv = params.get("photogs");
        if (photogsCsv && !selPhotogs.length) setSelPhotogs(photogsCsv.split(",").filter(Boolean));

        const evento = params.get("evento");
        if (evento) {
          const pts = await fetchHotspotsByEvent(evento);
          if (!alive) return;
          const hsMapByName = new Map((pts || []).map((p) => [String(p.id), { name: p.name }]));
          mergeHotspotNamesIntoResolver(hsMapByName);
        }
      } catch (e) {
        console.error("Preconfig buscar:", e);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // === AUTO-BÚSQUEDA cuando vienes desde un evento/punto ===
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (!forcedFromEvent) return;
    if (autoRanRef.current) return;
    const cameFrom = params.get("evento") || params.get("hotspot") || params.get("punto");
    if (!cameFrom) return;

    if (loadingCatalog) return;

    const hasRoute = ruta && ruta !== "Todos";
    const hasPhotogs = selPhotogs.length > 0;
    const hasHotspot = selHotspots.length > 0;

    if (hasRoute && (hasPhotogs || hasHotspot)) {
      autoRanRef.current = true;
      setHasSearched(true);
      runSearch();
    }
  }, [
    forcedFromEvent,
    params,
    loadingCatalog,
    ruta,
    selPhotogs.length,
    selHotspots.length,
    runSearch,
  ]);

  // ===== Reinicio automático si el usuario cambia FECHA o RUTA =====
  useEffect(() => {
    // Limpiar selecciones dependientes
    setSelPhotogs([]);
    setSelHotspots([]);
    // Limpiar resultados renderizados (fotos)
    resetPhotos();              // ⟵ aquí vaciamos el grid
    // “Reiniciar” flujo (oculta resultados anteriores y muestra guía)
    setHasSearched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, ruta]);

  const onSubmitSearch = () => {
    setHasSearched(true);
    resetPhotos(); // opcional: asegura que no parpadeen resultados viejos
    runSearch();
  };

  // ===== Mensaje GUIADO (centrado) =====
  const needsBasics =
    !fecha || String(fecha).length < 10 || ruta === "Todos" || !(iniStep < finStep);

  const hasResults =
    (Number(totalPhotos) || 0) > 0 ||
    ((paginatedPhotos?.length || 0) > 0);

  const guideMessage = (() => {
    if (loading) return "BUSCANDO FOTOS...";
    if (hasResults) return null;
    if (hasSearched) return "NO SE ENCONTRARON FOTOS.";
    if (needsBasics)
      return "POR FAVOR SELECCIONA LA FECHA, LA HORA Y LA RUTA para iniciar la búsqueda.";
    if (loadingCatalog)
      return "BUSCANDO FOTÓGRAFOS.";
    if ((photogOptions?.length || 0) > 0 && (selPhotogs?.length || 0) === 0)
      return "SELECCIONA EL O LOS FOTÓGRAFOS QUE TE INTERESAN.";
    if ((selPhotogs?.length || 0) > 0 && (hotspotOptions?.length || 0) > 0 && (selHotspots?.length || 0) === 0)
      return "SELECCIONA EL O LOS PUNTOS PARA BUSCAR TUS FOTOS.";
    if ((selHotspots?.length || 0) > 0)
      return "PRESIONA BUSCAR PARA INICIAR LA BÚSQUEDA.";
    return null;
  })();

  // ===== Bloqueo de scroll cuando no hay resultados =====
  const lockScroll = !hasResults;

  return (
    <div
      className={
        // cuando está vacío, evitamos scroll vertical
        `${lockScroll ? "h-[90dvh] min-h-[50dvh] overflow-hidden" : "min-h-screen"} surface pb-28`
      }
    >
      <div style={{ height: 40 }} />

      <SearchFiltersBar
        pinned={pinned}
        fecha={fecha} setFecha={setFecha}
        iniStep={iniStep} setIniStep={setIniStep}
        finStep={finStep} setFinStep={setFinStep}
        ruta={ruta} setRuta={setRuta}
        photogOptions={photogOptions}
        selPhotogs={selPhotogs} setSelPhotogs={setSelPhotogs}
        hotspotOptions={hotspotOptions}
        selHotspots={selHotspots} setSelHotspots={setSelHotspots}
        cols={cols} setCols={setCols}
        showLabels={showLabels} setShowLabels={setShowLabels}
        onSubmitSearch={onSubmitSearch}
        searching={loading}
      />

      {pinned && <div style={{ height: 64 }} />}

      <div className="w-full px-3 sm:px-6 pt-6 overflow-x-clip">
        {guideMessage ? (
          <SearchGuideMessage message={guideMessage} />
        ) : (
          <SearchResults
            paginatedPhotos={paginatedPhotos}
            totalPhotos={totalPhotos}
            onLoadMore={onLoadMore}
            hasMorePhotos={hasMorePhotos}
            onToggleSel={onToggleSel}
            selected={selected}
            resolvePhotographerName={(id) => resolver.photographerById.get(String(id))?.label || id || "—"}
            resolveHotspotName={(id) => resolver.hotspotById.get(String(id))?.name || id || "—"}
            totalQ={totalQ}
            clearSel={clearSel}
            cols={cols}
            showLabels={showLabels}
          />
        )}
      </div>
    </div>
  );
}
