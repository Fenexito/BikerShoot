// src/components/PhotoLightbox.jsx
import React, { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { fetchEvent, fetchHotspot } from "../lib/searchApi.js";

/**
 * PhotoLightbox – visor full-screen con HUD inferior y carrusel centrado.
 * - Click afuera (overlay o fondo) cierra el lightbox.
 * - La capa central usa pointer-events: none; la imagen pointer-events: auto;
 */

const fmtDateGT = (isoOrStr) => {
  if (!isoOrStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrStr)) {
    const [y, m, d] = isoOrStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    if (isNaN(dt) || dt.getFullYear() < 2000) return "";
    return dt.toLocaleDateString("es-GT", { weekday: "short", year: "numeric", month: "short", day: "2-digit" });
  }
  const dt = new Date(isoOrStr);
  if (isNaN(dt) || dt.getFullYear() < 2000) return "";
  return dt.toLocaleDateString("es-GT", { weekday: "short", year: "numeric", month: "short", day: "2-digit" });
};

const toYmd = (v) => {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    if (!isFinite(v) || v <= 0) return null;
    const ms = v < 10_000_000_000 ? v * 1000 : v;
    const d = new Date(ms);
    if (!isFinite(d.getTime()) || d.getFullYear() < 2000) return null;
    return d.toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^-?\d+$/.test(s)) {
      const n = Number(s);
      if (!isFinite(n) || n <= 0) return null;
      const ms = s.length <= 10 ? n * 1000 : n;
      const d = new Date(ms);
      if (!isFinite(d.getTime()) || d.getFullYear() < 2000) return null;
      return d.toISOString().slice(0, 10);
    }
    const d = new Date(s);
    if (!isFinite(d.getTime()) || d.getFullYear() < 2000) return null;
    return d.toISOString().slice(0, 10);
  }
  if (v instanceof Date) {
    if (!isFinite(v.getTime()) || v.getFullYear() < 2000) return null;
    return v.toISOString().slice(0, 10);
  }
  return null;
};

const isUuid = (s) =>
  typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export default function PhotoLightbox({
  images = [],
  index = 0,
  onIndexChange,
  onClose,
  showThumbnails = true,
  captionPosition = "bottom-centered",
  arrowBlue = false,
  safeBottom = 0,
  isSelected = () => false,
  onToggleSelect = () => {},
  onAddToCart = () => {},
}) {
  const total = images.length || 0;
  const current = images[index] || {};

  const EXTRA_PUSH_UP = 72;  // alto del carrusel
  const THUMB_SIZE = 72;
  const THUMB_GAP  = 8;

  const captionPad = captionPosition === "bottom-centered" ? 64 : 24;
  const bottomPad  = (safeBottom || 0) + captionPad + EXTRA_PUSH_UP;
  const topPad     = 12;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev || ""; };
  }, []);

  const prev = useCallback(() => { if (total) onIndexChange?.((index - 1 + total) % total); }, [index, total, onIndexChange]);
  const next = useCallback(() => { if (total) onIndexChange?.((index + 1) % total); }, [index, total, onIndexChange]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, onClose]);

  const preload = useMemo(() => {
    const a = images[(index - 1 + total) % total]?.src;
    const b = images[(index + 1) % total]?.src;
    return [a, b].filter(Boolean);
  }, [index, total, images]);

  const arrowCls = arrowBlue
    ? "w-10 h-10 rounded-full bg-blue-600/90 hover:bg-blue-600 text-white border border-blue-500/60"
    : "w-10 h-10 rounded-full bg-white/10 text-white border border-white/15";

  const fileName = current?.meta?.fileName || current?.alt || "";
  const hotspot = current?.meta?.hotspot || "";
  const photographerName = current?.meta?.photographerName || "";

  const [eventDate, setEventDate] = useState("");
  useEffect(() => {
    let alive = true;
    (async () => {
      const cur = images[index] || {};
      const d0 =
        toYmd(cur.eventDateISO) ||
        toYmd(cur.eventDate) ||
        toYmd(cur?.meta?.eventDateISO) ||
        toYmd(cur?.meta?.eventDate);
      if (d0) { if (alive) setEventDate(d0); return; }

      const evId = cur.eventId || cur?.meta?.eventId || null;
      if (evId) {
        try {
          const ev = await fetchEvent(evId);
          if (!alive) return;
          const d = toYmd(ev?.fecha) || toYmd(ev?.date) || "";
          setEventDate(d || "");
          return;
        } catch {}
      }

      let hsId = cur.hotspotId || cur?.meta?.hotspotId || null;
      if (!hsId && isUuid(cur?.meta?.hotspot || "")) hsId = cur.meta.hotspot;
      if (hsId) {
        try {
          const hs = await fetchHotspot(hsId);
          const eId = hs?.event_id;
          if (eId) {
            const ev = await fetchEvent(eId);
            if (!alive) return;
            const d = toYmd(ev?.fecha) || toYmd(ev?.date) || "";
            setEventDate(d || "");
            return;
          }
        } catch {}
      }

      if (alive) setEventDate("");
    })();
    return () => { alive = false; };
  }, [images, index]);

  const eventDateLabel = eventDate ? fmtDateGT(eventDate) : "";
  const timeLabel = useMemo(() => {
    const s = current?.meta?.time || "";
    const m = String(s).match(/\b(\d{1,2}:\d{2})\b/);
    return m ? m[1] : "";
  }, [current]);

  // ====== CARRUSEL centrado ======
  const railRef = useRef(null);
  const listRef = useRef(null);
  const prevIndexRef = useRef(index);

  const [sidePad, setSidePad] = useState(0);
  const recalcSidePad = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const v = Math.max(0, Math.floor(rail.clientWidth / 2 - THUMB_SIZE / 2 - THUMB_GAP * 2));
    setSidePad(v);
  }, []);

  useEffect(() => {
    recalcSidePad();
    window.addEventListener("resize", recalcSidePad);
    return () => window.removeEventListener("resize", recalcSidePad);
  }, [recalcSidePad]);

  const centerThumb = useCallback((i, behavior = "smooth") => {
    const rail = railRef.current;
    const list = listRef.current;
    if (!rail || !list) return;

    const item = list.children?.[i + 1];
    if (!item) return;

    const itemLeft  = item.offsetLeft;
    const itemWidth = item.offsetWidth;
    const railVisibleCenter = rail.clientWidth / 2;

    let target = itemLeft - (railVisibleCenter - itemWidth / 2);
    const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
    if (target < 0) target = 0;
    if (target > maxScroll) target = maxScroll;

    requestAnimationFrame(() => {
      rail.scrollTo({ left: Math.round(target), behavior });
    });
  }, []);

  useEffect(() => {
    if (!showThumbnails || total === 0) return;
    const rail = railRef.current;
    if (!rail) return;

    const was = prevIndexRef.current;
    const now = index;
    const wrappingToStart = was === total - 1 && now === 0;
    const wrappingToEnd   = was === 0 && now === total - 1;

    if (wrappingToStart) {
      rail.scrollTo({ left: 0, behavior: "auto" });
      centerThumb(now, "auto");
    } else if (wrappingToEnd) {
      const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
      rail.scrollTo({ left: maxScroll, behavior: "auto" });
      centerThumb(now, "auto");
    } else {
      centerThumb(now, "smooth");
    }

    prevIndexRef.current = now;
  }, [index, total, showThumbnails, centerThumb]);

  useEffect(() => {
    if (!showThumbnails || total === 0) return;
    const onResize = () => centerThumb(index, "auto");
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [index, total, showThumbnails, centerThumb]);

  const selected = !!isSelected(index);

  return (
    <div
      className="fixed inset-0 z-[4000]"
      aria-modal="true"
      role="dialog"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      {/* Fondo visual: cierra al click */}
      <div
        className="absolute inset-0 bg-black/90"
        onMouseDown={() => onClose?.()}
        aria-hidden
      />

      {/* Botón cerrar */}
      <button
        className="fixed top-3 right-3 z-[4100] h-9 px-3 rounded-lg bg-white/10 text-white border border-white/15"
        onClick={(e) => { e.stopPropagation(); onClose?.(); }}
        title="Cerrar (Esc)"
      >
        Cerrar
      </button>

      {/* Borde superior sutil */}
      <div className="absolute top-0 left-0 right-0 border-t border-white/15 z-[4005] pointer-events-none" />

      {/* Imagen: el wrapper NO consume clicks (pointer-events: none) */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ paddingTop: 12, paddingBottom: bottomPad }}
      >
        <img
          src={current?.src}
          alt={current?.alt || ""}
          className="max-w-[96vw] max-h-[80vh] object-contain select-none pointer-events-auto"
          draggable={false}
        />
      </div>

      {/* Flechas */}
      {total > 1 && (
        <>
          <button
            className={`fixed left-4 top-1/2 -translate-y-1/2 ${arrowCls} z-[4100] flex items-center justify-center`}
            onClick={(e) => { e.stopPropagation(); prev(); }}
            aria-label="Anterior"
            title="Anterior (←)"
          >
            ‹
          </button>
          <button
            className={`fixed right-4 top-1/2 -translate-y-1/2 ${arrowCls} z-[4100] flex items-center justify-center`}
            onClick={(e) => { e.stopPropagation(); next(); }}
            aria-label="Siguiente (→)"
            title="Siguiente (→)"
          >
            ›
          </button>
        </>
      )}

      {/* Carrusel de miniaturas */}
      {showThumbnails && total > 1 && (
        <div
          className="absolute left-0 right-0 z-[4300]"
          style={{ bottom: (safeBottom || 0) + EXTRA_PUSH_UP + THUMB_GAP }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            ref={railRef}
            className="w-screen overflow-x-auto overflow-y-hidden no-scrollbar"
            style={{ WebkitOverflowScrolling: "touch", padding: THUMB_GAP, scrollSnapType: "x mandatory" }}
          >
            <div
              ref={listRef}
              className="flex flex-nowrap items-center"
              style={{ gap: THUMB_GAP, paddingLeft: THUMB_GAP, paddingRight: THUMB_GAP }}
            >
              <div style={{ width: `calc(50vw - ${THUMB_SIZE/2 + THUMB_GAP*2}px)`, height: `${THUMB_SIZE}px`, flex: "0 0 auto" }} aria-hidden />
              {images.map((im, i) => (
                <button
                  key={i}
                  className={`flex-none rounded overflow-hidden border-4 ${i === index ? "border-blue-500 ring-4 ring-blue-500" : "border-white/10"}`}
                  style={{
                    width: THUMB_SIZE, height: THUMB_SIZE,
                    minWidth: THUMB_SIZE, minHeight: THUMB_SIZE,
                    scrollSnapAlign: "center", scrollSnapStop: "always",
                  }}
                  onClick={(e) => { e.stopPropagation(); onIndexChange?.(i); }}
                  title={im.alt || im.caption || `Foto ${i + 1}`}
                >
                  <img src={im.src} alt="" className="w-full h-full object-cover" draggable={false} />
                </button>
              ))}
              <div style={{ width: `calc(50vw - ${THUMB_SIZE/2 + THUMB_GAP*2}px)`, height: `${THUMB_SIZE}px`, flex: "0 0 auto" }} aria-hidden />
            </div>
          </div>
        </div>
      )}

      {/* HUD inferior */}
      {captionPosition === "bottom-centered" && (
        <div className="fixed left-0 right-0 bottom-0 z-[4200] px-3 pb-3 pt-2" onMouseDown={(e) => e.stopPropagation()}>
          <div className="mx-auto max-w-4xl">
            <div className="rounded-xl bg-white/95 text-slate-900 border border-slate-200 shadow-lg px-3 py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[13px] leading-tight">
                  <span className="mr-2">{eventDateLabel || ""}</span>
                  {timeLabel ? <span className="text-slate-500">{timeLabel}</span> : null}
                </div>
                <div className="text-[13px] leading-tight truncate">
                  {photographerName ? <span className="font-bold">{photographerName}</span> : null}
                  {hotspot ? <span className="ml-2 text-slate-600">· {hotspot}</span> : null}
                </div>
                {fileName ? <div className="text-[12px] text-slate-500 truncate">{fileName}</div> : null}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  className={`h-8 px-3 rounded-lg border text-[13px] ${isSelected(index) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-blue-700 border-blue-600"}`}
                  onClick={(e) => { e.stopPropagation(); onToggleSelect?.(index); }}
                >
                  {isSelected(index) ? "Deseleccionar" : "Seleccionar"}
                </button>
                <button
                  className="h-8 px-3 rounded-lg bg-emerald-500 text-white text-[13px] font-semibold"
                  onClick={(e) => { e.stopPropagation(); onAddToCart?.(index); }}
                >
                  Agregar al carrito
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preloads invisibles */}
      <div className="hidden">
        {preload.map((src, i) => (
          <img key={i} src={src} alt="" />
        ))}
      </div>

      <style>{`
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
