// src/components/PhotoLightbox.jsx
import React, { useEffect, useMemo, useRef } from "react";

/**
 * PhotoLightbox – visor full-screen con “zona segura” inferior para tu HUD.
 *
 * Props:
 *  - images: Array<{ src, alt?, caption?, meta?: { fileName?, time?, hotspot? } }>
 *  - index: number
 *  - onIndexChange(next:number): void
 *  - onClose(): void
 *  - showThumbnails?: boolean
 *  - captionPosition?: 'header' | 'bottom-centered'
 *  - arrowBlue?: boolean
 *  - safeBottom?: number   // altura del HUD (para no tapar la imagen)
 */
export default function PhotoLightbox({
  images = [],
  index = 0,
  onIndexChange,
  onClose,
  showThumbnails = true,
  captionPosition = "bottom-centered",
  arrowBlue = false,
  safeBottom = 0,
}) {
  const total = images.length || 0;
  const current = images[index] || {};
  const containerRef = useRef(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev || ""; };
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, total]);

  function prev() { if (total) onIndexChange?.((index - 1 + total) % total); }
  function next() { if (total) onIndexChange?.((index + 1) % total); }

  const preload = useMemo(() => {
    const a = images[(index - 1 + total) % total]?.src;
    const b = images[(index + 1) % total]?.src;
    return [a, b].filter(Boolean);
  }, [index, total, images]);

  const arrowCls = arrowBlue
    ? "w-10 h-10 rounded-full bg-blue-600/90 hover:bg-blue-600 text-white border border-blue-500/60"
    : "w-10 h-10 rounded-full bg-white/10 text-white border border-white/15";

  // ── Ajustes de posicionamiento ──────────────────────────────────────────────
  // Más empuje hacia arriba para que el HUD NO tape nada.
  const EXTRA_PUSH_UP = 72; // ← subido (antes era menor). Si querés más, aumentá este número.
  const captionPad = captionPosition === "bottom-centered" ? 80 : 24; // espacio del chip
  const bottomPad = (safeBottom || 0) + captionPad + EXTRA_PUSH_UP;   // empuja la imagen hacia arriba
  const topPad = 8; // margen superior mínimo (dejamos más espacio arriba)

  // Metadatos mínimos para el chip (no el HUD)
  const fileName = current?.meta?.fileName || current?.alt || "";
  const time = current?.meta?.time || "";
  const hotspot = current?.meta?.hotspot || "";

  return (
    <div className="fixed inset-0 z-[1000]" aria-modal="true" role="dialog" ref={containerRef}>
      {/* Fondo */}
      <div className="absolute inset-0 bg-black/90" onClick={onClose} />

      {/* SOLO botón cerrar arriba-derecha (no tocamos tu HUD) */}
      <button
        className="fixed top-3 right-3 z-[2100] h-9 px-3 rounded-lg bg-white/10 text-white border border-white/15"
        onClick={onClose}
        title="Cerrar (Esc)"
      >
        Cerrar
      </button>

      {/* Imagen centrada (respeta topPad y bottomPad, así no la tapa el HUD) */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ paddingTop: topPad, paddingBottom: bottomPad }}
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

      {/* Caption chip inferior (pequeño), sobre la foto, respetando safeBottom */}
      {captionPosition === "bottom-centered" && (
        <div
          className="absolute left-0 right-0 bottom-0 flex justify-center items-end pointer-events-none z-[2000]"
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

      {/* Flechas (por encima de la imagen) */}
      {total > 1 && (
        <>
          <button
            className={`${arrowCls} absolute left-3 top-1/2 -translate-y-1/2 z-[2050]`}
            onClick={(e) => { e.stopPropagation(); prev(); }}
            aria-label="Anterior"
            title="Anterior (←)"
          >
            ‹
          </button>
          <button
            className={`${arrowCls} absolute right-3 top-1/2 -translate-y-1/2 z-[2050]`}
            onClick={(e) => { e.stopPropagation(); next(); }}
            aria-label="Siguiente"
            title="Siguiente (→)"
          >
            ›
          </button>
        </>
      )}

      {/* Carrusel de thumbnails – por ENCIMA del HUD */}
      {showThumbnails && total > 1 && (
        <div
          className="absolute left-0 right-0 p-2 bg-black/40 z-[3000]"
          style={{ bottom: (safeBottom || 0) + EXTRA_PUSH_UP + 8 }} // subido más
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
