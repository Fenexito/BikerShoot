// src/routes/biker/Search/SearchResults.jsx
import React, { useRef, useState } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeGrid as Grid } from "react-window";
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
  thumbAspect,
  resolvePhotographerName,
  resolveHotspotName,
  totalQ,
  clearSel,
}) {
  const { addItems } = useCart?.() || { addItems: () => {} };
  const [hover, setHover] = useState(null);

  const PhotoCard = ({ ph }) => {
    const isSel = selected.has(ph.id);
    const title = `${fmtDate(ph.timestamp)} · ${fmtTime(ph.timestamp)}`;
    const photogName = resolvePhotographerName?.(ph.photographerId);
    const hotspotName = resolveHotspotName?.(ph.hotspotId);

    return (
      <div
        className={`relative rounded-lg overflow-hidden border ${isSel ? "border-blue-500" : "border-slate-200"} bg-white`}
        onMouseEnter={() => setHover(ph.id)}
        onMouseLeave={() => setHover(null)}
      >
        <img
          src={ph.url}
          alt={title}
          className={`w-full ${thumbAspect === "square" ? "aspect-square object-cover" : "aspect-[4/3] object-cover"}`}
          loading="lazy"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent text-white p-2 text-xs">
          <div className="flex items-center justify-between">
            <span title={title}>{fmtTime(ph.timestamp)} · {photogName}</span>
            <span className="opacity-80">{hotspotName}</span>
          </div>
        </div>

        <button
          className={`absolute top-2 right-2 h-7 px-2 rounded-md text-xs font-medium ${isSel ? "bg-red-600 text-white" : "bg-white/90 text-slate-800 hover:bg-white"}`}
          onClick={() => onToggleSel(ph.id)}
        >
          {isSel ? "Quitar" : "Elegir"}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Tabs vista */}
      <div className="flex items-center gap-2">
        <button
          className={`h-9 px-3 rounded-lg ${vista === "mosaico" ? "bg-slate-900 text-white" : "bg-slate-100"}`}
          onClick={() => setVista("mosaico")}
        >
          Mosaico ({totalPhotos})
        </button>
        <button
          className={`h-9 px-3 rounded-lg ${vista === "momentos" ? "bg-slate-900 text-white" : "bg-slate-100"}`}
          onClick={() => setVista("momentos")}
        >
          Momentos ({totalClusters})
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-slate-600">Seleccionadas: {selected.size}</span>
          <button className="h-9 px-3 rounded-lg bg-slate-100" onClick={clearSel}>Limpiar</button>
          <button
            className="h-9 px-3 rounded-lg bg-blue-600 text-white"
            onClick={() => {
              const ids = Array.from(selected);
              const items = paginatedPhotos.filter((p) => ids.includes(p.id)).map((p) => ({
                id: p.id,
                url: p.url,
                phId: p.photographerId,
                when: p.timestamp,
              }));
              addItems(items);
            }}
          >
            Agregar al carrito (Q{totalQ})
          </button>
        </div>
      </div>

      {/* Contenido */}
      {vista === "mosaico" ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {paginatedPhotos.map((ph) => (
              <PhotoCard key={ph.id} ph={ph} />
            ))}
          </div>
          {hasMorePhotos && (
            <div className="flex justify-center">
              <button className="h-9 px-4 rounded-lg bg-slate-100" onClick={onLoadMore}>
                Cargar más
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="space-y-4">
            {paginatedClusters.map((c) => (
              <div key={c.key} className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 text-sm text-slate-600">
                  {c.fecha} · {c.hora} — {c.items.length} fotos
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-3">
                  {c.items.map((ph) => (
                    <PhotoCard key={ph.id} ph={ph} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {hasMoreClusters && (
            <div className="flex justify-center">
              <button className="h-9 px-4 rounded-lg bg-slate-100" onClick={onLoadMore}>
                Cargar más
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
