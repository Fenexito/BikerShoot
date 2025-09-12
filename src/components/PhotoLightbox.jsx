import React, { useEffect } from "react";

/**
 * Lightbox minimalista:
 * - La imagen NUNCA queda debajo de la barra superior (caption) ni del carrusel.
 * - Usa zonas seguras: topSafeArea y bottomSafeArea (px) para reservar espacio.
 * - Thumbnails arriba, foto centrada, sin recortes (object-contain).
 */
export default function PhotoLightbox({
  images = [],
  index = 0,
  onIndexChange,
  onClose,
  showThumbnails = true,
  captionPosition = "header",
  topSafeArea = 56,
  bottomSafeArea = 140,
  showHeaderClose = false,
  arrowBlue = false,
}) {
  const cur = images[index] || {};

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "ArrowRight") onIndexChange?.(Math.min(images.length - 1, index + 1));
      if (e.key === "ArrowLeft") onIndexChange?.(Math.max(0, index - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length, onClose, onIndexChange]);

  const prev = () => onIndexChange?.(Math.max(0, index - 1));
  const next = () => onIndexChange?.(Math.min(images.length - 1, index + 1));

  return (
    <div className="fixed inset-0 z-[1000] bg-black/95 text-white">
      {/* Header con caption (no tapa la imagen porque reservamos topSafeArea) */}
      {captionPosition === "header" && (
        <div
          className="absolute top-0 left-0 right-0 h-14 px-4 flex items-center justify-between border-b border-white/10 bg-black/40 backdrop-blur-sm"
          style={{ height: `${topSafeArea}px` }}
        >
          <div className="truncate pr-3 text-sm opacity-90">{cur.caption || ""}</div>
          {showHeaderClose && (
            <button onClick={onClose} className="h-9 px-3 rounded-lg bg-white/10 hover:bg-white/20">
              Cerrar
            </button>
          )}
        </div>
      )}

      {/* Zona de imagen: respeta zonas seguras superior e inferior */}
      <div
        className="absolute left-0 right-0 top-0 bottom-0 grid place-items-center px-3"
        style={{ paddingTop: `${topSafeArea + 8}px`, paddingBottom: `${bottomSafeArea + 8}px` }}
      >
        <img
          src={cur.src}
          alt={cur.alt || ""}
          className="max-w-[min(96vw,1400px)] max-h-[calc(100vh-200px)] object-contain"
          style={{
            maxHeight: `calc(100vh - ${topSafeArea + bottomSafeArea + 40}px)`,
          }}
        />
      </div>

      {/* Flechas */}
      <button
        className={`absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full grid place-items-center border border-white/30 bg-white/10 hover:bg-white/20 ${arrowBlue ? "text-sky-300" : ""}`}
        onClick={prev}
        disabled={index === 0}
        title="Anterior"
      >
        ‹
      </button>
      <button
        className={`absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full grid place-items-center border border-white/30 bg-white/10 hover:bg-white/20 ${arrowBlue ? "text-sky-300" : ""}`}
        onClick={next}
        disabled={index >= images.length - 1}
        title="Siguiente"
      >
        ›
      </button>

      {/* Thumbnails arriba */}
      {showThumbnails && images.length > 1 && (
        <div className="absolute left-0 right-0 top-0" style={{ top: `${topSafeArea}px` }}>
          <div className="px-3 py-2 overflow-x-auto">
            <div className="flex gap-2">
              {images.map((im, i) => (
                <button
                  key={i}
                  className={`relative h-16 w-16 rounded-lg overflow-hidden border transition-all ${i === index ? "ring-4 ring-blue-500 border-transparent" : "border-white/20 hover:border-white/40"}`}
                  onClick={() => onIndexChange?.(i)}
                  title={`Ir a ${i + 1}`}
                >
                  <img src={im.src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
