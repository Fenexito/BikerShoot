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
 * - footerSafeArea?: number (px) – espacio reservado abajo para HUD externo
 * - showHeaderClose?: boolean (default: false)
 */
export default function PhotoLightbox({
  images = [],
  index = 0,
  onIndexChange,
  onClose,
  showThumbnails = true,
  captionPosition = "header",
  arrowBlue = false,
  footerSafeArea = 0,
  showHeaderClose = false,
}) {
  const total = images.length || 0;
  const safeIndex = Math.max(0, Math.min(index, Math.max(0, total - 1)));
  const current = images[safeIndex] || {};
  const containerRef = useRef(null);

  const prev = () => onIndexChange?.((safeIndex - 1 + total) % total);
  const next = () => onIndexChange?.((safeIndex + 1) % total);

  // Preload vecinos
  const preload = useMemo(() => {
    const arr = [];
    if (total > 1) {
      const prevIdx = (safeIndex - 1 + total) % total;
      const nextIdx = (safeIndex + 1) % total;
      images[prevIdx]?.src && arr.push(images[prevIdx].src);
      images[nextIdx]?.src && arr.push(images[nextIdx].src);
    }
    return arr;
  }, [images, safeIndex, total]);

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
  }, [prev, next, onClose]);

  const fileName = current?.meta?.fileName || current?.alt || current?.caption || "";
  const time = current?.meta?.time || "";
  const hotspot = current?.meta?.hotspot || "";

  const arrowCls =
    "h-12 w-12 rounded-full bg-white/15 hover:bg-white/25 text-white text-2xl leading-none grid place-items-center border border-white/20";
  const arrowClsBlue =
    "h-12 w-12 rounded-full bg-blue-600/80 hover:bg-blue-600 text-white text-2xl leading-none grid place-items-center shadow-lg";

  return (
    <div className="fixed inset-0 z-[1000]" aria-modal="true" role="dialog" ref={containerRef}>
      {/* Fondo – click cierra */}
      <div className="absolute inset-0 bg-black/90" onClick={onClose} />

      {/* Header (si se usa modo header) */}
      {captionPosition === "header" && (
        <div
          className="absolute top-0 left-0 right-0 p-3 flex items-center gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ml-1 text-xs sm:text-sm text-slate-300">
            {total > 0 ? `${safeIndex + 1} / ${total}` : "0 / 0"}
            {current?.caption ? <span className="hidden sm:inline"> · {current.caption}</span> : null}
          </div>
          {showHeaderClose && (
            <button
              className="ml-auto h-9 px-3 rounded-lg bg-white/10 text-white border border-white/15"
              onClick={onClose}
              title="Cerrar (Esc)"
            >
              Cerrar
            </button>
          )}
        </div>
      )}

      {/* Contenedor central – click cierra (fuera de la imagen) */}
      <div
        className={`absolute inset-0 flex items-center justify-center px-3 ${
          captionPosition === "bottom-centered" ? "pt-10" : "pt-10"
        }`}
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
          <div className="absolute inset-y-0 left-0 w-16 grid place-items-center" onClick={(e) => e.stopPropagation()}>
            <button className={arrowBlue ? arrowClsBlue : arrowCls} onClick={prev} title="Anterior (←)">
              ‹
            </button>
          </div>
          <div className="absolute inset-y-0 right-0 w-16 grid place-items-center" onClick={(e) => e.stopPropagation()}>
            <button className={arrowBlue ? arrowClsBlue : arrowCls} onClick={next} title="Siguiente (→)">
              ›
            </button>
          </div>
        </>
      )}

      {/* Caption abajo centrada (si se usa) */}
      {captionPosition === "bottom-centered" && (
        <div
          className="absolute left-0 right-0 px-4"
          style={{ bottom: (showThumbnails ? 88 : 16) + footerSafeArea }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto max-w-5xl">
            <div className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex items-center justify-center gap-2 whitespace-nowrap text-[12px] text-slate-100">
                <span className="px-2 py-0.5 rounded bg-white/10 border border-white/15">
                  {safeIndex + 1} / {total}
                </span>
                <span className="text-slate-300">·</span>
                <span className="font-mono text-sm font-semibold select-text" title={fileName}>
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

      {/* Thumbnails (carrusel) – desplazadas hacia arriba para no tapar HUD */}
      {showThumbnails && total > 1 && (
        <div
          className="absolute left-0 right-0 p-2 bg-black/40"
          style={{ bottom: 8 + footerSafeArea }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto max-w-5xl flex gap-2 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {images.map((im, i) => (
              <button
                key={i}
                className={`w-16 h-16 rounded overflow-hidden border transition-transform ${
                  i === safeIndex
                    ? "border-yellow-300 ring-2 ring-yellow-300 ring-offset-2 ring-offset-black/30 scale-105"
                    : "border-white/10 hover:border-white/40"
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
