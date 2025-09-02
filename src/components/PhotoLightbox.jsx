import React, { useEffect, useMemo, useRef } from "react";

/**
 * PhotoLightbox – visor full-screen
 *
 * Props:
 * - images: Array<{ src: string, alt?: string, caption?: string, meta?: { fileName?: string, time?: string, hotspot?: string } }>
 * - index: number
 * - onIndexChange: (next:number)=>void
 * - onClose: ()=>void
 * - showThumbnails?: boolean
 * - captionPosition?: 'header' | 'bottom-centered' (default: 'header')
 * - arrowBlue?: boolean (default: false)
 */
export default function PhotoLightbox({
  images = [],
  index = 0,
  onIndexChange,
  onClose,
  showThumbnails = false,
  captionPosition = "header",
  arrowBlue = false,
}) {
  const total = images.length || 0;
  const current = images[index] || {};
  const containerRef = useRef(null);

  // Bloquear scroll del body
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => (document.body.style.overflow = prev);
  }, []);

  // Navegación por teclado
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, total]);

  function prev() {
    if (!total) return;
    onIndexChange?.((index - 1 + total) % total);
  }
  function next() {
    if (!total) return;
    onIndexChange?.((index + 1) % total);
  }

  // Preload vecinos
  const preload = useMemo(() => {
    const a = images[(index - 1 + total) % total]?.src;
    const b = images[(index + 1) % total]?.src;
    return [a, b].filter(Boolean);
  }, [index, total, images]);

  const arrowCls = arrowBlue
    ? "w-10 h-10 rounded-full bg-blue-600/90 hover:bg-blue-600 text-white border border-blue-500/60"
    : "w-10 h-10 rounded-full bg-white/10 text-white border border-white/15";

  const fileName = current?.meta?.fileName || current?.alt || "";
  const time = current?.meta?.time || "";
  const hotspot = current?.meta?.hotspot || "";

  return (
    <div className="fixed inset-0 z-[1000]" aria-modal="true" role="dialog" ref={containerRef}>
      {/* Fondo – click cierra */}
      <div className="absolute inset-0 bg-black/90" onClick={onClose} />

      {/* Header (solo si se usa modo header) */}
      {captionPosition === "header" && (
        <div
          className="absolute top-0 left-0 right-0 p-3 flex items-center gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ml-1 text-xs sm:text-sm text-slate-300">
            {total > 0 ? `${index + 1} / ${total}` : "0 / 0"}
            {current?.caption ? <span className="hidden sm:inline"> · {current.caption}</span> : null}
          </div>
          <button
            className="ml-auto h-9 px-3 rounded-lg bg-white/10 text-white border border-white/15"
            onClick={onClose}
            title="Cerrar (Esc)"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Contenedor central – click cierra (fuera de la imagen) */}
      <div
        className={`absolute inset-0 flex items-center justify-center px-3 ${captionPosition === "bottom-centered" ? "pt-10 pb-20" : "pt-10 pb-6"}`}
        onClick={onClose}
      >
        {/* Imagen – NO cierra al click */}
        <img
          src={current?.src}
          alt={current?.alt || ""}
          className="max-h-full max-w-full object-contain select-none"
          draggable={false}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Flechas */}
      {total > 1 && (
        <>
          <div
            className="absolute inset-y-0 left-0 w-16 grid place-items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button className={arrowCls} onClick={prev} title="Anterior (←)">
              ‹
            </button>
          </div>
          <div
            className="absolute inset-y-0 right-0 w-16 grid place-items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button className={arrowCls} onClick={next} title="Siguiente (→)">
              ›
            </button>
          </div>
        </>
      )}

      {/* Caption abajo & centrado (studio) – UNA SOLA FILA con scroll horizontal si no cabe */}
      {captionPosition === "bottom-centered" && (
        <div
          className="absolute bottom-0 left-0 right-0 px-4 pb-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto max-w-5xl">
            <div className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex items-center justify-center gap-2 whitespace-nowrap text-[12px] text-slate-100">
                <span className="px-2 py-0.5 rounded bg-white/10 border border-white/15">
                  {index + 1} / {total}
                </span>
                <span className="text-slate-300">·</span>
                <span
                  className="font-mono text-sm font-semibold select-text"
                  title={fileName}
                >
                  {fileName || "Foto"}
                </span>
                {time && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span>{time}</span>
                  </>
                )}
                {hotspot && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span>{hotspot}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Thumbnails opcionales */}
      {showThumbnails && total > 1 && (
        <div
          className="absolute bottom-0 left-0 right-0 p-2 bg-black/40"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto max-w-5xl flex gap-2 overflow-auto">
            {images.map((im, i) => (
              <button
                key={i}
                className={`w-16 h-16 rounded overflow-hidden border ${
                  i === index ? "border-blue-500" : "border-white/10"
                }`}
                onClick={() => onIndexChange?.(i)}
                title={im.alt || im.caption || `Foto ${i + 1}`}
              >
                <img src={im.src} alt="" className="w-full h-full object-cover" draggable={false} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Preload vecinos */}
      {preload.map((p, i) => (
        <link key={i} rel="preload" as="image" href={p} />
      ))}
    </div>
  );
}
