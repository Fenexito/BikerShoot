// src/components/PhotoLightbox.jsx
import React, { useEffect, useMemo, useRef, useCallback } from "react";

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

  // ====== CONSTS ======
  const EXTRA_PUSH_UP = 72; // empuja imagen/carrusel hacia arriba (HUD intacto)
  const THUMB_SIZE = 72;    // miniaturas tamaño fijo
  const THUMB_GAP  = 8;

  // ====== BODY SCROLL LOCK ======
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev || ""; };
  }, []);

  // ====== KEYBOARD NAV ======
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

  // ====== PRELOAD VECINOS ======
  const preload = useMemo(() => {
    const a = images[(index - 1 + total) % total]?.src;
    const b = images[(index + 1) % total]?.src;
    return [a, b].filter(Boolean);
  }, [index, total, images]);

  const arrowCls = arrowBlue
    ? "w-10 h-10 rounded-full bg-blue-600/90 hover:bg-blue-600 text-white border border-blue-500/60"
    : "w-10 h-10 rounded-full bg-white/10 text-white border border-white/15";

  // ====== PADDING (NO TOCA TU HUD) ======
  const captionPad = captionPosition === "bottom-centered" ? 80 : 24;
  const bottomPad  = (safeBottom || 0) + captionPad + EXTRA_PUSH_UP;
  const topPad     = 12;

  // ====== CAPTION CHIP DATA (NO ES HUD) ======
  const fileName = current?.meta?.fileName || current?.alt || "";
  const time = current?.meta?.time || "";
  const hotspot = current?.meta?.hotspot || "";

  // ====== CARRUSEL: rail (scroll) + lista (flex) ======
  const railRef = useRef(null);  // contenedor con overflow-x
  const listRef = useRef(null);  // div.flex con los botones

  // Centrar SIEMPRE la miniatura seleccionada
  const centerThumb = useCallback((i, behavior = "smooth") => {
    const rail = railRef.current;
    const list = listRef.current;
    if (!rail || !list) return;

    const item = list.children?.[i];
    if (!item) return;

    // Posición del item relativo a la lista (no al viewport)
    const itemLeft  = item.offsetLeft;
    const itemWidth = item.offsetWidth;
    // Centro deseado del contenedor visible
    const railVisibleCenter = rail.clientWidth / 2;
    // Scroll objetivo para que el centro del item quede en el centro del rail
    let target = itemLeft - (railVisibleCenter - itemWidth / 2);

    // Limitar el scroll (0 .. maxScroll)
    const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
    if (target < 0) target = 0;
    if (target > maxScroll) target = maxScroll;

    rail.scrollTo({ left: Math.round(target), behavior });
  }, []);

  // Al abrir: centrar sin animación (para evitar “brinco”)
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!showThumbnails || total === 0) return;
    if (!didMountRef.current) {
      didMountRef.current = true;
      centerThumb(index, "instant"); // primer centrado “duro”
    } else {
      centerThumb(index, "smooth");  // siguientes cambios con animación
    }
  }, [index, total, showThumbnails, centerThumb]);

  // Re-centrar si cambia el tamaño de la ventana
  useEffect(() => {
    if (!showThumbnails || total === 0) return;
    const onResize = () => centerThumb(index, "instant");
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [index, total, showThumbnails, centerThumb]);

  return (
    <div className="fixed inset-0 z-[1000]" aria-modal="true" role="dialog">
      {/* Fondo */}
      <div className="absolute inset-0 bg-black/90" onClick={onClose} />

      {/* SOLO botón cerrar arriba-derecha */}
      <button
        className="fixed top-3 right-3 z-[2100] h-9 px-3 rounded-lg bg-white/10 text-white border border-white/15"
        onClick={onClose}
        title="Cerrar (Esc)"
      >
        Cerrar
      </button>

      {/* Imagen centrada (respeta topPad y bottomPad, HUD no tapa) */}
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

      {/* Flechas */}
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

      {/* Carrusel full-width – miniatura ACTIVA siempre centrada */}
      {showThumbnails && total > 1 && (
        <div
          className="absolute left-0 right-0 z-[3000]"
          style={{ bottom: (safeBottom || 0) + EXTRA_PUSH_UP + 8 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            ref={railRef}
            className="w-screen overflow-x-auto overflow-y-hidden"
            style={{
              WebkitOverflowScrolling: "touch",
              padding: 8,
              scrollSnapType: "x mandatory", // scroll-snap para alinear al centro al soltar
            }}
          >
            <div
              ref={listRef}
              className="flex flex-nowrap items-center"
              style={{ gap: THUMB_GAP, paddingLeft: 8, paddingRight: 8 }}
            >
              {images.map((im, i) => (
                <button
                  key={i}
                  className={`flex-none rounded overflow-hidden border-4 ${
                    i === index ? "border-blue-500 ring-4 ring-blue-500" : "border-white/10"
                  }`}
                  style={{
                    width: THUMB_SIZE,
                    height: THUMB_SIZE,
                    minWidth: THUMB_SIZE,
                    minHeight: THUMB_SIZE,
                    scrollSnapAlign: "center", // cada thumb “pide” quedar centrada
                    scrollSnapStop: "always",
                  }}
                  onClick={() => onIndexChange?.(i)}
                  title={im.alt || im.caption || `Foto ${i + 1}`}
                >
                  <img
                    src={im.src}
                    alt=""
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </button>
              ))}
            </div>
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
