// src/routes/biker/Search/SearchResults.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import PhotoLightbox from "../../../components/PhotoLightbox.jsx";
import { useCart } from "../../../state/CartContext.jsx";
import { supabase } from "../../../lib/supabaseClient";

/* -------------------- Utils -------------------- */
const fmtDate = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString("es-GT", { year: "numeric", month: "short", day: "2-digit" });
};
const fmtTime = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? "--:--" : d.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" });
};
const fileNameFromUrlOrId = (item) => {
  // intenta storage_path si viene embebido en id, si no, del url
  if (item?.id && typeof item.id === "string" && item.id.includes("/")) {
    const clean = item.id.split("?")[0];
    return decodeURIComponent(clean.split("/").pop() || item.id);
  }
  if (item?.url) {
    const u = String(item.url).split("?")[0];
    const last = u.split("/").pop() || "";
    return decodeURIComponent(last);
  }
  return String(item?.id || "");
};

/* Normaliza estructura de tiers desde JSON */
function normalizeTiers(preciosJson) {
  // Se espera arreglo de objetos. Soportamos varias llaves
  if (!preciosJson || !Array.isArray(preciosJson)) return [];
  const tiers = [];
  for (const raw of preciosJson) {
    if (!raw || typeof raw !== "object") continue;
    const n =
      Number(raw.n ?? raw.min ?? raw.qty ?? raw.desde ?? raw.cant ?? raw.cantidad ?? NaN);
    const p =
      Number(
        raw.precio ?? raw.price_q ?? raw.price ?? raw.valor ?? raw.value ?? NaN
      );
    if (!Number.isFinite(p)) continue;
    const minQty = Number.isFinite(n) ? Math.max(1, Math.floor(n)) : (tiers.length ? tiers[tiers.length - 1].min + 1 : 1);
    tiers.push({ min: minQty, price: p });
  }
  // ordena por min asc y compacta duplicados
  tiers.sort((a, b) => a.min - b.min);
  const compact = [];
  for (const t of tiers) {
    if (compact.length && compact[compact.length - 1].min === t.min) {
      compact[compact.length - 1] = t;
    } else {
      compact.push(t);
    }
  }
  return compact;
}

/* Devuelve el precio para una cantidad seleccionada q con la tabla dada */
function priceForQty(tiers, q) {
  if (!tiers || tiers.length === 0) return 50; // fallback
  const qty = Math.max(1, Number(q) || 1);
  // último tier cuyo min <= qty
  let best = tiers[0];
  for (const t of tiers) {
    if (t.min <= qty) best = t;
    else break;
  }
  return best.price;
}

/* -------------------- Componente -------------------- */
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
  /* controles que setea el padre (ya los tenés en la barra) */
  cols = 6,
  showLabels = false,
}) {
  // ---------- Precio por fotógrafo (cache local) ----------
  const [priceByPhotog, setPriceByPhotog] = useState(() => new Map()); // id -> [{min,price}, ...]
  const [loadingPrices, setLoadingPrices] = useState(false);

  // IDs únicos de fotógrafos visibles (paginatedPhotos nada más; suficiente para UI)
  const visiblePhotogIds = useMemo(() => {
    const s = new Set((paginatedPhotos || []).map(p => String(p.photographerId || "")).filter(Boolean));
    return Array.from(s);
  }, [paginatedPhotos]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!visiblePhotogIds.length) return;
      // evita re-fetch si ya tenemos todos
      const missing = visiblePhotogIds.filter(id => !priceByPhotog.has(String(id)));
      if (!missing.length) return;

      setLoadingPrices(true);
      try {
        const { data, error } = await supabase
          .from("photographer_profile")
          .select("user_id, precios")
          .in("user_id", missing);
        if (error) throw error;

        const next = new Map(priceByPhotog);
        for (const row of data || []) {
          const tiers = normalizeTiers(row?.precios);
          next.set(String(row.user_id), tiers);
        }
        // si alguno no trae lista, poné mapa vacío (fall back a 50)
        for (const id of missing) {
          if (!next.has(String(id))) next.set(String(id), []);
        }
        if (alive) setPriceByPhotog(next);
      } catch (e) {
        // si falla, marcá todos los missing con []
        const next = new Map(priceByPhotog);
        for (const id of missing) next.set(String(id), []);
        if (alive) setPriceByPhotog(next);
      } finally {
        if (alive) setLoadingPrices(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePhotogIds.join(",")]);

  // ---------- Conteo seleccionado POR FOTÓGRAFO ----------
  const selectedIds = selected && typeof selected.size === "number"
    ? Array.from(selected)
    : [];

  const photoById = useMemo(() => {
    const map = new Map();
    for (const p of (paginatedPhotos || [])) map.set(p.id, p);
    return map;
  }, [paginatedPhotos]);

  const selCountByPhotog = useMemo(() => {
    const counts = new Map();
    for (const id of selectedIds) {
      const p = photoById.get(id);
      const pid = p?.photographerId ? String(p.photographerId) : null;
      if (!pid) continue;
      counts.set(pid, (counts.get(pid) || 0) + 1);
    }
    return counts;
  }, [selectedIds.join(","), photoById]);

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
        fileName: fileNameFromUrlOrId(p),
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

  // ---------- Masonry por columnas (no recorta imágenes) ----------
  const columnCount = Math.max(4, Math.min(12, parseInt(cols, 10) || 6));
  const masonryStyle = useMemo(
    () => ({ columnCount, columnGap: "12px" }),
    [columnCount]
  );

  // Precio unitario para una foto dada (según selección por fotógrafo)
  const unitPriceFor = (item) => {
    const pid = item?.photographerId ? String(item.photographerId) : null;
    if (!pid) return 50;
    const tiers = priceByPhotog.get(pid) || [];
    const q = selCountByPhotog.get(pid) || 1;
    return priceForQty(tiers, q);
  };

  return (
    <section className="w-screen ml-[calc(50%-50vw)] px-3 sm:px-6">
      {/* Masonry container */}
      <div style={masonryStyle}>
        {(paginatedPhotos || []).map((item, idx) => {
          const isSel = selected?.has?.(item.id);
          const hsName = resolveHotspotName ? resolveHotspotName(item.hotspotId) : (item.hotspotId || "");
          const phName = resolvePhotographerName?.(item.photographerId) || "—";
          const fname = fileNameFromUrlOrId(item);
          const precioQ = unitPriceFor(item);

          return (
            <article
              key={item.id}
              className={
                "mb-2 break-inside-avoid rounded-xl overflow-hidden bg-white border transition " +
                (isSel ? "border-blue-600 ring-4 ring-blue-500/30" : "border-slate-200")
              }
            >
              {/* Foto completa sin recorte */}
              <button
                type="button"
                className="relative w-full text-left bg-slate-100 cursor-zoom-in"
                onClick={() => openLightbox(idx)}
                title="Ver grande"
              >
                {/* Precio badge */}
                <div className="absolute top-2 right-2 z-10">
                  <div className="rounded-md bg-black/70 text-white text-xs px-2 py-1 border border-white/10">
                    Q{Number(precioQ).toFixed(0)}
                  </div>
                </div>

                {/* Checkbox seleccionar */}
                <label
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-2 left-2 z-10 inline-flex items-center gap-2 rounded-md bg-white/90 text-xs px-2 py-1 border border-slate-200 shadow-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-blue-600"
                    checked={!!isSel}
                    onChange={() => onToggleSel?.(item.id)}
                  />
                  <span>{isSel ? "Seleccionada" : "Elegir"}</span>
                </label>

                <img
                  src={item.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full h-auto block object-contain"
                  draggable={false}
                />
              </button>

              {/* Info debajo (sin margen superior) */}
              {showLabels && (
                <div className="px-2 pb-2 pt-0 text-[12px] leading-tight text-slate-700">
                  <div className="truncate font-extrabold text-slate-900">{phName}</div>
                  <div className="truncate opacity-70">{hsName || "—"}</div>
                  <div className="truncate">{fname}</div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Sentinel para cargar más */}
      <div ref={sentinelRef} className="h-10" />

      {/* Barra de selección (totalQ lo calculás en el hook del padre) */}
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

      {/* Lightbox + HUD */}
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
            unitPriceFor={unitPriceFor}
          />
        </>
      )}
    </section>
  );
}

/* -------------------- HUD sobre el Lightbox -------------------- */
function LightboxHUD({ item, resolvePhotographerName, resolveHotspotName, selected, onToggleSel, onClose, unitPriceFor }) {
  const { addItem, setOpen } = useCart();
  if (!item) return null;

  const precio = unitPriceFor?.(item) ?? 50;
  const phName = resolvePhotographerName?.(item.photographerId) || "Fotógrafo";
  const hotName = resolveHotspotName?.(item.hotspotId) || "Punto";
  const route = item.route || "";
  const name = `Foto • ${phName}`;

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
                <span className="">Q{Number(precio).toFixed(0)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <label className={"h-9 px-3 rounded-xl border bg-white text-black font-display font-bold flex items-center gap-2 cursor-pointer " + (selected ? "ring-2 ring-blue-300" : "")}>
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-blue-600"
                  checked={!!selected}
                  onChange={onToggleSel}
                />
                {selected ? "Seleccionada" : "Elegir"}
              </label>
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
