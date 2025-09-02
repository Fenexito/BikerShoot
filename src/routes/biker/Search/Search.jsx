import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { photographers, getPhotographerById } from "../../../data/photographers";
import { hotspots, routes as routeList } from "../../../data/hotspots";
import { searchPhotos } from "../../../data/searchPhotos";

import SearchResults from "./SearchResults";

/* ================== Utils ================== */
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const HHMMtoMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const minToHHMM = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const csvToArr = (v) => (!v ? [] : v.split(",").filter(Boolean));
const arrToCsv = (a) => (Array.isArray(a) ? a.join(",") : "");

export default function BikerSearch() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  // --------- Filtros (estado) ----------
  const [fecha, setFecha] = useState(() => params.get("fecha") || new Date().toISOString().slice(0, 10));
  const [horaIniMin, setHoraIniMin] = useState(() => HHMMtoMin(params.get("inicio") || "06:00"));
  const [horaFinMin, setHoraFinMin] = useState(() => HHMMtoMin(params.get("fin") || "12:00"));
  const [ruta, setRuta] = useState(() => params.get("ruta") || "Todos");
  const [selHotspots, setSelHotspots] = useState(() => csvToArr(params.get("hotspots"))); // ids
  const [selPhotogs, setSelPhotogs] = useState(() => csvToArr(params.get("photogs"))); // ids

  const [usarMiMoto, setUsarMiMoto] = useState(() => params.get("mimoto")==="1");
  const [coloresMoto, setColoresMoto] = useState(() => new Set(csvToArr(params.get("cmoto")).length?csvToArr(params.get("cmoto")):["azul"]));
  const [coloresChaqueta, setColoresChaqueta] = useState(() => new Set(csvToArr(params.get("cchaq"))));
  const [coloresCasco, setColoresCasco] = useState(() => new Set(csvToArr(params.get("ccasco")).length?csvToArr(params.get("ccasco")):["negro"]));
  const [confIA, setConfIA] = useState(() => Number(params.get("conf") ?? 70)); // 0..100
  const [riders, setRiders] = useState(() => params.get("riders") || "cualquiera"); // "1", "2", "cualquiera"

  // Vista y paginación
  const [vista, setVista] = useState("mosaico"); // "mosaico" | "momentos"
  const [page, setPage] = useState(1);

  // Formato miniatura
  const [thumbAspect, setThumbAspect] = useState(() => params.get("asp") || "3:4"); // "1:1" | "3:4"

  // Mock de “mi moto”
  const miMoto = { marca: "Yamaha", modelo: "MT-07", colores: { moto: ["azul"], casco: ["negro"], chaqueta: [] } };

  // --------- FILTRADO ----------
  const filtered = useMemo(() => {
    const fFecha = new Date(`${fecha}T00:00:00`);
    const minConf = confIA / 100;

    let arr = searchPhotos.filter((ph) => {
      const d = new Date(ph.timestamp);

      if (!sameDay(d, fFecha)) return false;

      const mins = d.getHours() * 60 + d.getMinutes();
      if (!(mins >= horaIniMin && mins <= horaFinMin)) return false;

      if (ruta !== "Todos" && ph.route !== ruta) return false;

      if (selHotspots.length > 0 && !selHotspots.includes(ph.hotspotId)) return false;

      if (selPhotogs.length > 0 && !selPhotogs.includes(ph.photographerId)) return false;

      if ((ph.aiConfidence || 0) < minConf) return false;

      if (riders !== "cualquiera" && String(ph.riders || 1) !== riders) return false;

      const areas = ph.areas || {};
      const zoneMatch = (sel, zona) => (sel.size === 0 ? true : (areas[zona] || []).some((c) => sel.has(c)));

      const preferenciaDura = usarMiMoto;

      const motoOK =
        zoneMatch(coloresMoto, "moto") &&
        (!preferenciaDura ||
          miMoto.colores.moto.length === 0 ||
          miMoto.colores.moto.some((c) => (areas.moto || []).includes(c)));
      const cascoOK =
        zoneMatch(coloresCasco, "casco") &&
        (!preferenciaDura ||
          miMoto.colores.casco.length === 0 ||
          miMoto.colores.casco.some((c) => (areas.casco || []).includes(c)));
      const chaOK =
        zoneMatch(coloresChaqueta, "chaqueta") &&
        (!preferenciaDura ||
          miMoto.colores.chaqueta.length === 0 ||
          miMoto.colores.chaqueta.some((c) => (areas.chaqueta || []).includes(c)));

      return motoOK && cascoOK && chaOK;
    });

    arr.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return arr;
  }, [
    fecha,
    horaIniMin,
    horaFinMin,
    ruta,
    selHotspots,
    selPhotogs,
    coloresMoto,
    coloresChaqueta,
    coloresCasco,
    confIA,
    usarMiMoto,
    riders,
  ]);

  // --------- CLUSTERS (Momentos) ----------
  const score = (ph) => (ph.aiConfidence || 0) * 2 + (ph.qualityScore || 0);
  const clusters = useMemo(() => {
    const byCluster = new Map();
    for (const ph of filtered) {
      const key = ph.clusterId || `${ph.photographerId}-${ph.hotspotId}-${ph.timestamp.slice(0, 16)}`;
      if (!byCluster.has(key)) byCluster.set(key, []);
      byCluster.get(key).push(ph);
    }
    const list = [];
    for (const [id, fotos] of byCluster.entries()) {
      const top = fotos.slice().sort((a, b) => score(b) - score(a));
      const first = top[0];
      list.push({
        id,
        count: fotos.length,
        cover: first.url,
        time: first.timestamp,
        hotspotId: first.hotspotId,
        route: first.route,
        photographers: Array.from(new Set(fotos.map((x) => x.photographerId))),
        fotos: top,
        confAvg:
          Math.round(
            (fotos.reduce((acc, x) => acc + (x.aiConfidence || 0), 0) / fotos.length) * 100
          ) || 0,
        priceFrom: fotos.reduce((min, x) => {
          const ph = getPhotographerById(x.photographerId);
          const base = ph?.precios?.[0]?.precio || 50;
          return Math.min(min, base);
        }, Infinity),
      });
    }
    list.sort((a, b) => new Date(a.time) - new Date(b.time));
    return list;
  }, [filtered]);

  // --------- Paginación ----------
  const pageSize = vista === "momentos" ? 9 : 160;
  const paginatedClusters = clusters.slice(0, page * pageSize);
  const paginatedPhotos = filtered.slice(0, page * pageSize);
  const hasMorePhotos = paginatedPhotos.length < filtered.length;
  const hasMoreClusters = paginatedClusters.length < clusters.length;

  useEffect(() => {
    setPage(1);
  }, [
    fecha,
    horaIniMin,
    horaFinMin,
    ruta,
    selHotspots,
    selPhotogs,
    coloresMoto,
    coloresChaqueta,
    coloresCasco,
    confIA,
    usarMiMoto,
    riders,
    vista,
    thumbAspect,
  ]);

  // --------- Selección ----------
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
    let total = 0;
    sel.forEach((id) => {
      const ph = searchPhotos.find((x) => x.id === id);
      const estudio = getPhotographerById(ph?.photographerId);
      total += estudio?.precios?.[0]?.precio || 50;
    });
    return total;
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
    riders !== "cualquiera" && { k: "riders", label: `${riders} persona${riders === "2" ? "s" : ""}`, onClear: () => setRiders("cualquiera") },
    thumbAspect !== "3:4" && { k: "asp", label: `Miniatura: ${thumbAspect}`, onClear: () => setThumbAspect("3:4") },
  ].filter(Boolean);

  const limpiarTodo = () => {
    setRuta("Todos");
    setSelHotspots([]);
    setSelPhotogs([]);
    setColoresMoto(new Set());
    setColoresChaqueta(new Set());
    setColoresCasco(new Set());
    setConfIA(0);
    setUsarMiMoto(false);
    setRiders("cualquiera");
    setThumbAspect("3:4");
    setPage(1);
  };

  // --------- Mobile Filters (sheet) ----------
  const [mobileOpen, setMobileOpen] = useState(false);
  const aplicarYCerrarMobile = () => {
    setPage(1);
    setMobileOpen(false);
  };

  // --------- Reiniciar (link a configurar) ----------
  const reiniciarBusqueda = () => {
    const q = new URLSearchParams({
      fecha,
      inicio: minToHHMM(horaIniMin),
      fin: minToHHMM(horaFinMin),
      ruta,
      hotspots: arrToCsv(selHotspots),
      photogs: arrToCsv(selPhotogs),
      asp: thumbAspect,
      mimoto: usarMiMoto ? "1" : "0",
      cmoto: arrToCsv(Array.from(coloresMoto)),
      cchaq: arrToCsv(Array.from(coloresChaqueta)),
      ccasco: arrToCsv(Array.from(coloresCasco)),
      conf: String(confIA),
      riders
    }).toString();
    nav(`/app/buscar/configurar?${q}`);
  };

  return (
    <main className="w-full max-w-none mx-auto px-3 sm:px-4 md:px-6 xl:px-10 py-4">
      {/* HEADER DE FILTROS — compacto, una sola fila, sticky con offset */}
      <div className="hidden md:block sticky top-[72px] z-30 bg-slate-50/90 backdrop-blur border-b border-slate-200">
        <div className="py-2">
          <div className="flex items-end gap-2 flex-nowrap text-sm">
            {/* Fecha */}
            <div className="w-[150px]">
              <Label>Fecha</Label>
              <input
                type="date"
                className="h-9 border rounded-lg px-2 bg-white w-full"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>

            {/* Horario (dual range) */}
            <div className="w-[260px]">
              <Label>Horario</Label>
              <DualRange
                min={0}
                max={24 * 60 - 1}
                step={5}
                value={[horaIniMin, horaFinMin]}
                onChange={([a, b]) => {
                  setHoraIniMin(a);
                  setHoraFinMin(b);
                }}
                renderLabel={(v) => minToHHMM(v)}
              />
            </div>

            {/* Ruta */}
            <div className="w-[160px]">
              <Label>Ruta</Label>
              <select
                className="h-9 w-full border rounded-lg px-2 bg-white"
                value={ruta}
                onChange={(e) => setRuta(e.target.value)}
              >
                <option value="Todos">Todas</option>
                {routeList.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Hotspots multiselect */}
            <div className="w-[200px]">
              <Label>Puntos de foto</Label>
              <CheckCombo
                items={hotspots.map((h) => ({ id: h.id, label: h.name }))}
                selected={selHotspots}
                onChange={setSelHotspots}
                placeholder="Elegí hotspots…"
                small
              />
            </div>

            {/* Fotógrafos multiselect */}
            <div className="w-[220px]">
              <Label>Fotógrafos</Label>
              <CheckCombo
                items={photographers.map((p) => ({ id: p.id, label: `${p.estudio} (${p.rating.toFixed(1)})` }))}
                selected={selPhotogs}
                onChange={setSelPhotogs}
                placeholder="Elegí fotógrafos…"
                small
              />
            </div>

            {/* Miniatura */}
            <div className="w-[140px]">
              <Label>Miniatura</Label>
              <select
                className="h-9 w-full border rounded-lg px-2 bg-white"
                value={thumbAspect}
                onChange={(e) => setThumbAspect(e.target.value)}
              >
                <option value="3:4">3:4</option>
                <option value="1:1">1:1</option>
              </select>
            </div>

            {/* Acciones */}
            <div className="ml-auto flex items-end gap-2">
              <button
                className="h-9 px-3 rounded-xl bg-blue-600 text-white font-display font-bold"
                onClick={() => setPage(1)}
              >
                Aplicar
              </button>
              <button
                className="h-9 px-3 rounded-xl border bg-white font-display font-bold"
                onClick={limpiarTodo}
              >
                Limpiar
              </button>
              <button
                className="h-9 px-3 rounded-xl border bg-white font-display font-bold"
                onClick={reiniciarBusqueda}
                title="Volver a Configurar"
              >
                Reiniciar búsqueda
              </button>
            </div>
          </div>

          {/* Chips activos (línea compacta) */}
          {activeChips.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 text-[12px]">
              {activeChips.map((c) => (
                <span
                  key={c.k}
                  className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white border"
                >
                  {c.label}
                  <button className="text-slate-500 font-display font-bold" onClick={c.onClear}>✕</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* BOTÓN FLOTANTE DE FILTROS (móvil) */}
      <button
        className="md:hidden fixed bottom-20 right-4 z-40 h-11 px-4 rounded-full bg-blue-600 text-white shadow-lg font-display font-bold"
        onClick={() => setMobileOpen(true)}
      >
        Filtros
      </button>

      {/* GRID PRINCIPAL (sidebar izq + resultados) */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Sidebar Izquierda */}
        <aside className="hidden lg:block space-y-3">
          {/* Mi Moto */}
          <section className="rounded-xl border bg-white p-3">
            <h3 className="text-xs font-semibold mb-2">Mi Moto</h3>
            <label className="flex items-center gap-2 text-[12px]">
              <input type="checkbox" className="w-4 h-4" checked={usarMiMoto} onChange={(e) => setUsarMiMoto(e.target.checked)} />
              Usar mis datos (recomendado)
            </label>
            <div className="mt-1 text-[11px] text-slate-500">
              {miMoto.marca} {miMoto.modelo} · moto {miMoto.colores.moto.join(", ") || "—"}, casco {miMoto.colores.casco.join(", ") || "—"}
            </div>
          </section>

          {/* Colores por zona */}
          <section className="rounded-xl border bg-white p-3 space-y-2">
            <h3 className="text-xs font-semibold">Colores — Moto</h3>
            <ColorCombo
              items={makeColorItems()}
              selected={Array.from(coloresMoto)}
              onChange={(arr) => setColoresMoto(new Set(arr))}
              placeholder="Colores de tu moto…"
              small
            />

            <h3 className="text-xs font-semibold">Colores — Chaqueta/Cuerpo</h3>
            <ColorCombo
              items={makeColorItems()}
              selected={Array.from(coloresChaqueta)}
              onChange={(arr) => setColoresChaqueta(new Set(arr))}
              placeholder="Colores de tu chumpa…"
              small
            />

            <h3 className="text-xs font-semibold">Colores — Casco</h3>
            <ColorCombo
              items={makeColorItems()}
              selected={Array.from(coloresCasco)}
              onChange={(arr) => setColoresCasco(new Set(arr))}
              placeholder="Colores de tu casco…"
              small
            />
          </section>

          {/* IA + Personas */}
          <section className="rounded-xl border bg-white p-3">
            <h3 className="text-xs font-semibold mb-1">Confianza de IA</h3>
            <input
              type="range"
              min={0}
              max={100}
              value={confIA}
              onChange={(e) => setConfIA(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-[12px] mt-1">≥ {confIA}%</div>

            <div className="h-px bg-slate-200 my-3" />

            <h3 className="text-xs font-semibold mb-2">Personas</h3>
            <div className="flex gap-2">
              <SegBtn small active={riders === "cualquiera"} onClick={() => setRiders("cualquiera")}>Cualquiera</SegBtn>
              <SegBtn small active={riders === "1"} onClick={() => setRiders("1")}>1</SegBtn>
              <SegBtn small active={riders === "2"} onClick={() => setRiders("2")}>2</SegBtn>
            </div>
          </section>
        </aside>

        {/* RESULTADOS */}
        <SearchResults
          vista={vista}
          setVista={setVista}
          paginatedPhotos={paginatedPhotos}
          totalPhotos={filtered.length}
          paginatedClusters={paginatedClusters}
          totalClusters={clusters.length}
          onLoadMore={() => setPage((p) => p + 1)}
          hasMorePhotos={hasMorePhotos}
          hasMoreClusters={hasMoreClusters}
          onToggleSel={toggleSel}
          selected={sel}
          thumbAspect={thumbAspect}
        />
      </div>

      {/* Barra de selección */}
      {sel.size > 0 && (
        <div className="sticky bottom-3 z-40">
          <div className="max-w-[700px] mx-auto rounded-2xl bg-white border shadow-card px-4 py-2.5 flex items-center justify-between text-sm">
            <div>
              <span className="font-semibold">{sel.size}</span> foto{sel.size === 1 ? "" : "s"} seleccionada{sel.size === 1 ? "" : "s"}
              <span className="mx-2 text-slate-400">•</span>
              Total estimado: <span className="font-display font-bold">{formatQ(totalQ)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="h-9 px-3 rounded-xl border bg-white font-display font-bold" onClick={clearSel}>Limpiar</button>
              <button className="h-9 px-3 rounded-xl bg-blue-600 text-white font-display font-bold" onClick={() => nav("/app/checkout")}>
                Ir al carrito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHEET DE FILTROS (MÓVIL) */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 top-10 bg-white rounded-t-2xl overflow-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="font-display font-bold">Filtros</div>
              <button className="h-9 px-3 rounded-lg border font-display font-bold" onClick={() => setMobileOpen(false)}>Cerrar</button>
            </div>

            <div className="p-4 space-y-5">
              <section>
                <Label>Fecha</Label>
                <input type="date" className="h-11 border rounded-lg px-3 bg-white w-full" value={fecha} onChange={(e) => setFecha(e.target.value)}/>
              </section>

              <section>
                <Label>Horario</Label>
                <DualRange
                  min={0}
                  max={24 * 60 - 1}
                  step={5}
                  value={[horaIniMin, horaFinMin]}
                  onChange={([a, b]) => { setHoraIniMin(a); setHoraFinMin(b); }}
                  renderLabel={(v) => minToHHMM(v)}
                />
              </section>

              <section>
                <Label>Ruta</Label>
                <select className="h-11 w-full border rounded-lg px-3 bg-white" value={ruta} onChange={(e) => setRuta(e.target.value)}>
                  <option value="Todos">Todas</option>
                  {routeList.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </section>

              <section>
                <Label>Puntos de foto</Label>
                <CheckCombo
                  items={hotspots.map((h) => ({ id: h.id, label: h.name }))}
                  selected={selHotspots}
                  onChange={setSelHotspots}
                  placeholder="Elegí hotspots…"
                />
              </section>

              <section>
                <Label>Fotógrafo(s)</Label>
                <CheckCombo
                  items={photographers.map((p) => ({ id: p.id, label: `${p.estudio} (${p.rating.toFixed(1)})` }))}
                  selected={selPhotogs}
                  onChange={setSelPhotogs}
                  placeholder="Elegí fotógrafos…"
                />
              </section>

              <section>
                <Label>Miniatura</Label>
                <select
                  className="h-11 w-full border rounded-lg px-3 bg-white"
                  value={thumbAspect}
                  onChange={(e) => setThumbAspect(e.target.value)}
                >
                  <option value="3:4">3:4</option>
                  <option value="1:1">1:1</option>
                </select>
              </section>

              <section className="pt-2">
                <h3 className="font-semibold mb-3">Mi Moto</h3>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="w-4 h-4" checked={usarMiMoto} onChange={(e) => setUsarMiMoto(e.target.checked)} />
                  Usar mis datos (recomendado)
                </label>
              </section>

              <section>
                <h3 className="font-semibold mb-3">Personas</h3>
                <div className="flex gap-2">
                  <SegBtn active={riders === "cualquiera"} onClick={() => setRiders("cualquiera")}>Cualquiera</SegBtn>
                  <SegBtn active={riders === "1"} onClick={() => setRiders("1")}>1</SegBtn>
                  <SegBtn active={riders === "2"} onClick={() => setRiders("2")}>2</SegBtn>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="font-semibold">Colores — Moto</h3>
                <ColorCombo items={makeColorItems()} selected={Array.from(coloresMoto)} onChange={(arr) => setColoresMoto(new Set(arr))} placeholder="Elegí colores de tu moto…"/>
                <h3 className="font-semibold">Colores — Chaqueta/Cuerpo</h3>
                <ColorCombo items={makeColorItems()} selected={Array.from(coloresChaqueta)} onChange={(arr) => setColoresChaqueta(new Set(arr))} placeholder="Elegí colores de tu chumpa…"/>
                <h3 className="font-semibold">Colores — Casco</h3>
                <ColorCombo items={makeColorItems()} selected={Array.from(coloresCasco)} onChange={(arr) => setColoresCasco(new Set(arr))} placeholder="Elegí colores de tu casco…"/>
              </section>

              <section>
                <h3 className="font-semibold mb-1">Confianza de IA</h3>
                <input type="range" min={0} max={100} value={confIA} onChange={(e) => setConfIA(Number(e.target.value))} className="w-full" />
                <div className="text-sm mt-1">≥ {confIA}%</div>
              </section>

              <div className="pt-2 pb-6 flex items-center justify-end gap-2">
                <button className="h-11 px-4 rounded-xl border bg-white font-display font-bold" onClick={limpiarTodo}>Limpiar</button>
                <button className="h-11 px-4 rounded-xl bg-blue-600 text-white font-display font-bold" onClick={aplicarYCerrarMobile}>Aplicar filtros</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ================== Subcomponentes UI (solo filtros) ================== */

function Label({ children }) {
  return <div className="text-[11px] text-slate-500 mb-1">{children}</div>;
}

function SegBtn({ active, onClick, children, small }) {
  return (
    <button
      className={
        (small ? "h-8 px-2.5 text-[12px]" : "h-9 px-3") +
        " rounded-lg font-display font-bold " +
        (active ? " bg-blue-600 text-white" : " bg-white border")
      }
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/* Dual range (hora) compacto */
function DualRange({ min, max, step = 1, value, onChange, renderLabel }) {
  const [a, b] = value;
  const clamp = (v) => Math.max(min, Math.min(max, v));
  const handleA = (v) => onChange([Math.min(clamp(v), b), b]);
  const handleB = (v) => onChange([a, Math.max(clamp(v), a)]);
  const pct = (v) => ((v - min) * 100) / (max - min);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[11px] text-slate-500 -mb-1">
        <span>{renderLabel ? renderLabel(a) : a}</span>
        <span>{renderLabel ? renderLabel(b) : b}</span>
      </div>
      <div className="relative h-8">
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 rounded-full bg-slate-200" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-blue-500"
          style={{ left: `${pct(a)}%`, right: `${100 - pct(b)}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={a}
          onChange={(e) => handleA(Number(e.target.value))}
          className="absolute inset-0 w-full appearance-none bg-transparent pointer-events-auto"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={b}
          onChange={(e) => handleB(Number(e.target.value))}
          className="absolute inset-0 w-full appearance-none bg-transparent pointer-events-auto"
        />
      </div>
    </div>
  );
}

/* Multiselect dropdown con checkboxes (compacto) */
function CheckCombo({ items, selected, onChange, placeholder = "Seleccionar…", small = false }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const toggle = (id) => {
    const set = new Set(selected);
    set.has(id) ? set.delete(id) : set.add(id);
    onChange(Array.from(set));
  };
  const clear = () => onChange([]);
  const filtered = items.filter((it) => it.label.toLowerCase().includes(term.toLowerCase()));

  return (
    <div className="relative">
      <button
        type="button"
        className={
          (small ? "h-9 px-2" : "h-11 px-3") +
          " w-full rounded-lg border bg-white text-left font-display font-bold text-sm"
        }
        onClick={() => setOpen((v) => !v)}
      >
        {selected.length === 0 ? (
          <span className="text-slate-500 font-normal">{placeholder}</span>
        ) : (
          <span>{selected.length} seleccionado{selected.length > 1 ? "s" : ""}</span>
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-72 max-w-[90vw] rounded-xl border bg-white shadow-card p-3">
          <div className="flex items-center gap-2 mb-2">
            <input
              className="flex-1 h-9 border rounded-lg px-2 text-sm"
              placeholder="Buscar…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
            <button className="h-9 px-3 rounded-lg border font-display font-bold text-sm" onClick={clear}>Limpiar</button>
          </div>
          <div className="max-h-64 overflow-auto space-y-1">
            {filtered.map((it) => {
              const checked = selected.includes(it.id);
              return (
                <label key={it.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 text-sm">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={checked}
                    onChange={() => toggle(it.id)}
                  />
                  <span>{it.label}</span>
                </label>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-sm text-slate-500 px-2 py-1">Sin resultados</div>
            )}
          </div>
          <div className="mt-2 text-right">
            <button className="h-9 px-3 rounded-lg bg-blue-600 text-white text-sm font-display font-bold" onClick={() => setOpen(false)}>
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* Color multiselect (compacto) */
function ColorCombo({ items, selected, onChange, placeholder, small = false }) {
  const enhanced = items.map((c) => ({
    ...c,
    labelNode: (
      <span className="inline-flex items-center gap-2">
        <span className={`w-3.5 h-3.5 rounded-full border ${colorClass(c.color)}`} />
        <span className="capitalize">{c.label}</span>
      </span>
    ),
  }));

  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const toggle = (id) => {
    const set = new Set(selected);
    set.has(id) ? set.delete(id) : set.add(id);
    onChange(Array.from(set));
  };
  const clear = () => onChange([]);
  const filtered = enhanced.filter((it) =>
    it.label.toLowerCase().includes(term.toLowerCase())
  );

  return (
    <div className="relative">
      <button
        type="button"
        className={
          (small ? "h-9 px-2" : "h-11 px-3") +
          " w-full rounded-lg border bg-white text-left font-display font-bold text-sm"
        }
        onClick={() => setOpen((v) => !v)}
      >
        {selected.length === 0 ? (
          <span className="text-slate-500 font-normal">{placeholder}</span>
        ) : (
          <span>{selected.length} seleccionado{selected.length > 1 ? "s" : ""}</span>
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-72 max-w-[90vw] rounded-xl border bg-white shadow-card p-3">
          <div className="flex items-center gap-2 mb-2">
            <input
              className="flex-1 h-9 border rounded-lg px-2 text-sm"
              placeholder="Buscar color…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
            <button className="h-9 px-3 rounded-lg border font-display font-bold text-sm" onClick={clear}>Limpiar</button>
          </div>
          <div className="max-h-64 overflow-auto space-y-1">
            {filtered.map((it) => {
              const checked = selected.includes(it.id);
              return (
                <label key={it.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 text-sm">
                  <input type="checkbox" className="w-4 h-4" checked={checked} onChange={() => toggle(it.id)} />
                  <span>{it.labelNode}</span>
                </label>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-sm text-slate-500 px-2 py-1">Sin resultados</div>
            )}
          </div>
          <div className="mt-2 text-right">
            <button className="h-9 px-3 rounded-lg bg-blue-600 text-white text-sm font-display font-bold" onClick={() => setOpen(false)}>
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function makeColorItems() {
  return [
    { id: "negro", label: "negro", color: "negro" },
    { id: "blanco", label: "blanco", color: "blanco" },
    { id: "gris", label: "gris", color: "gris" },
    { id: "plateado", label: "plateado", color: "plateado" },
    { id: "azul", label: "azul", color: "azul" },
    { id: "rojo", label: "rojo", color: "rojo" },
    { id: "verde", label: "verde", color: "verde" },
    { id: "amarillo", label: "amarillo", color: "amarillo" },
    { id: "naranja", label: "naranja", color: "naranja" },
    { id: "morado", label: "morado", color: "morado" },
  ];
}

function colorClass(c) {
  const map = {
    negro: "bg-black",
    blanco: "bg-white",
    gris: "bg-gray-500",
    plateado: "bg-slate-300",
    azul: "bg-blue-600",
    rojo: "bg-red-600",
    verde: "bg-green-600",
    amarillo: "bg-yellow-400",
    naranja: "bg-orange-500",
    morado: "bg-purple-600",
  };
  return map[c] || "bg-slate-400";
}

function formatQ(n) {
  try {
    return new Intl.NumberFormat("es-GT", {
      style: "currency",
      currency: "GTQ",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `Q${n}`;
  }
}
