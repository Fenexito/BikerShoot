import React, { useRef, useState } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeGrid as Grid } from "react-window";
import { useCart } from "../../../state/CartContext.jsx";

/* Utils de formato (tolerantes a timestamp nulo/invalid) */
const fmtDate = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString("es-GT", { year: "numeric", month: "short", day: "2-digit" });
};
const fmtTime = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? "--:--" : d.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" });
};

export default function SearchResults({
  vista,
  setVista,
  paginatedPhotos,
  totalPhotos,
  paginatedClusters,
  totalClusters,
  onLoadMore,
  hasMorePhotos,
  hasMoreClusters,
  onToggleSel,
  selected,
  thumbAspect = "3:4",
  resolvePhotographerName,
  resolveHotspotName,
  totalQ,
  clearSel,
}) {
  const [lightbox, setLightbox] = useState({ open: false, items: [], index: 0 });
  const openLightboxFromList = (items, idx) => setLightbox({ open: true, items, index: idx });
  const closeLightbox = () => setLightbox({ open: false, items: [], index: 0 });
  const goPrev = () => setLightbox((lb) => ({ ...lb, index: (lb.index - 1 + lb.items.length) % lb.items.length }));
  const goNext = () => setLightbox((lb) => ({ ...lb, index: (lb.index + 1) % lb.items.length }));

  return (
    <section>
      {/* Tabs + conteo */}
      <div className="mb-3 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Tab active={vista === "momentos"} onClick={() => setVista("momentos")}>Momentos</Tab>
          <Tab active={vista === "mosaico"} onClick={() => setVista("mosaico")}>Mosaico</Tab>
        </div>
        <div className="text-slate-500">
          {vista === "momentos"
            ? `${paginatedClusters.length} / ${totalClusters} momentos`
            : `${paginatedPhotos.length} / ${totalPhotos} fotos`}
        </div>
      </div>

      {vista === "momentos" ? (
        <MomentosGrid
          data={paginatedClusters}
          hasMore={hasMoreClusters}
          loadMore={onLoadMore}
          onToggleSel={onToggleSel}
          selected={selected}
          onOpenLightbox={(cluster, idx) => openLightboxFromList(cluster.fotos, idx)}
          resolveHotspotName={resolveHotspotName}
        />
      ) : (
        <MosaicoVirtualized
          data={paginatedPhotos}
          loadMore={onLoadMore}
          hasMore={hasMorePhotos}
          onToggleSel={onToggleSel}
          selected={selected}
          onOpenLightbox={(idx) => openLightboxFromList(paginatedPhotos, idx)}
          thumbAspect={thumbAspect}
        />
      )}

      {lightbox.open && (
        <PhotoLightbox
          item={lightbox.items[lightbox.index]}
          onClose={closeLightbox}
          onPrev={goPrev}
          onNext={goNext}
          onToggleSel={() => onToggleSel(lightbox.items[lightbox.index].id)}
          selected={selected.has(lightbox.items[lightbox.index].id)}
          resolvePhotographerName={resolvePhotographerName}
          resolveHotspotName={resolveHotspotName}
        />
      )}

      {typeof totalQ === "number" && selected.size > 0 && (
        <div className="sticky bottom-3 z-40 mt-3">
          <div className="max-w-[700px] mx-auto rounded-2xl bg-white border shadow-card px-4 py-2.5 flex items-center justify-between text-sm">
            <div>
              <span className="font-semibold">{selected.size}</span> foto{selected.size === 1 ? "" : "s"} seleccionada{selected.size === 1 ? "" : "s"}
              <span className="mx-2 text-slate-400">•</span>
              Total estimado: <span className="font-display font-bold">Q{Math.round(totalQ)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="h-9 px-3 rounded-xl border bg-white font-display font-bold" onClick={clearSel}>Limpiar</button>
              <a href="/app/checkout" className="h-9 px-3 rounded-xl bg-blue-600 text-white font-display font-bold grid place-items-center">
                Ir al carrito
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ========== Subcomponentes ========== */

function Tab({ active, onClick, children }) {
  return (
    <button
      className={
        "h-9 px-3 rounded-xl font-display font-bold text-sm " +
        (active ? "bg-blue-600 text-white" : "bg-white border")
      }
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">
      No encontramos nada con esos filtros. Probá activar “Ignorar fecha/hora” o elegir otros puntos.
    </div>
  );
}

/* -------- Momentos (placeholder, por ahora no lo usamos) -------- */
function MomentosGrid() {
  return <EmptyState />;
}

/* -------- Mosaico virtualizado -------- */
function MosaicoVirtualized({ data, loadMore, hasMore, onToggleSel, selected, onOpenLightbox, thumbAspect }) {
  if (data.length === 0) return <EmptyState />;

  const lastRowSeen = useRef(-1);
  const [orientMap, setOrientMap] = useState({}); // portrait/landscape
  const aspect = thumbAspect === "square" ? "1:1" : thumbAspect;

  return (
    <div className="h-[78vh] md:h-[80vh] lg:h-[82vh] xl:h-[85vh] rounded-2xl border bg-white">
      <AutoSizer>
        {({ width, height }) => {
          const GAP = 8;
          const desiredCols = 5;
          const isDesktop = width >= 1024;
          const baseCell = aspect === "1:1" ? 260 : 240;
          const cols = isDesktop ? desiredCols : Math.max(1, Math.floor((width - GAP) / (baseCell + GAP)));

          const cellW = Math.floor((width - GAP * (cols + 1)) / cols);
          const ratio = aspect === "1:1" ? 1 : 4 / 3;
          const cellH = Math.round(cellW * ratio);

          const columnWidth = cellW + GAP;
          const rowHeight = cellH + GAP;
          const rowCount = Math.ceil(data.length / cols);

          return (
            <Grid
              columnCount={cols}
              columnWidth={columnWidth}
              height={height}
              rowCount={rowCount}
              rowHeight={rowHeight}
              width={width}
              style={{ overflowX: "hidden" }}
              onItemsRendered={({ visibleRowStopIndex }) => {
                if (visibleRowStopIndex !== lastRowSeen.current) {
                  lastRowSeen.current = visibleRowStopIndex;
                  if (hasMore && visibleRowStopIndex >= rowCount - 1) {
                    loadMore();
                  }
                }
              }}
            >
              {({ columnIndex, rowIndex, style }) => {
                const idx = rowIndex * cols + columnIndex;
                if (idx >= data.length) return <div style={style} />;
                const x = data[idx];

                const isLandscape = orientMap[x.id] === "landscape";
                const fitClass =
                  aspect === "3:4" && isLandscape ? "object-contain bg-slate-100" : "object-cover";

                return (
                  <div style={style}>
                    <div
                      className="relative"
                      style={{ paddingLeft: 8, paddingTop: 8, width: columnWidth, height: rowHeight }}
                    >
                      <div className="relative">
                        <img
                          src={x.url}
                          alt=""
                          className={`w-full rounded-lg border cursor-zoom-in ${fitClass}`}
                          style={{ height: cellH }}
                          loading="lazy"
                          onClick={() => onOpenLightbox(idx)}
                          onLoad={(e) => {
                            const iw = e.currentTarget.naturalWidth || 1;
                            const ih = e.currentTarget.naturalHeight || 1;
                            const ori = iw >= ih ? "landscape" : "portrait";
                            setOrientMap((m) => (m[x.id] === ori ? m : { ...m, [x.id]: ori }));
                          }}
                        />
                        <input
                          type="checkbox"
                          className="absolute top-2 left-2 w-5 h-5"
                          checked={selected.has(x.id)}
                          onChange={() => onToggleSel(x.id)}
                        />
                        <div className="absolute bottom-2 right-2 text-[11px] px-2 py-0.5 rounded-full bg-white/90 border">
                          {fmtTime(x.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }}
            </Grid>
          );
        }}
      </AutoSizer>
    </div>
  );
}

/* -------- Lightbox -------- */
function PhotoLightbox({ item, onClose, onPrev, onNext, onToggleSel, selected, resolvePhotographerName, resolveHotspotName }) {
  const { addItem, setOpen } = useCart();

  const precio = 50; // placeholder
  const phName = resolvePhotographerName?.(item?.photographerId) || "Fotógrafo";
  const hotName = resolveHotspotName?.(item?.hotspotId) || "Punto";
  const name = `Foto • ${phName} • ${fmtDate(item?.timestamp)} ${fmtTime(item?.timestamp)}`;

  const agregarCarrito = () => {
    if (!item) return;
    addItem?.({ id: item.id, name, price: precio, img: item.url, qty: 1 });
    setOpen?.(true);
  };

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-5xl bg-white rounded-2xl overflow-hidden">
          <div className="p-3 border-b flex items-center justify-between">
            <div className="text-sm text-slate-600">
              {fmtDate(item.timestamp)} · {fmtTime(item.timestamp)} · {hotName}
            </div>
            <button className="h-9 px-3 rounded-lg border font-display font-bold" onClick={onClose}>
              Cerrar
            </button>
          </div>
          <div className="relative bg-black">
            <img
              src={item.url}
              alt=""
              className="max-h-[70vh] w-full object-contain bg-black"
            />
            <button
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 grid place-items-center"
              onClick={onPrev}
              aria-label="Anterior"
            >
              ‹
            </button>
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 grid place-items-center"
              onClick={onNext}
              aria-label="Siguiente"
            >
              ›
            </button>
          </div>
          <div className="p-4 border-t flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              Fotógrafo: <span className="font-medium">{phName}</span>
              <span className="mx-2 text-slate-400">•</span>
              <span className="font-display font-bold">Q{precio}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                className={
                  "h-9 px-3 rounded-xl border bg-white font-display font-bold " +
                  (selected ? "ring-2 ring-blue-600" : "")
                }
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
    </div>
  );
}
