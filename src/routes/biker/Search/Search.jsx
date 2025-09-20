// src/routes/biker/Search/Search.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";

import {
  fetchEvent,
  fetchHotspot,
  fetchHotspotsByEvent,
  getRouteName,
  fetchPhotos, // se usa dentro de hook (re-export para compat si lo necesitas)
} from "../../../lib/searchApi.js";

import SearchResults from "./SearchResults";
import SearchFiltersBar from "./SearchFiltersBar.jsx";
import {
  RUTAS_FIJAS,
  arrToCsv,
  clampStep,
  timeToStep,
} from "./lib/searchShared";
import { useSearchFilters, useSearchCatalog, useSearchPhotos } from "./hooks/useBikerSearch";

export default function BikerSearch() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  const {
    fecha, setFecha,
    iniStep, setIniStep, finStep, setFinStep,
    ignorarHora, setIgnorarHora,
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
  });

  const {
    loading, runSearch,
    paginatedPhotos, totalPhotos, hasMorePhotos, onLoadMore,
    selected, onToggleSel, clearSel, totalQ,
  } = useSearchPhotos({
    fecha, iniStep, finStep, ignorarHora,
    ruta, selPhotogs, selHotspots,
    resolver, setResolver,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const hotspotParam = params.get("hotspot") || params.get("punto");
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
          if (forcedFromEvent) setIgnorarHora(false);
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

  // Handler para el botón BUSCAR
  const onSubmitSearch = () => {
    runSearch();
  };

  return (
    <div className="min-h-screen surface pb-28">
      <div style={{ height: 40 }} />

      <SearchFiltersBar
        pinned={pinned}
        fecha={fecha} setFecha={setFecha}
        iniStep={iniStep} setIniStep={setIniStep}
        finStep={finStep} setFinStep={setFinStep}
        ignorarHora={ignorarHora} setIgnorarHora={setIgnorarHora}
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

      <div className="w-screen ml-[calc(50%-50vw)] px-3 sm:px-6 pt-6">
        {(loading || loadingCatalog) ? (
          <div className="text-slate-500">Buscando fotos…</div>
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
            /* NUEVO: pasamos fotógrafos activos para detección robusta */
            activePhotogIds={selPhotogs}
          />
        )}
      </div>
    </div>
  );
}
