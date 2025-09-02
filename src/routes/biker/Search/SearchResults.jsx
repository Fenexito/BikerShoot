import React, { useRef, useState } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeGrid as Grid } from "react-window";
import { getPhotographerById } from "../../../data/photographers.js";
import { hotspotById } from "../../../data/hotspots.js";
import { useCart } from "../../../state/CartContext.jsx";

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("es-GT", { year: "numeric", month: "short", day: "2-digit" });
const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" });

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
  thumbAspect = "3:4", // "1:1" | "3:4"
}) {
  // Lightbox
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
          {vista === "momentos" ? `${paginatedClusters.length} / ${totalClusters} momentos` : `${paginatedPhotos.length} / ${totalPhotos} fotos`}
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
        />
      )}
    </section>
  );
}

/* ================== Subcomponentes de Resultados ================== */

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
      No encontramos nada con esos filtros. Probá ampliar la hora,
      bajar la confianza de IA, o elegir otros puntos de foto.
    </div>
  );
}

/* ---------------- Momentos (clusters) ---------------- */
function MomentosGrid({ data, hasMore, loadMore, onToggleSel, selected, onOpenLightbox }) {
  const sentinelRef = useRef(null);

  React.useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  if (data.length === 0) return <EmptyState />;

  const [open, setOpen] = useState(null);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.map((m) => (
          <article key={m.id} className="rounded-2xl border bg-white shadow-card overflow-hidden">
            <div className="aspect-[16/9] overflow-hidden">
              <img
                src={m.cover}
                alt=""
                className="w-full h-full object-cover cursor-zoom-in"
                loading="lazy"
                onClick={() => {
                  const idx = m.fotos.findIndex((f) => f.url === m.cover);
                  onOpenLightbox(m, Math.max(0, idx));
                }}
              />
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between gap-2 text-[12px]">
                <div className="text-slate-500">
                  {fmtTime(m.time)} · {hotspotById(m.hotspotId)?.name || "Punto"}
                </div>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 border">Conf. {m.confAvg}%</span>
              </div>

              <div className="mt-2 flex -space-x-2">
                {m.fotos.slice(0, 3).map((x, i) => (
                  <img
                    key={x.id}
                    src={x.url}
                    alt=""
                    className="w-12 h-12 rounded-lg border object-cover cursor-pointer"
                    onClick={() => onOpenLightbox(m, i)}
                  />
                ))}
                {m.count > 3 && (
                  <div
                    className="w-12 h-12 rounded-lg border bg-slate-50 grid place-items-center text-sm text-slate-500 cursor-pointer"
                    onClick={() => setOpen(m.id)}
                  >
                    +{m.count - 3}
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between text-[13px]">
                <div className="text-slate-500">
                  Desde <span className="font-display font-bold">Q{m.priceFrom || 50}</span>
                </div>
                <button
                  className="h-9 px-3 rounded-xl bg-blue-600 text-white font-display font-bold"
                  onClick={() => setOpen(m.id)}
                >
                  Ver {m.count} fotos
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div ref={sentinelRef} className="h-10" />

      {open && (
        <ClusterModal
          cluster={data.find((c) => c.id === open)}
          onClose={() => setOpen(null)}
          onToggleSel={onToggleSel}
          selected={selected}
          onOpenLightbox={(items, idx) => onOpenLightbox({ fotos: items }, idx)}
        />
      )}
    </>
  );
}

function ClusterModal({ cluster, onClose, onToggleSel, selected, onOpenLightbox }) {
  if (!cluster) return null;
  const fotos = cluster.fotos;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 md:inset-0 md:mx-auto md:my-10 max-w-5xl bg-white rounded-t-2xl md:rounded-2xl overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="text-sm text-slate-600">
            {fmtDate(cluster.time)} · {fmtTime(cluster.time)} · {hotspotById(cluster.hotspotId)?.name}
          </div>
          <button className="h-9 px-3 rounded-lg border font-display font-bold" onClick={onClose}>Cerrar</button>
        </div>

        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[65vh] overflow-auto">
          {fotos.map((x, i) => (
            <div key={x.id} className="relative group">
              <img
                src={x.url}
                alt=""
                className="w-full h-40 object-cover rounded-lg border cursor-zoom-in"
                loading="lazy"
                onClick={() => onOpenLightbox(fotos, i)}
              />
              <input
                type="checkbox"
                className="absolute top-2 left-2 w-5 h-5"
                checked={selected.has(x.id)}
                onChange={() => onToggleSel(x.id)}
              />
            </div>
          ))}
        </div>

        <div className="p-4 border-t flex items-center justify-end">
          <button className="h-9 px-3 rounded-xl bg-blue-600 text-white font-display font-bold" onClick={onClose}>
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Mosaico virtualizado – columnas dinámicas y alto en vh ---------------- */
function MosaicoVirtualized({ data, loadMore, hasMore, onToggleSel, selected, onOpenLightbox, thumbAspect }) {
  if (data.length === 0) return <EmptyState />;

  const lastRowSeen = useRef(-1);
  const [orientMap, setOrientMap] = useState({}); // portrait/landscape

  return (
    <div className="h-[78vh] md:h-[80vh] lg:h-[82vh] xl:h-[85vh] rounded-2xl border bg-white">
      <AutoSizer>
        {({ width, height }) => {
          const GAP = 8;

          // Calculamos columnas según ancho disponible y un ancho base deseado
          const desiredCols = 5;
          const isDesktop = width >= 1024; // forzar 6 por fila en desktop
          const baseCell = thumbAspect === "1:1" ? 260 : 240; // base más pequeño para móviles
          const cols = isDesktop ? desiredCols : Math.max(1, Math.floor((width - GAP) / (baseCell + GAP)));

          const cellW = Math.floor((width - GAP * (cols + 1)) / cols);
          const ratio = thumbAspect === "1:1" ? 1 : 4 / 3;
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
                  thumbAspect === "3:4" && isLandscape ? "object-contain bg-slate-100" : "object-cover";

                return (
                  <div style={style}>
                    <div
                      className="relative"
                      style={{ paddingLeft: GAP, paddingTop: GAP, width: columnWidth, height: rowHeight }}
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

/* ---------------- Lightbox (con Agregar al carrito) ---------------- */
function PhotoLightbox({ item, onClose, onPrev, onNext, onToggleSel, selected }) {
  const { addItem, setOpen } = useCart();
  const ph = getPhotographerById(item.photographerId);
  const hot = hotspotById(item.hotspotId);

  const precio = ph?.precios?.[0]?.precio || 50;
  const name = `Foto • ${ph?.estudio || "Fotógrafo"} • ${fmtDate(item.timestamp)} ${fmtTime(item.timestamp)}`;

  const agregarCarrito = () => {
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
              {fmtDate(item.timestamp)} · {fmtTime(item.timestamp)} · {hot?.name}
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
            {/* Prev/Next */}
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
              Fotógrafo: <span className="font-medium">{ph?.estudio || "—"}</span>
              <span className="mx-2 text-slate-400">•</span>
              Confianza IA: {Math.round((item.aiConfidence || 0) * 100)}%
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
