import React, { useMemo, useRef, useState } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeGrid as Grid } from "react-window";
import PhotoLightbox from "./PhotoLightbox.jsx";
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
  paginatedClusters, // ignorado (quitamos 'Momentos')
  totalClusters,     // ignorado
  onLoadMore,
  hasMorePhotos,
  hasMoreClusters,   // ignorado
  onToggleSel,
  selected,
  thumbAspect = "3:4",
  resolvePhotographerName,
  resolveHotspotName,
  totalQ,
  clearSel,
}) {
  // ---------- Controles de visual ----------
  const [zoom, setZoom] = useState(240); // ancho base deseado de celda (px)
  const [aspectMode, setAspectMode] = useState("auto"); // 'auto' | '16:9' | '4:3' | '1:1' | '9:16'
  const [showLabels, setShowLabels] = useState(false);

  // ---------- Lightbox ----------
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);

  const openLightbox = (idx) => { setLbIndex(idx); setLbOpen(true); };
  const closeLightbox = () => setLbOpen(false);

  // Estadísticas de orientación (para 'auto')
  const orientStats = useMemo(() => {
    let portrait = 0, landscape = 0;
    for (const p of paginatedPhotos || []) {
      try {
        const u = String(p.url);
        if (/\b9x16\b|portrait|_v\./i.test(u)) portrait++;
        else if (/\b16x9\b|landscape|_h\./i.test(u)) landscape++;
        else landscape++;
      } catch { landscape++; }
    }
    const total = portrait + landscape || 1;
    return { portrait, landscape, pPct: portrait/total, lPct: landscape/total };
  }, [paginatedPhotos]);

  // Aspecto efectivo
  const effAspect = useMemo(() => {
    if (aspectMode !== "auto") return aspectMode;
    if (orientStats.lPct >= 0.8) return "16:9";
    if (orientStats.pPct >= 0.8) return "9:16";
    return "4:3";
  }, [aspectMode, orientStats]);

  // Datos para lightbox
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

  return (
    // Full-bleed: rompe el contenedor y usa todo el ancho de la pantalla
    <section className="w-screen ml-[calc(50%-50vw)]">
      {/* Toolbar de visual */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm px-2 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Vista:</span>
          <button
            type="button"
            onClick={() => setVista?.("mosaico")}
            className={"h-8 px-3 rounded-md border bg-white text-slate-700 border-slate-300"}
          >
            Mosaico
          </button>
          {/* quitamos 'Momentos' */}
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="text-slate-500">Zoom</span>
            <input
              type="range"
              min={140}
              max={360}
              step={10}
              value={zoom}
              onChange={(e) => setZoom(parseInt(e.target.value, 10))}
            />
          </label>

          <label className="flex items-center gap-2">
            <span className="text-slate-500">Aspecto</span>
            <select
              className="h-8 border rounded-md px-2 bg-white"
              value={aspectMode}
              onChange={(e) => setAspectMode(e.target.value)}
            >
              <option value="auto">Auto</option>
              <option value="16:9">16:9</option>
              <option value="4:3">4:3</option>
              <option value="1:1">1:1</option>
              <option value="9:16">9:16</option>
            </select>
          </label>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showLabels} onChange={(e)=>setShowLabels(e.target.checked)} />
            <span className="text-slate-500">Mostrar info debajo</span>
          </label>

          <div className="text-slate-500 hidden sm:block">
            {`${paginatedPhotos?.length || 0} / ${totalPhotos} fotos`}
          </div>
        </div>
      </div>

      <div className="px-2 sm:px-4">
        <MosaicoVirtualized
          data={paginatedPhotos || []}
          loadMore={onLoadMore}
          hasMore={!!hasMorePhotos}
          onToggleSel={onToggleSel}
          selected={selected}
          onOpenLightbox={openLightbox}
          aspect={effAspect}
          zoom={zoom}
          showLabels={showLabels}
          resolvePhotographerName={resolvePhotographerName}
          resolveHotspotName={resolveHotspotName}
        />
      </div>

      {/* Barra de selección */}
      {typeof totalQ === "number" && selected?.size > 0 && (
        <div className="sticky bottom-3 z-40 mt-3">
          <div className="max-w-[740px] mx-auto rounded-2xl bg-white/85 backdrop-blur border border-slate-200 px-4 py-2.5 flex items-center justify-between text-sm shadow-lg">
            <div className="truncate">
              <span className="font-semibold">{selected.size}</span> foto{selected.size === 1 ? "" : "s"} seleccionada{selected.size === 1 ? "" : "s"}
              <span className="mx-2 text-slate-400">•</span>
              Total estimado: <span className="font-display font-bold">Q{Math.round(totalQ)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="h-9 px-3 rounded-xl border bg-white font-display font-bold" onClick={clearSel}>Limpiar</button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox full-screen */}
      {lbOpen && (
        <>
          <PhotoLightbox
            images={images}
            index={lbIndex}
            onIndexChange={setLbIndex}
            onClose={closeLightbox}
            showThumbnails
            captionPosition="bottom-centered"
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

/* -------------------- Grilla virtualizada -------------------- */
function MosaicoVirtualized({ data, loadMore, hasMore, onToggleSel, selected, onOpenLightbox, aspect, zoom, showLabels, resolvePhotographerName, resolveHotspotName }) {
  const lastRowSeen = useRef(-1);

  return (
    <div className="h-[78vh] md:h-[80vh] lg:h-[82vh] xl:h-[86vh] rounded-2xl border bg-white">
      <AutoSizer>
        {({ width, height }) => {
          const GAP = 8;
          const baseCell = zoom; // controlado por slider
          const cols = Math.max(1, Math.floor((width - GAP) / (baseCell + GAP)));

          const cellW = Math.floor((width - GAP * (cols + 1)) / cols);

          const ratio = aspect === "1:1" ? 1
            : aspect === "4:3" ? 3/4
            : aspect === "16:9" ? 9/16
            : aspect === "9:16" ? 16/9
            : 3/4; // default 4:3

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
                    loadMore?.();
                  }
                }
              }}
            >
              {({ columnIndex, rowIndex, style }) => {
                const idx = rowIndex * cols + columnIndex;
                const item = data[idx];
                if (!item) return <div style={style} />;
                const isSel = selected?.has?.(item.id);
                const phName = resolvePhotographerName ? resolvePhotographerName(item.photographerId) : (item.photographerId || "");
                const hsName = resolveHotspotName ? resolveHotspotName(item.hotspotId) : (item.hotspotId || "");

                return (
                  <div style={style} className="p-2">
                    <div
                      className={"group relative rounded-xl overflow-hidden bg-slate-100 border border-slate-200 " + (isSel ? "ring-2 ring-blue-600" : "")}
                    >
                      <button
                        type="button"
                        className="absolute z-10 top-2 left-2 h-7 px-2 rounded-md bg-white/90 text-xs border border-slate-200 shadow-sm"
                        onClick={(e) => { e.stopPropagation(); onToggleSel?.(item.id); }}
                        title={isSel ? "Quitar de selección" : "Agregar a selección"}
                      >
                        {isSel ? "Quitar" : "Elegir"}
                      </button>

                      <div
                        className="w-full bg-slate-200 cursor-zoom-in"
                        style={{ height: cellH }}
                        onClick={() => onOpenLightbox(idx)}
                        title="Ver grande"
                      >
                        <img
                          src={item.url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                          draggable={false}
                        />
                      </div>

                      {showLabels && (
                        <div className="p-2 text-[12px] leading-tight text-slate-700">
                          <div className="truncate">{fmtDate(item.timestamp)} {fmtTime(item.timestamp)}</div>
                          <div className="truncate opacity-70">{hsName}</div>
                        </div>
                      )}
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

/* -------------------- HUD sobre el Lightbox -------------------- */
function LightboxHUD({ item, resolvePhotographerName, resolveHotspotName, selected, onToggleSel, onClose }) {
  const { addItem, setOpen } = useCart();
  if (!item) return null;

  const precio = 50; // TODO: si hay precio real, mapear aquí
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
      {/* Cerrar rojo arriba derecha */}
      <button
        type="button"
        onClick={onClose}
        className="fixed top-3 right-3 z-[100] h-9 px-3 rounded-lg bg-red-600 text-white shadow-lg"
        title="Cerrar"
      >
        Cerrar
      </button>

      {/* Barra inferior con info + acciones */}
      <div className="fixed left-0 right-0 bottom-0 z-[100] px-3 pb-3 pointer-events-none">
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
                className={"h-9 px-3 rounded-xl border bg-white text-black font-display font-bold " + (selected ? "ring-2 ring-blue-400" : "")}
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
