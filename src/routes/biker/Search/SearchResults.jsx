// src/routes/biker/Search/SearchResults.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import PhotoLightbox from "../../../components/PhotoLightbox.jsx";
import { useCart } from "../../../state/CartContext.jsx";

/* Utils */
const fmtDate = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString("es-GT", { year: "numeric", month: "short", day: "2-digit" });
};
const fmtTime = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? "--:--" : d.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" });
};

export default function SearchResults({
  paginatedPhotos,
  totalPhotos,
  onLoadMore,
  hasMorePhotos,
  onToggleSel,
  selected,
  resolvePhotographerName,
  resolveHotspotName,
  totalQ,
  clearSel,
  /* controlados por el padre */
  cols = 6,
  showLabels = false,
}) {
  // ---------- Lightbox ----------
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);
  const openLightbox = (idx) => { setLbIndex(idx); setLbOpen(true); };
  const closeLightbox = () => setLbOpen(false);

  const images = useMemo(() => {
    return (paginatedPhotos || []).map((p) => ({
      src: p.url,
      alt: "Foto",
      caption: `${fmtDate(p.timestamp)} ${fmtTime(p.timestamp)} · ${resolvePhotographerName?.(p.photographerId) || ""}`,
      meta: {
        fileName: p.id,
        time: `${fmtDate(p.timestamp)} ${fmtTime(p.timestamp)}`,
        hotspot: resolveHotspotName?.(p.hotspotId) || "",
      },
    }));
  }, [paginatedPhotos, resolvePhotographerName, resolveHotspotName]);

  // ---------- Infinite scroll (un solo scroll: el de la página) ----------
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        const ent = entries[0];
        if (ent.isIntersecting && hasMorePhotos) onLoadMore?.();
      },
      { root: null, rootMargin: "1200px 0px", threshold: 0.01 }
    );
    io.observe(sentinelRef.current);
    return () => io.disconnect();
  }, [hasMorePhotos, onLoadMore, paginatedPhotos?.length]);

  // ---------- Masonry: column-count controlado por "cols" ----------
  const columnCount = Math.max(4, Math.min(12, parseInt(cols, 10) || 6));
  const masonryStyle = useMemo(
    () => ({ columnCount, columnGap: "12px" }),
    [columnCount]
  );

  return (
    <section className="w-screen ml-[calc(50%-50vw)] px-3 sm:px-6">
      {/* Masonry container */}
      <div style={masonryStyle}>
        {(paginatedPhotos || []).map((item, idx) => {
          const isSel = selected?.has?.(item.id);
          const hsName = resolveHotspotName ? resolveHotspotName(item.hotspotId) : (item.hotspotId || "");

          return (
            <article
              key={item.id}
              className="mb-3 break-inside-avoid rounded-xl overflow-hidden bg-white border border-slate-200 relative group"
            >
              {/* Foto completa sin recorte (se adapta al ALTO real) */}
              <button
                type="button"
                className="w-full text-left bg-slate-100 cursor-zoom-in"
                onClick={() => openLightbox(idx)}
                title="Ver grande"
              >
                <img
                  src={item.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full h-auto block object-contain"
                  draggable={false}
                />
              </button>

              {/* Botón seleccionar */}
              <button
                type="button"
                className={
                  "absolute top-2 left-2 z-10 h-8 px-2 rounded-md text-xs shadow " +
                  (isSel
                    ? "bg-blue-600 text-white"
                    : "bg-white/90 text-slate-800 border border-slate-200")
                }
                onClick={(e) => { e.stopPropagation(); onToggleSel?.(item.id); }}
                title={isSel ? "Quitar de selección" : "Agregar a selección"}
              >
                {isSel ? "Seleccionada" : "Elegir"}
              </button>

              {showLabels && (
                <div className="p-2 text-[12px] leading-tight text-slate-700">
                  <div className="truncate">{fmtDate(item.timestamp)} {fmtTime(item.timestamp)}</div>
                  <div className="truncate opacity-70">{hsName}</div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Sentinel para cargar más */}
      <div ref={sentinelRef} className="h-10" />

      {/* Barra de selección */}
      {typeof totalQ === "number" && selected?.size > 0 && (
        <div className="sticky bottom-3 z-[1101] mt-3">
          <div className="max-w-[820px] mx-auto rounded-2xl bg-blue-600/95 text-white px-4 py-2.5 flex items-center justify-between text-sm shadow-2xl">
            <div className="truncate">
              <span className="font-semibold">{selected.size}</span> foto{selected.size === 1 ? "" : "s"} seleccionada{selected.size === 1 ? "" : "s"}
              <span className="mx-2 text-white/60">•</span>
              Total estimado: <span className="font-display font-bold">Q{Math.round(totalQ)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="h-9 px-3 rounded-xl bg-white text-blue-700 font-display font-bold" onClick={clearSel}>Limpiar</button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lbOpen && (
        <>
          <PhotoLightbox
            images={images}
            index={lbIndex}
            onIndexChange={setLbIndex}
            onClose={closeLightbox}
            showThumbnails
            captionPosition="header"
            footerSafeArea={72}
            showHeaderClose={false}
            arrowBlue
          />
          <LightboxHUD
            item={paginatedPhotos[lbIndex]}
            resolvePhotographerName={resolvePhotographerName}
            resolveHotspotName={resolveHotspotName}
            selected={selected?.has?.(paginatedPhotos[lbIndex]?.id)}
            onToggleSel={() => onToggleSel(paginatedPhotos[lbIndex]?.id)}
            onClose={closeLightbox}
          />
        </>
      )}
    </section>
  );
}

/* -------------------- HUD sobre el Lightbox -------------------- */
function LightboxHUD({ item, resolvePhotographerName, resolveHotspotName, selected, onToggleSel, onClose }) {
  const { addItem, setOpen } = useCart();
  if (!item) return null;

  const precio = 50;
  const phName = resolvePhotographerName?.(item.photographerId) || "Fotógrafo";
  const hotName = resolveHotspotName?.(item.hotspotId) || "Punto";
  const route = item.route || "";
  const name = `Foto • ${phName} • ${fmtDate(item.timestamp)} ${fmtTime(item.timestamp)}`;

  const agregarCarrito = () => {
    addItem?.({ id: item.id, name, price: precio, img: item.url, qty: 1 });
    setOpen?.(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className="fixed top-3 right-3 z-[1101] h-9 px-3 rounded-lg bg-red-600 text-white shadow-lg"
        title="Cerrar"
      >
        Cerrar
      </button>

      <div className="fixed left-0 right-0 bottom-0 z-[1101] px-3 pb-3 pointer-events-none">
        <div className="mx-auto max-w-5xl">
          <div className="pointer-events-auto rounded-2xl bg-black/60 backdrop-blur border border-white/15 text-white px-4 py-2.5 flex flex-wrap items-center gap-3">
            <div className="min-w-[220px] grow">
              <div className="text-[13px] leading-tight">
                <span className="font-semibold">{fmtDate(item.timestamp)} {fmtTime(item.timestamp)}</span>
                <span className="mx-2 text-white/60">•</span>
                <span className="">{phName}</span>
                <span className="mx-2 text-white/60">•</span>
                <span className="">{route || "—"}</span>
                <span className="mx-2 text-white/60">•</span>
                <span className="">{hotName}</span>
                <span className="mx-2 text-white/60">•</span>
                <span className="">Q{precio}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                className={"h-9 px-3 rounded-xl border bg-white text-black font-display font-bold " + (selected ? "ring-2 ring-blue-300" : "")}
                onClick={onToggleSel}
              >
                {selected ? "Quitar de selección" : "Agregar a selección"}
              </button>
              <button
                className="h-9 px-3 rounded-xl bg-blue-600 text-white font-display font-bold"
                onClick={agregarCarrito}
              >
                Agregar al carrito
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
