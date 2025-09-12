import React, { useEffect, useMemo, useRef } from "react";

/**
 * PhotoLightbox – visor full-screen (con zona segura inferior)
 *
 * Props:
 *  - images: Array<{ src, alt?, caption?, meta?: { fileName?, time?, hotspot? } }>
 *  - index: number
 *  - onIndexChange(next:number): void
 *  - onClose(): void
 *  - showThumbnails?: boolean
 *  - captionPosition?: 'header' | 'bottom-centered'
 *  - arrowBlue?: boolean
 *  - safeBottom?: number   // píxeles de zona segura inferior (para HUD externo)
 */
export default function PhotoLightbox({
  images = [],
  index = 0,
  onIndexChange,
  onClose,
  showThumbnails = false,
  captionPosition = "bottom-centered",
  arrowBlue = false,
  safeBottom = 0,
}) {
  const total = images.length || 0;
  const current = images[index] || {};
  const containerRef = useRef(null);

  // Bloquear scroll del body mientras está abierto
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, []);

  // Teclado: Esc, ←, →
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  // Metadatos básicos (por si querés mini caption)
  const fileName = current?.meta?.fileName || current?.alt || "";
  const time = current?.meta?.time || "";
  const hotspot = current?.meta?.hotspot || "";

  // Alturas internas: base para caption + zona segura para tu HUD inferior
  const baseBottomPad = captionPosition === "bottom-centered" ? 80 : 24; // px aprox
  const paddingBottom = baseBottomPad + (safeBottom || 0);

  return (
    <div className="fixed inset-0 z-[1000]" aria-modal="true" role="dialog" ref={containerRef}>
      {/* Fondo – click cierra */}
      <div className="absolute inset-0 bg-black/90" onClick={onClose} />

      {/* SOLO botón cerrar arriba a la derecha (sin info arriba-izquierda) */}
      <button
        className="fixed top-3 right-3 z-[1010] h-9 px-3 rounded-lg bg-white/10 text-white border border-white/15"
        onClick={onClose}
        title="Cerrar (Esc)"
      >
        Cerrar
      </button>

      {/* Contenedor central (la imagen no cierra al click) */}
      <div
        className="absolute inset-0 flex items-center justify-center pt-10"
        style={{ paddingBottom }}
        onClick={onClose}
      >
        <img
          src={current?.src}
          alt={current?.alt || ""}
          className="max-w-[96vw] max-h-[90vh] object-contain select-none"
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        />
      </div>

      {/* Caption inferior opcional (chiquito) */}
      {captionPosition === "bottom-centered" && (
        <div
          className="absolute left-0 right-0 bottom-0 flex justify-center items-end pointer-events-none"
          style={{ paddingBottom: safeBottom }}
        >
          <div className="pointer-events-auto mb-2 rounded-full bg-black/50 text-white text-xs sm:text-sm px-3 py-1.5 border border-white/10">
            {total > 0 ? `${index + 1} / ${total}` : "0 / 0"}
            {current?.caption ? <span className="hidden sm:inline"> · {current.caption}</span> : null}
            {(fileName || time || hotspot) && (
              <span className="hidden md:inline">
                {fileName ? <> · {fileName}</> : null}
                {time ? <> · {time}</> : null}
                {hotspot ? <> · {hotspot}</> : null}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Flechas */}
      {total > 1 && (
        <>
          <button
            className={`${arrowCls} absolute left-3 top-1/2 -translate-y-1/2 z-[1010]`}
            onClick={(e) => { e.stopPropagation(); prev(); }}
            aria-label="Anterior"
            title="Anterior (←)"
          >
            ‹
          </button>
          <button
            className={`${arrowCls} absolute right-3 top-1/2 -translate-y-1/2 z-[1010]`}
            onClick={(e) => { e.stopPropagation(); next(); }}
            aria-label="Siguiente"
            title="Siguiente (→)"
          >
            ›
          </button>
        </>
      )}

      {/* Thumbnails (carrusel) */}
      {showThumbnails && total > 1 && (
        <div
          className="absolute bottom-0 left-0 right-0 p-2 bg-black/40"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto max-w-5xl flex gap-2 overflow-auto">
            {images.map((im, i) => (
              <button
                key={i}
                className={`w-16 h-16 rounded overflow-hidden border-4 ${
                  i === index ? "border-blue-500 ring-4 ring-blue-500" : "border-white/10"
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
