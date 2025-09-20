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
  fecha, setFecha,
  iniStep, setIniStep,
  finStep, setFinStep,
  ignorarHora, setIgnorarHora,
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

  return (
    <div
      className={
        `w-screen ml-[calc(50%-50vw)]
         ${pinned ? "fixed top-0 left-0 right-0 z-[600]" : "relative z-[600]"}
         bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80
         border-b border-slate-200`
      }
      style={{ overflow: "visible" }} // no cortar dropdowns/menus
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
              disabled={ignorarHora}
              title={ignorarHora ? "Ignorando fecha/hora" : ""}
            />
          </Field>

          {/* HORA (estilo original) */}
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

          {/* IGNORAR HORA */}
          <Field label="Ignorar hora" className="min-w-[160px]">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 h-9">
              <input
                id="f-ignorar"
                type="checkbox"
                checked={ignorarHora}
                onChange={(e) => setIgnorarHora(e.target.checked)}
              />
              <span>Aplicar sin fecha/hora</span>
            </label>
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

          {/* FOTÓGRAFO */}
          <Field label="Fotógrafo" className="min-w-[200px]">
            {/* Wrapper con z mayor que la barra para que el menú caiga sobre el grid */}
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

/* ======= Dual Slider (estilo original) ======= */
function DualSlider({ min, max, a, b, onChangeA, onChangeB, width = 200 }) {
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
      <div className="flex items-center justify-between text-[11px] leading-none text-slate-600 mb-1 font-mono">
        <span>{to12h(stepToTime24(a))}</span>
        <span>{to12h(stepToTime24(b))}</span>
      </div>
      <div ref={ref} className="relative h-7">
        <div className="absolute inset-0 rounded-full bg-slate-200" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-blue-500"
          style={{ left: `${toPct(a)}%`, width: `${toPct(b) - toPct(a)}%` }}
        />
        <button
          type="button"
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border border-slate-300 bg-white shadow"
          style={{ left: `${toPct(a)}%` }}
          onMouseDown={startDrag("a")}
          aria-label="Hora inicio"
          title="Hora inicio"
        />
        <button
          type="button"
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border border-slate-300 bg-white shadow"
          style={{ left: `${toPct(b)}%` }}
          onMouseDown={startDrag("b")}
          aria-label="Hora final"
          title="Hora final"
        />
      </div>
    </div>
  );
}
