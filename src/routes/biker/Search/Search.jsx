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
} from "../../lib/searchApi";

import SearchResults from "./SearchResults";

/* ================== Utils ================== */
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const HHMMtoMin = (hhmm) => {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  return h * 60 + m;
};
const minToHHMM = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const csvToArr = (v) => (!v ? [] : v.split(",").filter(Boolean));
const arrToCsv = (a) => (Array.isArray(a) ? a.join(",") : "");

/* ================== Componente ================== */
export default function BikerSearch() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  // --------- Filtros (estado) ----------
  const [fecha, setFecha] = useState(() => params.get("fecha") || new Date().toISOString().slice(0, 10));
  const [horaIniMin, setHoraIniMin] = useState(() => HHMMtoMin(params.get("inicio") || "06:00"));
  const [horaFinMin, setHoraFinMin] = useState(() => HHMMtoMin(params.get("fin") || "12:00"));
  const [ruta, setRuta] = useState(() => params.get("ruta") || "Todos");
  const [selHotspots, setSelHotspots] = useState(() => csvToArr(params.get("hotspot") || params.get("hotspots"))); // id único o lista
  const [selPhotogs, setSelPhotogs] = useState(() => csvToArr(params.get("photogs"))); // ids

  const [usarMiMoto, setUsarMiMoto] = useState(() => params.get("mimoto")==="1");
  // Colores — si venimos desde EVENTO/PUNTO forzamos vacíos:
  const forcedFromEvent = !!(params.get("evento") || params.get("hotspot"));
  const initialConf = params.has("conf") ? Number(params.get("conf")) : (forcedFromEvent ? 0 : 70);

  const [coloresMoto, setColoresMoto] = useState(() => forcedFromEvent ? new Set() : new Set(csvToArr(params.get("cmoto"))));
  const [coloresChaqueta, setColoresChaqueta] = useState(() => forcedFromEvent ? new Set() : new Set(csvToArr(params.get("cchaq"))));
  const [coloresCasco, setColoresCasco] = useState(() => forcedFromEvent ? new Set() : new Set(csvToArr(params.get("ccasco"))));
  const [confIA, setConfIA] = useState(initialConf);
  const [riders, setRiders] = useState(() => params.get("riders") || "cualquiera");

  // Vista y paginación
  const [vista, setVista] = useState("mosaico"); // "mosaico" | "momentos"
  const [page, setPage] = useState(1); // paginación simple front
  const pageSize = 60;

  // Catálogos backend
  const [routes, setRoutes] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [photogCats, setPhotogCats] = useState([]);
  const [resolver, setResolver] = useState({
    routeNameById: new Map(),
    photographerById: new Map(),
    hotspotById: new Map(),
  });

  // Fotos
  const [allPhotos, setAllPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  // Mi Moto (mock igual que antes, sólo para mantener UI)
  const miMoto = useMemo(() => ({
    colores: { moto: [], casco: [], chaqueta: [] },
  }), []);

  // Cargar catálogos base
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [routesData] = await Promise.all([fetchRoutes()]);
        if (!alive) return;
        setRoutes(routesData);
      } catch (e) {
        console.error("Error cargando rutas:", e);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Si venimos con ?evento= o ?hotspot=, completar datos que falten
  useEffect(() => {
    let alive = true;
    (async () => {
      const evento = params.get("evento");
      const hotspot = params.get("hotspot");

      try {
        let photographer_id = null;

        if (evento) {
          const ev = await fetchEvent(evento);
          if (ev) {
            // completar ruta/fecha si no venían en URL
            if (!params.get("ruta")) setRuta(ev.ruta || "Todos");
            if (!params.get("fecha") && ev.fecha) setFecha(ev.fecha.slice(0,10));
            if (ev.photographer_id) photographer_id = ev.photographer_id;
            // cargar hotspots del evento (para resolver nombres)
            const pts = await fetchHotspotsByEvent(evento);
            if (!alive) return;
            setHotspots(pts);
            const mapHS = new Map(pts.map(p => [String(p.id), p]));
            setResolver(prev => ({ ...prev, hotspotById: mapHS }));
          }
        }

        if (hotspot) {
          const hs = await fetchHotspot(hotspot);
          if (hs) {
            // completar horario y ruta si no venían
            if (!params.get("inicio") && hs.horaIni) setHoraIniMin(HHMMtoMin(hs.horaIni.slice(0,5)));
            if (!params.get("fin") && hs.horaFin) setHoraFinMin(HHMMtoMin(hs.horaFin.slice(0,5)));
            if (hs.route_id) {
              const name = await getRouteName(hs.route_id);
              if (!params.get("ruta") && name) setRuta(name);
            }
          }
        }

        // fotógrafos: si viene bloqueado en URL, cargar sus nombres
        const photogsCsv = params.get("photogs") || (photographer_id ? String(photographer_id) : "");
        const photogIds = csvToArr(photogsCsv);
        if (photogIds.length > 0) {
          const phs = await fetchPhotographers(photogIds);
          if (!alive) return;
          setPhotogCats(phs);
          const mapPH = new Map(phs.map(p => [String(p.id), p]));
          setResolver(prev => ({ ...prev, photographerById: mapPH }));
          // setear selPhotogs si no vinieron antes
          if ((selPhotogs || []).length === 0) {
            setSelPhotogs(photogIds);
          }
        }
      } catch (e) {
        console.error("Error preconfig buscando:", e);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolver de nombres de ruta simple
  const resolveRouteName = (id) => {
    if (!id) return "";
    const found = routes.find(r => String(r.id) === String(id));
    return found?.name || "";
  };

  // Cuando cambien filtros grandes → cargar fotos del backend
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const evento = params.get("evento") || "";
        const hotspotId = params.get("hotspot") || "";
        const hotspot_ids = selHotspots.length ? selHotspots : (hotspotId ? [hotspotId] : []);
        const photographer_ids = selPhotogs;

        const fotos = await fetchPhotos({
          event_id: evento || undefined,
          hotspot_ids: hotspot_ids.length ? hotspot_ids : undefined,
          fecha,
          inicio: minToHHMM(horaIniMin),
          fin: minToHHMM(horaFinMin),
          photographer_ids: photographer_ids.length ? photographer_ids : undefined,
        });

        if (!alive) return;

        // Si querés resolver route name para cada foto, podés hacerlo aquí si tenés el mapping.
        // De momento lo dejamos vacío; la UI actual no lo exige de forma dura para filtrar si 'ruta' ya fue aplicada al query.

        setAllPhotos(fotos);
        setPage(1);
      } catch (e) {
        console.error("Error cargando fotos:", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, horaIniMin, horaFinMin, ruta, arrToCsv(selHotspots), arrToCsv(selPhotogs)]);

  // --------- Filtro en front: colores / IA / riders  ----------
  const minConf = confIA;

  const filtered = useMemo(() => {
    const today = new Date(fecha + "T00:00:00");
    const ini = new Date(today);
    ini.setHours(Math.floor(horaIniMin / 60), horaIniMin % 60, 0, 0);
    const fin = new Date(today);
    fin.setHours(Math.floor(horaFinMin / 60), horaFinMin % 60, 59, 999);

    const zoneMatch = (sel, zona, areas) => (sel.size === 0 ? true : (areas[zona] || []).some((c) => sel.has(c)));

    return (allPhotos || []).filter((ph) => {
      if (!ph?.timestamp) return false;
      const d = new Date(ph.timestamp);
      if (isNaN(d)) return false;

      // Horario (ya filtramos también en backend, esto refuerza)
      if (!(d >= ini && d <= fin)) return false;

      // Ruta: si se eligió una ruta específica y la foto trae route (no obligatorio)
      if (ruta !== "Todos" && ph.route && ph.route !== ruta) return false;

      if (selHotspots.length > 0 && !selHotspots.includes(ph.hotspotId)) return false;

      if (selPhotogs.length > 0 && !selPhotogs.includes(ph.photographerId)) return false;

      if ((ph.aiConfidence || 0) < minConf) return false;

      if (riders !== "cualquiera" && String(ph.riders || 1) !== riders) return false;

      const areas = ph.areas || {};
      const preferenciaDura = usarMiMoto;

      const motoOK =
        zoneMatch(coloresMoto, "moto", areas) &&
        (!preferenciaDura ||
          miMoto.colores.moto.length === 0 ||
          miMoto.colores.moto.some((c) => (areas.moto || []).includes(c)));
      const cascoOK =
        zoneMatch(coloresCasco, "casco", areas) &&
        (!preferenciaDura ||
          miMoto.colores.casco.length === 0 ||
          miMoto.colores.casco.some((c) => (areas.casco || []).includes(c)));
      const chaOK =
        zoneMatch(coloresChaqueta, "chaqueta", areas) &&
        (!preferenciaDura ||
          miMoto.colores.chaqueta.length === 0 ||
          miMoto.colores.chaqueta.some((c) => (areas.chaqueta || []).includes(c)));

      return motoOK && cascoOK && chaOK;
    });
  }, [
    allPhotos,
    fecha,
    horaIniMin,
    horaFinMin,
    ruta,
    selHotspots,
    selPhotogs,
    minConf,
    riders,
    coloresMoto,
    coloresChaqueta,
    coloresCasco,
    usarMiMoto,
    miMoto,
  ]);

  // --------- “Momentos” (clusters por minuto) ----------
  const clusters = useMemo(() => {
    const map = new Map(); // key = YYYY-MM-DDTHH:MM
    for (const ph of filtered) {
      if (!ph?.timestamp) continue;
      const d = new Date(ph.timestamp);
      const key =
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T` +
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ph);
    }
    const arr = Array.from(map.entries())
      .map(([k, items]) => ({
        key: k,
        fecha: k.slice(0, 10),
        hora: k.slice(11, 16),
        items: items.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1)),
      }))
      .sort((a, b) => (a.key < b.key ? 1 : -1));
    return arr;
  }, [filtered]);

  // --------- Paginaciones (front) ----------
  const totalPhotos = filtered.length;
  const totalClusters = clusters.length;

  const paginatedPhotos = useMemo(() => filtered.slice(0, page * pageSize), [filtered, page, pageSize]);
  const paginatedClusters = useMemo(() => clusters.slice(0, page * 3), [clusters, page]); // 3 clusters por “página” visual

  const hasMorePhotos = paginatedPhotos.length < totalPhotos;
  const hasMoreClusters = paginatedClusters.length < totalClusters;
  const onLoadMore = () => setPage((p) => p + 1);

  // --------- Selección para “carrito” (igual que antes) ----------
  const [sel, setSel] = useState(() => new Set());
  const toggleSel = (id) =>
    setSel((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const clearSel = () => setSel(new Set());

  // --------- Total (estimado) ----------
  const totalQ = useMemo(() => {
    // placeholder (antes usabas getPhotographerById + precios mock)
    // Si luego traés precios reales, podés sumarlos acá.
    return sel.size * 50;
  }, [sel]);

  // --------- Chips activos ----------
  const activeChips = [
    ruta !== "Todos" && { k: "ruta", label: `Ruta: ${ruta}`, onClear: () => setRuta("Todos") },
    selHotspots.length > 0 && { k: "hotspots", label: `Puntos: ${selHotspots.length}`, onClear: () => setSelHotspots([]) },
    selPhotogs.length > 0 && { k: "photogs", label: `Fotógrafos: ${selPhotogs.length}`, onClear: () => setSelPhotogs([]) },
    coloresMoto.size > 0 && { k: "moto", label: `Moto: ${Array.from(coloresMoto).join(", ")}`, onClear: () => setColoresMoto(new Set()) },
    coloresChaqueta.size > 0 && { k: "chaq", label: `Chaqueta: ${Array.from(coloresChaqueta).join(", ")}`, onClear: () => setColoresChaqueta(new Set()) },
    coloresCasco.size > 0 && { k: "casco", label: `Casco: ${Array.from(coloresCasco).join(", ")}`, onClear: () => setColoresCasco(new Set()) },
    confIA > 0 && { k: "conf", label: `Conf. IA ≥ ${confIA}%`, onClear: () => setConfIA(0) },
    usarMiMoto && { k: "mimoto", label: `Mi Moto preferida`, onClear: () => setUsarMiMoto(false) },
    riders !== "cualquiera" && { k: "riders", label: `Riders: ${riders}`, onClear: () => setRiders("cualquiera") },
  ].filter(Boolean);

  const thumbAspect = "square"; // tu UI lo usa de antes

  return (
    <div className="min-h-screen surface pb-28">
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">

        {/* Filtros principales */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-slate-600">Fecha</label>
            <input
              type="date"
              className="h-9 border rounded-lg px-2 bg-white"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          {/* Horario */}
          <div className="flex items-center gap-2">
            <div>
              <label className="block text-sm font-medium text-slate-600">Inicio</label>
              <input
                type="time"
                className="h-9 border rounded-lg px-2 bg-white"
                value={minToHHMM(horaIniMin)}
                onChange={(e) => setHoraIniMin(HHMMtoMin(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600">Fin</label>
              <input
                type="time"
                className="h-9 border rounded-lg px-2 bg-white"
                value={minToHHMM(horaFinMin)}
                onChange={(e) => setHoraFinMin(HHMMtoMin(e.target.value))}
              />
            </div>
          </div>

          {/* Ruta */}
          <div>
            <label className="block text-sm font-medium text-slate-600">Ruta</label>
            <select
              className="h-9 border rounded-lg px-2 bg-white"
              value={ruta}
              onChange={(e) => setRuta(e.target.value)}
            >
              <option value="Todos">Todos</option>
              {routes.map((r) => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Puntos (cuando hay evento) */}
          {hotspots.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-600">Puntos</label>
              <select
                className="h-9 border rounded-lg px-2 bg-white"
                value={selHotspots[0] || ""}
                onChange={(e) => setSelHotspots(e.target.value ? [e.target.value] : [])}
              >
                <option value="">Todos</option>
                {hotspots.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Fotógrafo (cuando viene prefiltrado) */}
          {photogCats.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-600">Fotógrafo</label>
              <select
                className="h-9 border rounded-lg px-2 bg-white"
                value={selPhotogs[0] || ""}
                onChange={(e) => setSelPhotogs(e.target.value ? [e.target.value] : [])}
              >
                <option value="">Todos</option>
                {photogCats.map((p) => (
                  <option key={p.id} value={p.id}>{p.display_name || p.estudio || p.username || p.id}</option>
                ))}
              </select>
            </div>
          )}

          {/* IA */}
          <div>
            <label className="block text-sm font-medium text-slate-600">Conf. IA</label>
            <input
              type="range"
              min={0}
              max={100}
              value={confIA}
              onChange={(e) => setConfIA(Number(e.target.value))}
            />
            <div className="text-xs text-slate-500 text-right">{confIA}%</div>
          </div>

          {/* Riders */}
          <div>
            <label className="block text-sm font-medium text-slate-600">Riders</label>
            <select
              className="h-9 border rounded-lg px-2 bg-white"
              value={riders}
              onChange={(e) => setRiders(e.target.value)}
            >
              <option value="cualquiera">Cualquiera</option>
              <option value="1">1</option>
              <option value="2">2+</option>
            </select>
          </div>
        </div>

        {/* Chips activos */}
        <div className="flex flex-wrap gap-2 mt-3">
          {activeChips.map((c) => (
            <button
              key={c.k}
              className="px-2 py-1 text-xs rounded-full bg-slate-100 hover:bg-slate-200"
              onClick={c.onClear}
            >
              {c.label} ×
            </button>
          ))}
        </div>

        {/* Resultados */}
        <div className="mt-4">
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
              // resolutores para nombres:
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
