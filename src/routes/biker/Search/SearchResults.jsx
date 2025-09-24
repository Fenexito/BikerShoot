// src/routes/biker/Search/SearchResults.jsx
import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { useSearchParams } from "react-router-dom";
import PhotoLightbox from "../../../components/PhotoLightbox.jsx";
import { useCart } from "../../../state/CartContext.jsx";
import { supabase } from "../../../lib/supabaseClient";

/* ================= Utils ================= */
const fmtDate = (val) => {
  if (val == null || val === "" || val === 0) return "";
  if (typeof val === "string") {
    const s = val.trim();
    if (!s) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return isNaN(dt) || dt.getFullYear() < 2000
        ? ""
        : dt.toLocaleDateString("es-GT", { year: "numeric", month: "short", day: "2-digit" });
    }
  } else if (typeof val === "number") {
    if (!isFinite(val) || val <= 0) return "";
  }
  const d = new Date(val);
  return isNaN(d) || d.getFullYear() < 2000
    ? ""
    : d.toLocaleDateString("es-GT", { year: "numeric", month: "short", day: "2-digit" });
};

const fmtTime = (val) => {
  if (val == null || val === "" || val === 0) return "--:--";
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return "--:--";
  if (typeof val === "number" && (!isFinite(val) || val <= 0)) return "--:--";
  const d = new Date(val);
  return isNaN(d) || d.getFullYear() < 2000
    ? "--:--"
    : d.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" });
};

// Usa timestamp si es válido; si no, cae a la fecha del filtro (?fecha=YYYY-MM-DD)
const makeFmtDateEventAware = (fallbackYmd) => (val) => {
  const d = fmtDate(val);
  if (d) return d;
  if (fallbackYmd && /^\d{4}-\d{2}-\d{2}$/.test(String(fallbackYmd))) {
    const [y, m, day] = String(fallbackYmd).split("-").map(Number);
    const dt = new Date(y, m - 1, day);
    return isNaN(dt) || dt.getFullYear() < 2000
      ? ""
      : dt.toLocaleDateString("es-GT", { year: "numeric", month: "short", day: "2-digit" });
  }
  return "";
};

const norm = (s) =>
  String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

const fileNameFrom = (item) => {
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

function toNumberQ(v) {
  if (typeof v === "number" && isFinite(v)) return Math.round(v);
  const s = String(v ?? "").replace(/\s+/g, "").replace(/,/g, "."); // soportar "10,00"
  const only = s.replace(/[^\d.]/g, "");
  const n = Number(only);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

/* ==== Normalizar tiers ==== */
function normalizeTiersLegacy(preciosJson) {
  if (!Array.isArray(preciosJson)) return [];
  const out = [];
  for (const raw of preciosJson) {
    if (!raw || typeof raw !== "object") continue;
    const n = Number(raw.n ?? raw.min ?? raw.qty ?? raw.desde ?? raw.cant ?? raw.cantidad ?? NaN);
    const pRaw = raw.precio ?? raw.price_q ?? raw.price ?? raw.valor ?? raw.value;
    const p = toNumberQ(pRaw);
    if (!Number.isFinite(p)) continue;
    const min = Number.isFinite(n) ? Math.max(1, Math.floor(n)) : out.length ? out[out.length - 1].min + 1 : 1;
    out.push({ min, price: p });
  }
  out.sort((a, b) => a.min - b.min);
  const compact = [];
  for (const t of out) {
    if (compact.length && compact[compact.length - 1].min === t.min) compact[compact.length - 1] = t;
    else compact.push(t);
  }
  return compact;
}

function normalizeTiersFromList(listObj) {
  if (!listObj || typeof listObj !== "object") return [];
  const items = Array.isArray(listObj.items) ? listObj.items : [];
  const tiers = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const n = Number(raw.n ?? raw.min ?? raw.qty ?? raw.cantidad ?? raw.cant ?? raw.desde ?? NaN);
    const pRaw = raw.precio ?? raw.price_q ?? raw.price ?? raw.valor ?? raw.value ?? raw.monto;
    const p = toNumberQ(pRaw);
    if (!Number.isFinite(p)) continue;
    const min = Number.isFinite(n) ? Math.max(1, Math.floor(n)) : tiers.length ? tiers[tiers.length - 1].min + 1 : 1;
    tiers.push({ min, price: p });
  }
  tiers.sort((a, b) => a.min - b.min);
  const compact = [];
  for (const t of tiers) {
    if (compact.length && compact[compact.length - 1].min === t.min) compact[compact.length - 1] = t;
    else compact.push(t);
  }
  return compact;
}

/* ===== Bundle rules ===== */
function bundleTotalForQty(tiers, q) {
  if (!tiers || !tiers.length) return 50 * Math.max(1, q);
  const qty = Math.max(1, Number(q) || 1);
  const sorted = tiers.slice().sort((a, b) => a.min - b.min);

  const exact = sorted.find((t) => t.min === qty);
  if (exact) return exact.price;

  const first = sorted[0], last = sorted[sorted.length - 1];

  if (qty < first.min) {
    const unit = first.price / first.min;
    return Math.round(unit * qty);
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (qty > a.min && qty < b.min) {
      const gap = b.min - a.min;
      const step = (b.price - a.price) / gap;
      return Math.round(a.price + step * (qty - a.min));
    }
  }

  const unit = last.price / last.min;
  return Math.round(unit * qty);
}

function perItemAvgForQty(tiers, q) {
  const total = bundleTotalForQty(tiers, q);
  return Math.max(1, Math.round(total / Math.max(1, q)));
}

/* ========= Cache fecha por foto/evento/hotspot ========= */
const cacheEventDateByEventId = new Map();
const cacheEventIdByHotspotId = new Map();
const cacheDateByPhotoId     = new Map();

const toYmd = (v) => {
  if (!v) return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return v.trim();
  const d = new Date(v);
  if (isNaN(d) || d.getFullYear() < 2000) return null;
  return d.toISOString().slice(0, 10);
};

/* === Fallback puntual para fotos sin eventId/hotspotId === */
async function getEventDateFromEventAssetParallel(photo) {
  const asStr = String(photo?.id || "");
  if (!asStr) return null;

  const withoutQuery = asStr.split("?")[0];
  const filename = decodeURIComponent((withoutQuery.split("/").pop() || "").trim());

  const cols = [
    ["id", asStr],
    ["storage_path", asStr],
    ["file_path", asStr],
    ["path", asStr],
    ["url", asStr],
  ];
  if (filename) {
    cols.push(["file_name", filename], ["filename", filename], ["name", filename]);
  }

  const promises = cols.map(([col, val]) =>
    supabase
      .from("event_asset")
      .select("id, event_id, hotspot_id, event:event_id(fecha, date)")
      .eq(col, val)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => data)
      .catch(() => null)
  );

  const results = await Promise.allSettled(promises);
  for (const r of results) {
    const data = r.status === "fulfilled" ? r.value : null;
    if (data) {
      const y = toYmd(data?.event?.fecha) || toYmd(data?.event?.date);
      return y || null;
    }
  }
  return null;
}

/* === Resolver fechas para un lote de fotos === */
async function resolveEventDatesForItems(items) {
  const out = new Map();

  for (const p of items) {
    const cached = cacheDateByPhotoId.get(String(p.id));
    if (cached) out.set(String(p.id), cached);
  }

  const pending = items.filter((p) => !out.has(String(p.id)));
  if (!pending.length) return out;

  const withEvent = pending.filter((p) => p?.eventId);
  const eventIds = Array.from(new Set(withEvent.map((p) => String(p.eventId)))).filter(Boolean);

  const missingEventIds = eventIds.filter((eid) => !cacheEventDateByEventId.has(eid));
  if (missingEventIds.length) {
    try {
      const { data } = await supabase.from("event").select("id, fecha, date").in("id", missingEventIds);
      for (const row of data || []) {
        const y = toYmd(row?.fecha) || toYmd(row?.date);
        if (y) cacheEventDateByEventId.set(String(row.id), y);
      }
    } catch {}
  }
  for (const p of withEvent) {
    const y = cacheEventDateByEventId.get(String(p.eventId)) || null;
    if (y) {
      out.set(String(p.id), y);
      cacheDateByPhotoId.set(String(p.id), y);
    }
  }

  const withHotspot = pending.filter((p) => !out.has(String(p.id)) && p?.hotspotId);
  const hotspotIds = Array.from(new Set(withHotspot.map((p) => String(p.hotspotId)))).filter(Boolean);

  const missingHotspotIds = hotspotIds.filter((hid) => !cacheEventIdByHotspotId.has(hid));
  if (missingHotspotIds.length) {
    try {
      const { data } = await supabase.from("hotspot").select("id, event_id").in("id", missingHotspotIds);
      for (const row of data || []) {
        if (row?.id) cacheEventIdByHotspotId.set(String(row.id), row?.event_id || null);
      }
    } catch {}
  }

  const eventIdsFromHs = Array.from(
    new Set(withHotspot.map((p) => cacheEventIdByHotspotId.get(String(p.hotspotId)) || null).filter(Boolean).map(String))
  );

  const missingEvFromHs = eventIdsFromHs.filter((eid) => !cacheEventDateByEventId.has(eid));
  if (missingEvFromHs.length) {
    try {
      const { data } = await supabase.from("event").select("id, fecha, date").in("id", missingEvFromHs);
      for (const row of data || []) {
        const y = toYmd(row?.fecha) || toYmd(row?.date);
        if (y) cacheEventDateByEventId.set(String(row.id), y);
      }
    } catch {}
  }

  for (const p of withHotspot) {
    const evId = cacheEventIdByHotspotId.get(String(p.hotspotId)) || null;
    const y = evId ? cacheEventDateByEventId.get(String(evId)) || null : null;
    if (y) {
      out.set(String(p.id), y);
      cacheDateByPhotoId.set(String(p.id), y);
    }
  }

  const noKeys = pending.filter((p) => !out.has(String(p.id)));
  if (noKeys.length) {
    const results = await Promise.all(
      noKeys.map(async (p) => {
        try {
          const y = await getEventDateFromEventAssetParallel(p);
          return [String(p.id), y || null];
        } catch {
          return [String(p.id), null];
        }
      })
    );
    for (const [pid, y] of results) {
      if (y) {
        out.set(pid, y);
        cacheDateByPhotoId.set(pid, y);
      }
    }
  }

  return out;
}

/* =================== Componente =================== */
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
  cols = 6,
  showLabels = false,
}) {
  // === FECHA del filtro (?fecha=YYYY-MM-DD) como fallback UI (lightbox)
  const [params] = useSearchParams();
  const filtroFechaYmd = params.get("fecha") || "";
  const fmtDateEventAware = useMemo(
    () => makeFmtDateEventAware(filtroFechaYmd),
    [filtroFechaYmd]
  );

  /* ---- cache de precios por fotógrafo ---- */
  const [priceByPhotog, setPriceByPhotog] = useState(() => new Map());
  const [loadingPrices, setLoadingPrices] = useState(false);

  const visiblePhotogIds = useMemo(() => {
    const s = new Set(
      (paginatedPhotos || []).map((p) => String(p.photographerId || "")).filter(Boolean)
    );
    return Array.from(s);
  }, [paginatedPhotos]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!visiblePhotogIds.length) return;
      const missing = visiblePhotogIds.filter((id) => !priceByPhotog.has(String(id)));
      if (!missing.length) return;

      setLoadingPrices(true);
      try {
        const { data, error } = await supabase
          .from("photographer_profile")
          .select("user_id, price_lists, precios")
          .in("user_id", missing);
        if (error) throw error;

        const next = new Map(priceByPhotog);
        for (const row of data || []) {
          const lists = Array.isArray(row?.price_lists) ? row.price_lists : [];
          const prefer = lists.find((l) => norm(l?.nombre || l?.name) === "fotos de domingo");
          const pick = prefer || lists.find((l) => Array.isArray(l?.items) && l.items.length > 0) || null;
          const tiers = pick ? normalizeTiersFromList(pick) : normalizeTiersLegacy(row?.precios);
          next.set(String(row.user_id), tiers);
        }
        for (const id of missing) if (!next.has(String(id))) next.set(String(id), []);
        if (alive) setPriceByPhotog(next);
      } catch {
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

  /* ---- selección normalizada ---- */
  const selectedIds = useMemo(
    () => (selected && typeof selected.size === "number" ? Array.from(selected) : []),
    [selected]
  );

  const photoById = useMemo(() => {
    const map = new Map();
    for (const p of paginatedPhotos || []) map.set(p.id, p);
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
  }, [selectedIds, photoById]);

  const unitPriceFor = (item) => {
    const pid = String(item?.photographerId || "");
    if (!pid) return 50;
    const tiers = priceByPhotog.get(pid) || [];
    const qIfAdd = selCountByPhotog.get(pid) || 0;
    const q = Math.max(1, qIfAdd);
    return perItemAvgForQty(tiers, q);
  };

  const totalExact = useMemo(() => {
    if (!selectedIds.length) return 0;
    const counts = new Map();
    for (const id of selectedIds) {
      const ph = photoById.get(id);
      const pid = ph?.photographerId ? String(ph.photographerId) : null;
      if (!pid) continue;
      counts.set(pid, (counts.get(pid) || 0) + 1);
    }
    let sum = 0;
    for (const [pid, qty] of counts.entries()) {
      const tiers = priceByPhotog.get(pid) || [];
      sum += bundleTotalForQty(tiers, qty);
    }
    return Math.round(sum);
  }, [selectedIds, photoById, priceByPhotog]);

  /* ---- Lightbox ---- */
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);
  const openLightbox = (idx) => { setLbIndex(idx); setLbOpen(true); };
  const closeLightbox = () => setLbOpen(false);

  const images = useMemo(() => {
    return (paginatedPhotos || []).map((p) => ({
      src: p.url,
      alt: "Foto",
      // ya no usamos caption para 1/N — lo arma el HUD interno
      meta: {
        fileName: fileNameFrom(p),
        time: `${fmtDateEventAware(p.timestamp)} ${fmtTime(p.timestamp)}`,
        hotspot: resolveHotspotName?.(p.hotspotId) || "",
        photographerName: resolvePhotographerName?.(p.photographerId) || "",
        eventId: p.eventId || null,
        hotspotId: p.hotspotId || null,
      },
      eventId: p.eventId || null,
      hotspotId: p.hotspotId || null,
    }));
  }, [paginatedPhotos, resolvePhotographerName, resolveHotspotName, fmtDateEventAware]);

  // Añadir 1 foto al carrito desde el lightbox
  const { addItem, setOpen: openCart, items: cartItems } = useCart();

  const addOneToCartAt = async (idx) => {
    const item = (paginatedPhotos || [])[idx];
    if (!item) return;

    const already = Array.isArray(cartItems) && cartItems.some((ci) => String(ci?.id) === String(item.id));
    if (already) { openCart?.(true); return; }

    // Resolver fecha exacta (rápido usando el batch helper con 1 item)
    const fechaMap = await resolveEventDatesForItems([item]);
    const ymd = fechaMap.get(String(item.id)) || null;
    const fechaStr = ymd ? fmtDate(ymd) : fmtDateEventAware(item.timestamp);

    const phName = resolvePhotographerName?.(item.photographerId) || "Fotógrafo";
    const hotspotName = resolveHotspotName?.(item.hotspotId) || "";
    const fname = fileNameFrom(item);

    addItem?.({
      id: item.id,
      name: `Foto • ${phName}`,
      price: unitPriceFor(item),
      img: item.url,
      qty: 1,
      meta: {
        fecha: fechaStr,
        route: item?.route || "",
        hotspot: hotspotName,
        fileName: fname,
        photographerId: String(item.photographerId || ""),
        photographerName: phName,
        eventId: item.eventId || null,
        hotspotId: item.hotspotId || null,
      },
    });

    openCart?.(true);
  };

  /* ---- Agregar SELECCIÓN completa al carrito ---- */
  // Cantidad actual en carrito por fotógrafo (para bundles correctos)
  const cartCountByPhotog = useMemo(() => {
    const m = new Map();
    for (const it of cartItems || []) {
      const pid = String(it?.meta?.photographerId || "");
      if (!pid) continue;
      m.set(pid, (m.get(pid) || 0) + (Number(it.qty) || 1));
    }
    return m;
  }, [cartItems]);

  const addSelectionToCart = async () => {
    const all = (paginatedPhotos || []);
    const sel = selectedIds
      .map((id) => all.find((p) => String(p.id) === String(id)))
      .filter(Boolean);
    if (!sel.length) { openCart?.(true); return; }

    // Evitar duplicados (si ya están en carrito)
    const existingIds = new Set((cartItems || []).map((ci) => String(ci.id)));
    const toAdd = sel.filter((p) => !existingIds.has(String(p.id)));
    if (!toAdd.length) { openCart?.(true); clearSel?.(); return; }

    // 💨 MODO RÁPIDO / OPTIMISTA: sin RPCs extras
    // - Fecha inmediata: timestamp o caída a ?fecha del filtro (fmtDateEventAware)
    // - Precio por bundle correcto usando tiers ya cacheados
    const byPhotog = new Map();
    for (const p of toAdd) {
      const pid = String(p?.photographerId || "");
      if (!byPhotog.has(pid)) byPhotog.set(pid, []);
      byPhotog.get(pid).push(p);
    }

    for (const [pid, list] of byPhotog.entries()) {
      const tiers = priceByPhotog.get(pid) || [];
      const already = cartCountByPhotog.get(pid) || 0;
      const finalQty = already + list.length;
      const unit = perItemAvgForQty(tiers, finalQty);
      const phName = resolvePhotographerName?.(pid) || "Fotógrafo";

      for (const item of list) {
        const fechaStr = fmtDateEventAware(item.timestamp);
        const hotspotName = resolveHotspotName?.(item.hotspotId) || "";
        const fname = fileNameFrom(item);

        addItem?.({
          id: item.id,
          name: `Foto • ${phName}`,
          price: unit,
          img: item.url,
          qty: 1,
          meta: {
            fecha: fechaStr,
            route: item?.route || "",
            hotspot: hotspotName,
            fileName: fname,
            photographerId: String(item.photographerId || ""),
            photographerName: phName,
            eventId: item.eventId || null,
            hotspotId: item.hotspotId || null,
          },
        });
      }
    }

    openCart?.(true);
    // 🧹 limpiar selección inmediatamente
    clearSel?.();
  };

  /* ---- Infinite scroll ---- */
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

  /* ======= Masonry por JS ======= */
  const columnCount = Math.max(4, Math.min(12, parseInt(cols, 10) || 6));
  const GAP = 12;

  const containerRef = useRef(null);
  const itemRefs = useRef(new Map());
  const [positions, setPositions] = useState(new Map());
  const [containerHeight, setContainerHeight] = useState(0);

  const getItemRef = (id) => {
    if (!itemRefs.current.has(id)) itemRefs.current.set(id, React.createRef());
    return itemRefs.current.get(id);
  };

  const doLayout = useCallbackSafe(() => {
    const el = containerRef.current;
    if (!el) return;

    const width = el.clientWidth;
    if (!width) return;

    const colW = Math.floor((width - GAP * (columnCount - 1)) / columnCount);
    const colHeights = new Array(columnCount).fill(0);

    const nextPos = new Map();
    let maxH = 0;

    for (const p of paginatedPhotos || []) {
      const id = p.id;
      const ref = itemRefs.current.get(id);
      if (!ref || !ref.current) continue;

      ref.current.style.width = `${colW}px`;
      ref.current.style.position = "absolute";
      ref.current.style.visibility = "hidden";

      const h = ref.current.offsetHeight;

      let target = 0;
      for (let i = 1; i < columnCount; i++) {
        if (colHeights[i] < colHeights[target]) target = i;
      }

      const left = target * (colW + GAP);
      const top = colHeights[target];

      colHeights[target] = top + h + GAP;
      maxH = Math.max(maxH, colHeights[target]);

      nextPos.set(id, { left, top, width: colW, height: h });
    }

    const finalH = Math.max(0, maxH - GAP);

    for (const [id] of nextPos.entries()) {
      const ref = itemRefs.current.get(id);
      if (ref?.current) {
        ref.current.style.visibility = "visible";
      }
    }

    setPositions(nextPos);
    setContainerHeight(finalH);
  }, [paginatedPhotos, columnCount, showLabels]);

  useLayoutEffect(() => { doLayout(); }, [doLayout]);
  useEffect(() => {
    const onResize = () => doLayout();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [doLayout]);
  useEffect(() => { doLayout(); }, [showLabels, doLayout]);

  const onImgLoad = () => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => doLayout());
    } else {
      setTimeout(() => doLayout(), 0);
    }
  };

  /* ---- Barra selección (inferior) ---- */
  const hasSelection = selectedIds.length > 0;

  /* ========= CLASE PARA QUITAR EL “ESPACIO MALO” =========
     - Si NO hay más fotos por cargar (hasMorePhotos === false)
     - y NO hay barra de selección (hasSelection === false)
     entonces anulamos el pb-28 del wrapper externo con mb-[-7rem].
  */
  const wrapperExtraMb = (!hasMorePhotos && !hasSelection) ? "mb-[-7rem]" : "";

  return (
    <section className={`w-full px-3 sm:px-6 overflow-x-clip ${wrapperExtraMb}`}>
      {/* CONTENEDOR MASONRY ABSOLUTE */}
      <div
        ref={containerRef}
        style={{ position: "relative", height: `${containerHeight}px`, overflow: "visible" }}
      >
        {(paginatedPhotos || []).map((item, idx) => {
          const isSel = selected?.has?.(item.id);
          const hsName = resolveHotspotName ? resolveHotspotName(item.hotspotId) : item.hotspotId || "";
          const phName = resolvePhotographerName?.(item.photographerId) || "—";
          const fname = fileNameFrom(item);
          const pos = positions.get(item.id) || { left: 0, top: 0, width: 0 };

          return (
            <div
              key={item.id}
              ref={getItemRef(item.id)}
              style={{ position: "absolute", left: pos.left, top: pos.top, width: pos.width ? `${pos.width}px` : undefined }}
            >
              <article
                className={
                  "rounded-xl overflow-hidden bg-white border relative group " +
                  (isSel
                    ? "border-blue-600 ring-4 ring-blue-600 shadow-[0_0_0_4px_rgba(59,130,246,0.35)]"
                    : "border-slate-200 hover:shadow-md")
                }
              >
                {/* Checkbox */}
                <label
                  className="absolute top-2 left-2 z-10 inline-flex items-center gap-2 rounded-md bg-white/90 px-2 py-1 border border-slate-200 shadow-sm cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                  title={isSel ? "Quitar de selección" : "Agregar a selección"}
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-blue-600"
                    checked={!!isSel}
                    onChange={() => onToggleSel?.(item.id)}
                  />
                </label>

                {/* Foto */}
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
                    onLoad={onImgLoad}
                    onError={onImgLoad}
                  />
                </button>

                {/* Info */}
                {showLabels && (
                  <div className="px-2 pb-2 pt-0 text-[12px] leading-tight text-slate-700">
                    <div className="truncate font-extrabold text-slate-900">{phName}</div>
                    <div className="truncate opacity-70">{hsName || "—"}</div>
                    <div className="truncate">{fname}</div>
                  </div>
                )}
              </article>
            </div>
          );
        })}
      </div>

      {/* Sentinel: SOLO deja altura cuando hay más por cargar */}
      <div ref={sentinelRef} className={hasMorePhotos ? "h-10" : "h-0"} />

      {/* Barra selección */}
      {hasSelection && (
        <div className="sticky bottom-3 z-[1101] mt-3">
          <div className="max-w-[820px] mx-auto rounded-2xl bg-blue-600/95 text-white px-4 py-2.5 flex items-center justify-between text-sm shadow-2xl">
            <div className="truncate">
              <span className="font-semibold">{selectedIds.length}</span> foto{selectedIds.length === 1 ? "" : "s"} seleccionada{selectedIds.length === 1 ? "" : "s"}
              <span className="mx-2 text-white/60">•</span>
              Total estimado: <span className="font-display font-bold">Q{totalExact}</span>
              {loadingPrices ? <span className="ml-2 text-white/70">(cargando precios…)</span> : null}
            </div>
            <div className="flex items-center gap-2">
              <button className="h-9 px-3 rounded-xl bg-white text-blue-700 font-display font-bold" onClick={clearSel}>
                Limpiar
              </button>
              <button
                className="h-9 px-3 rounded-xl bg-emerald-500 text-white font-display font-bold"
                onClick={addSelectionToCart}
                title="Agregar selección al carrito"
              >
                Agregar selección
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lbOpen && (
        <PhotoLightbox
          images={images}
          index={lbIndex}
          onIndexChange={setLbIndex}
          onClose={closeLightbox}
          showThumbnails
          captionPosition="bottom-centered"
          arrowBlue
          safeBottom={0}
          isSelected={(i) => {
            const p = (paginatedPhotos || [])[i];
            return p ? selected?.has?.(p.id) : false;
          }}
          onToggleSelect={(i) => {
            const p = (paginatedPhotos || [])[i];
            if (p) onToggleSel?.(p.id);
          }}
          onAddToCart={(i) => addOneToCartAt(i)}
        />
      )}
    </section>
  );
}

/* ===== util seguro para callbacks ===== */
function useCallbackSafe(fn, deps) {
  const ref = useRef(fn);
  ref.current = fn;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (...args) => ref.current(...args), deps);
}
