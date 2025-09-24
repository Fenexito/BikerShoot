// src/routes/biker/Search/SearchFiltersBar.jsx
import React from "react";
import MultiSelectCheckbox from "./MultiSelectCheckbox.jsx";
import {
  RUTAS_FIJAS,
  MIN_STEP, MAX_STEP,
  stepToTime24, to12h,
} from "./lib/searchShared";

export default function SearchFiltersBar({
  pinned,
  // filtros
  fecha, setFecha,
  iniStep, setIniStep,
  finStep, setFinStep,
  ruta, setRuta,
  photogOptions,
  selPhotogs, setSelPhotogs,
  hotspotOptions,
  selHotspots, setSelHotspots,
  // vista
  cols, setCols,
  showLabels, setShowLabels,
  // acción
  onSubmitSearch,
  searching = false,
}) {
  const disableBuscar = searching || ruta === "Todos";

  // 💡 Clave para matar el scroll X:
  // - Nada de w-screen ni calc(50%-50vw).
  // - En pinned usamos fixed + inset-x-0 (ocupa el ancho real de la página),
  //   con max-w-[100vw] y overflow-x: clip por seguridad.
  // - En no pinned usamos w-full y flujo normal.
  const outerClass = pinned
    ? "fixed inset-x-0 top-0 z-[600] max-w-[100vw]"
    : "relative z-[600] w-full";

  return (
    <div
      className={`
        ${outerClass}
        bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80
        border-b border-slate-200
        box-border
      `}
      style={{
        // permitir dropdowns hacia fuera pero sin desbordar horizontal:
        overflowY: "visible",
        overflowX: "clip",
      }}
    >
      <div className="px-3 sm:px-6 py-2 pointer-events-auto">
        {/* NOTA: z-[601] mantiene a los controles sobre el contenido, pero debajo del Lightbox */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 relative z-[601]">
          {/* FECHA */}
          <Field label="Fecha" className="min-w-[140px]">
            <input
              id="f-fecha"
              type="date"
              className="h-9 border rounded-lg px-2 bg-white w-[150px] max-w-full"
              value={fecha || ""}
              onChange={(e) => setFecha(e.target.value)}
            />
          </Field>

          {/* RUTA */}
          <Field label="Ruta" className="min-w-[170px]">
            <select
              id="f-ruta"
              className="h-9 border rounded-lg px-2 bg-white min-w-[160px] w-[180px] max-w-full"
              value={ruta}
              onChange={(e) => setRuta(e.target.value)}
            >
              <option value="Todos">Todas</option>
              {RUTAS_FIJAS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Field>

          {/* HORA (doble deslizador original) */}
          <Field label="Hora" className="min-w-[220px]">
            <DualSlider
              min={MIN_STEP}
              max={MAX_STEP}
              a={iniStep}
              b={finStep}
              onChangeA={setIniStep}
              onChangeB={setFinStep}
              width={220}
            />
          </Field>

          {/* FOTÓGRAFO */}
          <Field label="Fotógrafo" className="min-w-[200px]">
            <div className="relative z-[650] h-9 flex items-center">
              <div className="w-[200px] max-w-full">
                <MultiSelectCheckbox
                  options={photogOptions}
                  value={selPhotogs}
                  onChange={setSelPhotogs}
                  placeholder={ruta === "Todos" ? "Elegí una ruta" : "Seleccionar"}
                />
              </div>
            </div>
          </Field>

          {/* PUNTO */}
          <Field label="Punto" className="min-w-[200px]">
            <div className="relative z-[650] h-9 flex items-center">
              <div className="w-[200px] max-w-full">
                <MultiSelectCheckbox
                  options={hotspotOptions}
                  value={selHotspots}
                  onChange={setSelHotspots}
                  placeholder={ruta === "Todos" ? "Elegí una ruta" : "Seleccionar"}
                />
              </div>
            </div>
          </Field>

          {/* SEPARADOR VERTICAL */}
          <div className="hidden xl:block w-px h-10 bg-slate-200 mx-1 shrink-0" />

          {/* ====== VISTA + BUSCAR (derecha) ====== */}
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
            <Field label="Tamaño" className="min-w-[180px]">
              <div className="flex items-center gap-2 h-9">
                <input
                  id="f-cols"
                  type="range"
                  min={4}
                  max={12}
                  step={1}
                  value={cols}
                  onChange={(e) => setCols(parseInt(e.target.value, 10))}
                  className="max-w-[160px]"
                />
                <span className="text-slate-500 text-xs">({cols})</span>
              </div>
            </Field>

            <Field label="Mostrar info" className="min-w-[160px]">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 h-9">
                <input
                  id="f-showlabels"
                  type="checkbox"
                  checked={showLabels}
                  onChange={(e) => setShowLabels(e.target.checked)}
                />
                <span>Debajo de la foto</span>
              </label>
            </Field>

            <div className="flex items-center h-16">
              <button
                type="button"
                onClick={onSubmitSearch}
                disabled={disableBuscar}
                className={`h-9 px-4 rounded-lg font-semibold shadow
                  ${disableBuscar
                    ? "bg-slate-300 text-slate-600 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition"
                  }`}
                title={ruta === "Todos" ? "Elegí una ruta para buscar" : "Buscar"}
              >
                {searching ? "Buscando…" : "BUSCAR"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==== Field: altura uniforme y label en negrita ==== */
function Field({ label, className = "", children }) {
  return (
    <div className={`flex flex-col justify-center h-16 ${className}`}>
      <span className="text-[11px] leading-none font-bold text-slate-700 tracking-wide mb-1">
        {label}
      </span>
      {children}
    </div>
  );
}

/* ======= Dual Slider (puro JS, con labels 12h) ======= */
function DualSlider({ min, max, a, b, onChangeA, onChangeB, width = 220 }) {
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
    [min, max, a, b, onChangeA, onChangeB]
  );

  const onPointerDown = (key) => (ev) => {
    dragging.current = key;
    try {
      const tgt = ev.target;
      if (tgt && typeof tgt.setPointerCapture === "function") {
        tgt.setPointerCapture(ev.pointerId);
      }
    } catch (_) {}
  };
  const onPointerUp = () => { dragging.current = null; };

  return (
    <div style={{ width }} className="select-none">
      <div
        ref={ref}
        className="h-2 rounded bg-slate-200 relative"
        onPointerMove={onMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* pista activa */}
        <div
          className="absolute h-2 bg-blue-500 rounded"
          style={{
            left: `${toPct(a)}%`,
            width: `${Math.max(0, toPct(b) - toPct(a))}%`,
          }}
        />
        {/* pulgar A */}
        <div
          role="slider"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={a}
          tabIndex={0}
          className="absolute -top-1 size-4 rounded-full bg-white border border-slate-300 shadow cursor-pointer touch-none"
          style={{ left: `calc(${toPct(a)}% - 8px)` }}
          onPointerDown={onPointerDown("a")}
        />
        {/* pulgar B */}
        <div
          role="slider"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={b}
          tabIndex={0}
          className="absolute -top-1 size-4 rounded-full bg-white border border-slate-300 shadow cursor-pointer touch-none"
          style={{ left: `calc(${toPct(b)}% - 8px)` }}
          onPointerDown={onPointerDown("b")}
        />
      </div>
      {/* Etiquetas de hora (12h) */}
      <div className="mt-1 text-[11px] text-slate-600 flex justify-between tabular-nums">
        <span>{to12h(stepToTime24(a))}</span>
        <span>{to12h(stepToTime24(b))}</span>
      </div>
    </div>
  );
}
