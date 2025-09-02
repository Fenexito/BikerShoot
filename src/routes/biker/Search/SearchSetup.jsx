import React, { useState, useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { photographers } from "../../../data/photographers";
import { hotspots, routes as routeList } from "../../../data/hotspots";
import { searchPhotos } from "../../../data/searchPhotos";

/* ===== Helpers ===== */
const arrToCsv = (a) => (Array.isArray(a) ? a.join(",") : "");
const csvToArr = (v) => (!v ? [] : v.split(",").filter(Boolean));
const HHMMtoMin = (hhmm) => {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  return h * 60 + m;
};
const minToHHMM = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export default function BikerSearchSetup() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  /* ===== Estado (con valores desde query si venís de “Reiniciar búsqueda”) ===== */
  const [fecha, setFecha] = useState(() => params.get("fecha") || new Date().toISOString().slice(0,10));
  const [inicioMin, setInicioMin] = useState(() => HHMMtoMin(params.get("inicio") || "06:00"));
  const [finMin, setFinMin] = useState(() => HHMMtoMin(params.get("fin") || "12:00"));
  const [ruta, setRuta] = useState(() => params.get("ruta") || "Todos");

  const [selHotspots, setSelHotspots] = useState(() => csvToArr(params.get("hotspots")));
  const [selPhotogs, setSelPhotogs] = useState(() => csvToArr(params.get("photogs")));

  const [mimoto, setMiMoto] = useState(() => params.get("mimoto")==="1");
  const [colMoto, setColMoto] = useState(() => csvToArr(params.get("cmoto")));
  const [colChaq, setColChaq] = useState(() => csvToArr(params.get("cchaq")));
  const [colCasco, setColCasco] = useState(() => csvToArr(params.get("ccasco")));
  const [conf, setConf] = useState(() => Number(params.get("conf") ?? 60));
  const [riders, setRiders] = useState(() => params.get("riders") || "cualquiera");
  const [asp, setAsp] = useState(() => params.get("asp") || "3:4");

  const hsVisibles = useMemo(() => (ruta === "Todos" ? hotspots : hotspots.filter(h => h.route === ruta)), [ruta]);

  const aplicar = () => {
    const q = new URLSearchParams({
      fecha,
      inicio: minToHHMM(inicioMin),
      fin: minToHHMM(finMin),
      ruta,
      hotspots: arrToCsv(selHotspots),
      photogs: arrToCsv(selPhotogs),
      mimoto: mimoto ? "1" : "0",
      cmoto: arrToCsv(colMoto),
      cchaq: arrToCsv(colChaq),
      ccasco: arrToCsv(colCasco),
      conf: String(conf),
      riders,
      asp
    }).toString();
    nav(`/app/buscar?${q}`);
  };

  return (
    <main className="w-full max-w-[1300px] mx-auto px-4 md:px-6 xl:px-8 py-6">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-display font-black">Configurar búsqueda</h1>
        <p className="text-slate-600 mt-1 text-sm">
          Definí fecha, horario, ruta, puntos y tu apariencia para reducir miles de fotos antes de entrar.
        </p>
      </header>

      {/* === Tarjetas de filtros === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ride + Mapa */}
        <section className="rounded-2xl border bg-white p-4 md:p-5 space-y-4">
          <h2 className="text-base font-semibold">Ride</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Fecha</Label>
              <input
                type="date"
                className="h-11 border rounded-lg px-3 w-full"
                value={fecha}
                onChange={(e)=>setFecha(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Horario (salida / regreso)</Label>
              <DualRange
                min={0}
                max={24 * 60 - 1}
                step={5}
                value={[inicioMin, finMin]}
                onChange={([a, b]) => { setInicioMin(a); setFinMin(b); }}
                renderLabel={(v) => minToHHMM(v)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Ruta</Label>
              <select className="h-11 border rounded-lg px-3 w-full" value={ruta} onChange={(e)=>setRuta(e.target.value)}>
                <option value="Todos">Todas</option>
                {routeList.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <Label>Miniatura</Label>
              <select className="h-11 border rounded-lg px-3 w-full" value={asp} onChange={(e)=>setAsp(e.target.value)}>
                <option value="3:4">3:4</option>
                <option value="1:1">1:1</option>
              </select>
            </div>
          </div>

          {/* Mapa interactivo */}
          <div>
            <Label>Mapa (tocá para seleccionar puntos)</Label>
            <MapaInteractivo
              puntos={hsVisibles}
              seleccionados={selHotspots}
              onToggle={(id)=>{
                setSelHotspots(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
              }}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {selHotspots.length === 0 && <span className="text-sm text-slate-500">No hay puntos seleccionados.</span>}
              {selHotspots.map((id)=>(
                <span key={id} className="text-sm px-2.5 py-1 rounded-full bg-slate-100 border">
                  {hsVisibles.find(h=>h.id===id)?.name || `Punto ${id}`}
                  <button className="ml-1" onClick={()=>setSelHotspots(prev => prev.filter(x=>x!==id))}>✕</button>
                </span>
              ))}
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-slate-600">Editar lista manualmente</summary>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-auto">
                {hsVisibles.map(h => (
                  <label key={h.id} className="flex items-center gap-2 border rounded-lg px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selHotspots.includes(h.id)}
                      onChange={()=>{
                        setSelHotspots(prev => prev.includes(h.id) ? prev.filter(x=>x!==h.id) : [...prev, h.id])
                      }}
                    />
                    <span>{h.name}</span>
                  </label>
                ))}
              </div>
            </details>
          </div>
        </section>

        {/* Tu apariencia (arreglado) */}
        <section className="rounded-2xl border bg-white p-4 md:p-5 space-y-4">
          <h2 className="text-base font-semibold">Tu apariencia</h2>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={mimoto} onChange={(e)=>setMiMoto(e.target.checked)} />
            <span className="text-sm">Usar mis datos de moto (recomendado)</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Colores de la moto</Label>
              <ColorCombo
                items={makeColorItems()}
                selected={colMoto}
                onChange={setColMoto}
                placeholder="Elegí colores…"
                small
              />
            </div>
            <div className="space-y-1.5">
              <Label>Colores de la chaqueta</Label>
              <ColorCombo
                items={makeColorItems()}
                selected={colChaq}
                onChange={setColChaq}
                placeholder="Elegí colores…"
                small
              />
            </div>
            <div className="space-y-1.5">
              <Label>Colores del casco</Label>
              <ColorCombo
                items={makeColorItems()}
                selected={colCasco}
                onChange={setColCasco}
                placeholder="Elegí colores…"
                small
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Confianza IA</Label>
              <input type="range" min={0} max={100} value={conf} onChange={(e)=>setConf(Number(e.target.value))} className="w-full"/>
              <div className="text-sm mt-1">≥ {conf}%</div>
            </div>
            <div>
              <Label>Personas</Label>
              <div className="flex gap-2">
                <SegBtn small active={riders==="cualquiera"} onClick={()=>setRiders("cualquiera")}>Cualquiera</SegBtn>
                <SegBtn small active={riders==="1"} onClick={()=>setRiders("1")}>1</SegBtn>
                <SegBtn small active={riders==="2"} onClick={()=>setRiders("2")}>2</SegBtn>
              </div>
            </div>
          </div>

          <div className="pt-1">
            <button onClick={aplicar} className="h-11 px-5 rounded-xl bg-blue-600 text-white font-display font-bold">
              Aplicar y buscar
            </button>
          </div>
        </section>
      </div>

      {/* === Explorar rápido (separado) === */}
      <section className="mt-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base md:text-lg font-semibold">Explorar rápido</h2>
        </div>

        {/* CTAs separados */}
        <div className="flex flex-wrap gap-3 mb-5">
          <Link to="/app/buscar/por-fotografo" className="h-10 px-4 rounded-xl border bg-white font-display font-bold grid place-items-center">
            Buscar por Fotógrafo
          </Link>
          <Link to="/app/buscar/por-punto" className="h-10 px-4 rounded-xl border bg-white font-display font-bold grid place-items-center">
            Buscar por Punto
          </Link>
        </div>

        {/* Preview por Fotógrafo */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Fotógrafos destacados</h3>
            <Link to="/app/buscar/por-fotografo" className="text-blue-600 font-semibold text-sm">Ver más</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {photographers.slice(0,3).map(p => (
              <PreviewCard key={p.id} title={p.estudio} subtitle={`Rating ${p.rating?.toFixed(1) || "—"}`} to={`/app/buscar?photogs=${p.id}`}>
                <MiniGallery images={getSamplePhotosBy("photographerId", p.id)} />
              </PreviewCard>
            ))}
          </div>
        </div>

        {/* Preview por Punto */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Eventos / Puntos recientes</h3>
            <Link to="/app/buscar/por-punto" className="text-blue-600 font-semibold text-sm">Ver más</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {hsVisibles.slice(0,3).map(h => (
              <PreviewCard key={h.id} title={h.name} subtitle={`Ruta: ${h.route}`} to={`/app/buscar?hotspots=${h.id}`}>
                <MiniGallery images={getSamplePhotosBy("hotspotId", h.id)} />
              </PreviewCard>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

/* ========= Subcomponentes ========= */

function Label({ children }) {
  return <div className="text-[12px] text-slate-500 mb-1">{children}</div>;
}

/* Botones segmentados (con variante small) */
function SegBtn({ active, onClick, children, small }) {
  return (
    <button
      className={
        (small ? "h-9 px-3 text-sm" : "h-11 px-4") +
        " rounded-xl font-display font-bold " +
        (active ? "bg-blue-600 text-white" : "bg-white border")
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

/* Multiselect con checks y punto de color */
function ColorCombo({ items, selected, onChange, placeholder = "Seleccionar…", small = false }) {
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
        className={(small ? "h-10 px-2 text-sm" : "h-11 px-3") + " w-full rounded-lg border bg-white text-left"}
        onClick={() => setOpen((v) => !v)}
      >
        {selected.length === 0 ? (
          <span className="text-slate-500">{placeholder}</span>
        ) : (
          <span className="font-medium">{selected.length} seleccionado{selected.length>1?"s":""}</span>
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
            <button className="h-9 px-3 rounded-lg border text-sm" onClick={clear}>Limpiar</button>
          </div>
          <div className="max-h-56 overflow-auto space-y-1">
            {filtered.map((it) => {
              const checked = selected.includes(it.id);
              return (
                <label key={it.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 text-sm">
                  <input type="checkbox" className="w-4 h-4" checked={checked} onChange={() => toggle(it.id)} />
                  <span className="inline-flex items-center gap-2 capitalize">
                    <span className={`w-3.5 h-3.5 rounded-full border ${colorClass(it.color)}`} />
                    {it.label}
                  </span>
                </label>
              );
            })}
            {filtered.length === 0 && <div className="text-sm text-slate-500 px-2 py-1">Sin resultados</div>}
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

/* --- Mapa interactivo mock (SVG) --- */
function MapaInteractivo({ puntos, seleccionados, onToggle }) {
  const withPos = useMemo(() => {
    const n = puntos.length || 1;
    return puntos.map((h, i) => {
      const x = (i + 1) / (n + 1);
      const y = 0.5 + 0.25 * Math.sin(i * 1.2);
      return { ...h, __x: x, __y: y };
    });
  }, [puntos]);

  return (
    <div className="relative w-full h-64 md:h-72 rounded-xl border overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100">
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
        <path d="M5 85 C 20 60, 40 70, 55 50 S 85 30, 95 15" fill="none" stroke="#2563eb" strokeWidth="1.5" opacity="0.3" />
        {withPos.map((h) => {
          const sel = seleccionados.includes(h.id);
          return (
            <g key={h.id} transform={`translate(${h.__x*100}, ${h.__y*100})`} onClick={()=>onToggle(h.id)} style={{cursor:'pointer'}}>
              <circle r={sel ? 3.8 : 3} fill={sel ? "#2563eb" : "#fff"} stroke="#2563eb" strokeWidth="1" />
              <text x="0" y="-6" textAnchor="middle" fontSize="3" fill="#334155">
                {h.name.slice(0,12)}{h.name.length>12?"…":""}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="absolute top-2 left-2 text-xs px-2 py-1 rounded bg-white/80 border">Mapa ilustrativo</div>
      <div className="absolute bottom-2 right-2 text-xs px-2 py-1 rounded bg-white/80 border">Tocá los puntos para seleccionar</div>
    </div>
  );
}

/* --- Preview cards y mini galerías (botón centrado) --- */
function PreviewCard({ title, subtitle, to, children }) {
  return (
    <article className="rounded-2xl border bg-white overflow-hidden">
      <div className="p-4 border-b">
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-slate-500">{subtitle}</div>
      </div>
      <div className="p-3">
        {children}
        <div className="mt-3 grid place-items-center">
          <Link to={to} className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-blue-600 text-white font-display font-bold">
            Ver
          </Link>
        </div>
      </div>
    </article>
  );
}

function MiniGallery({ images }) {
  const imgs = images.slice(0, 6);
  if (imgs.length === 0) {
    return (
      <div className="h-28 rounded-lg bg-slate-50 border grid place-items-center text-sm text-slate-500">
        Sin fotos disponibles
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {imgs.map((src, i) => (
        <div key={i} className="aspect-[3/4] rounded-lg overflow-hidden bg-slate-100 border">
          <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
      ))}
    </div>
  );
}

/* --- Fuente de imágenes mock --- */
function getSamplePhotosBy(field, value) {
  return searchPhotos.filter((p) => p[field] === value).slice(0, 12).map((p) => p.url);
}
