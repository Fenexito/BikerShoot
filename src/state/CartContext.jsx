// src/state/CartContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  useRef,
  Fragment,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabaseClient";
import { fetchEvent, fetchHotspot } from "../lib/searchApi.js";

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

/* =================== Utils =================== */
// === Persistencia local ===
const STORAGE_KEY = "biker.cart.v1";
const safeParse = (json) => { try { return JSON.parse(json); } catch { return null; } };
const loadFromStorage = () => {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const data = safeParse(raw);
  if (!data || !Array.isArray(data.items)) return [];
  return data.items.map((it) => ({
    id: it.id,
    name: it.name || "Foto",
    price: Math.max(0, Number(it.price) || 0),
    img: it.img || null,
    qty: Math.max(1, Number(it.qty) || 1),
    meta: it.meta || {},
  }));
};
const saveToStorage = (items) => {
  if (typeof window === "undefined") return;
  const payload = { items: (items || []).map((it) => ({
    id: it.id, name: it.name, price: it.price, img: it.img, qty: it.qty, meta: it.meta
  })) };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

const fmtQ = (n) =>
  `Q${Math.round(Number(n || 0)).toLocaleString("es-GT", {
    useGrouping: true,
    maximumFractionDigits: 0,
  })}`;

const fmtDateGT = (isoOrStr) => {
  if (!isoOrStr) return "";
  const s = String(isoOrStr).trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    if (!isFinite(dt.getTime()) || dt.getFullYear() < 2000) return "";
    return dt.toLocaleDateString("es-GT", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  }
  const dt = new Date(s);
  if (!isFinite(dt.getTime()) || dt.getFullYear() < 2000) return "";
  return dt.toLocaleDateString("es-GT", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const toYmd = (v) => {
  if (v == null || v === "") return null;
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
  if (typeof v === "number") {
    if (!isFinite(v) || v <= 0) return null;
    const ms = v < 10_000_000_000 ? v * 1000 : v;
    const d = new Date(ms);
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

function getPhotographerName(item) {
  const metaName =
    item?.meta?.photographerName ||
    item?.meta?.photographer_name ||
    item?.meta?.photographer ||
    "";
  if (metaName) return String(metaName);
  const name = String(item?.name || "");
  const ix = name.indexOf("•");
  if (ix >= 0) return name.slice(ix + 1).trim();
  return "Fotógrafo";
}

function getGroupKey(item) {
  const pid = item?.meta?.photographerId || item?.meta?.photographer_id;
  return pid ? `pid:${pid}` : `name:${getPhotographerName(item)}`;
}

/* =================== Fecha por ITEM (resolución fiable) =================== */
/**
 * Devuelve un mapa id->"label fecha" y resuelve perezosamente por cada item:
 * 1) Si trae meta.eventDateISO/eventDate => usa esa.
 * 2) Si trae eventId/hotspotId => fetchEvent/fetchHotspot => fecha.
 * 3) Si no trae IDs => pregunta a Supabase event_asset por el id de la foto.
 * 4) Si nada jala => usa meta.fecha si venía, o "".
 */
function useEventDateMap(items) {
  const [map, setMap] = useState({});
  const inFlight = useRef(new Set());

  useEffect(() => {
    let alive = true;

    (async () => {
      for (const it of items || []) {
        const id = String(it?.id || "");
        if (!id || map[id] || inFlight.current.has(id)) continue;

        inFlight.current.add(id);

        (async () => {
          try {
            let ymd =
              toYmd(it?.meta?.eventDateISO) ||
              toYmd(it?.eventDateISO) ||
              toYmd(it?.meta?.eventDate) ||
              null;

            let evId = it?.eventId || it?.meta?.eventId || null;
            let hsId = it?.hotspotId || it?.meta?.hotspotId || null;
            if (!hsId && isUuid(it?.meta?.hotspot || "")) hsId = it.meta.hotspot;

            if (!evId && !hsId) {
              const { data: ea } = await supabase
                .from("event_asset")
                .select("event_id, hotspot_id")
                .eq("id", id)
                .maybeSingle();
              if (ea) {
                evId = ea.event_id || evId;
                hsId = ea.hotspot_id || hsId;
              }
            }

            if (!ymd && evId) {
              try {
                const ev = await fetchEvent(evId);
                ymd = toYmd(ev?.fecha) || toYmd(ev?.date) || null;
              } catch {}
            }
            if (!ymd && hsId) {
              try {
                const hs = await fetchHotspot(hsId);
                const eId = hs?.event_id;
                if (eId) {
                  const ev = await fetchEvent(eId);
                  ymd = toYmd(ev?.fecha) || toYmd(ev?.date) || null;
                }
              } catch {}
            }

            const label =
              (ymd && fmtDateGT(ymd)) ||
              (it?.meta?.fecha && String(it.meta.fecha).trim()) ||
              "";

            if (alive) setMap((prev) => ({ ...prev, [id]: label }));
          } finally {
            inFlight.current.delete(id);
          }
        })();
      }
    })();

    return () => {
      alive = false;
    };
  }, [items, map]);

  return map;
}

/* =================== Provider =================== */
export function CartProvider({ children }) {
  const [items, setItems] = useState(() => loadFromStorage());
  const [open, setOpen] = useState(false);

  // Guardar cada vez que cambian los items
  useEffect(() => { saveToStorage(items); }, [items]);

  // Sincronizar entre pestañas/ventanas
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return;
      const data = safeParse(e.newValue);
      if (data && Array.isArray(data.items)) {
        setItems(data.items.map((it) => ({
          id: it.id,
          name: it.name || "Foto",
          price: Math.max(0, Number(it.price) || 0),
          img: it.img || null,
          qty: Math.max(1, Number(it.qty) || 1),
          meta: it.meta || {},
        })));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addItem = useCallback((item) => {
    setItems((prev) => {
      if (prev.some((p) => String(p.id) === String(item.id))) return prev;
      return [...prev, { ...item, qty: 1 }];
    });
    setOpen(true);
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((p) => String(p.id) !== String(id)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const total = useMemo(
    () => items.reduce((s, x) => s + (Number(x.price) || 0) * (x.qty || 1), 0),
    [items]
  );
  const count = useMemo(
    () => items.reduce((s, x) => s + (x.qty || 1), 0),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      clear,
      total,
      count,
      open,
      setOpen,
      getPhotographerName,
      getGroupKey,
    }),
    [items, addItem, removeItem, clear, total, count, open]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/* =================== Drawer UI =================== */
function InfoRow({ label, value }) {
  return (
    <div className="text-[12px] leading-tight">
      <span className="font-semibold text-slate-700">{label}: </span>
      <span className="text-slate-700">{value || "—"}</span>
    </div>
  );
}

function DrawerContent({
  open,
  onClose,
  items,
  grouped,
  removeItem,
  clear,
  total,
  dateMap,
}) {
  const asideRef = useRef(null);

  // quita drawers duplicados (por si acaso)
  useEffect(() => {
    try {
      const ours = asideRef.current;
      if (!ours) return;
      const asides = Array.from(
        document.querySelectorAll('aside[role="dialog"]')
      );
      for (const el of asides) {
        if (el === ours) continue;
        const text = (el.textContent || "").toLowerCase();
        const looksLikeCart =
          text.includes("tu carrito") && text.includes("ir al checkout");
        if (looksLikeCart) el.parentElement && el.parentElement.removeChild(el);
      }
    } catch {}
  }, []);

  const overlayClasses = "fixed inset-0 z-[3000] bg-black/70 transition-opacity";
  const panelClasses =
    "fixed right-0 top-0 bottom-0 z-[3001] w-[90vw] max-w-[480px] bg-white shadow-2xl flex flex-col";

  return (
    <Fragment>
      {open && <div className={overlayClasses} onClick={onClose} aria-hidden />}
      <aside
        ref={asideRef}
        className={`${panelClasses} ${
          open ? "translate-x-0" : "translate-x-full"
        } transition-transform duration-300`}
        role="dialog"
        aria-modal="true"
        id="biker-cart-drawer"
        data-cart="good"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 border-b flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            Tu carrito {items?.length ? `(${items.length})` : ""}
          </h2>
          <div className="flex items-center gap-2">
            {items?.length > 0 && (
              <button
                className="text-[12px] sm:text-[13px] px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
                onClick={clear}
                title="Vaciar carrito"
              >
                Vaciar todo
              </button>
            )}
            <button
              className="h-7 w-7 rounded-full bg-red-600 text-white flex items-center justify-center text-[12px]"
              onClick={onClose}
              title="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-5">
          {(!grouped || grouped.length === 0) && (
            <div className="text-slate-500 text-sm">
              No tenés fotos en el carrito todavía.
            </div>
          )}

          {grouped.map((g) => (
            <section key={g.key} className="border rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b flex items-center justify-between">
                <div className="font-extrabold text-slate-900 truncate">
                  {g.name}
                </div>
                <div className="text-slate-900 font-bold">{fmtQ(g.total)}</div>
              </div>

              <ul className="divide-y">
                {g.items.map((it) => {
                  const id = String(it.id);
                  const fechaLabel =
                    dateMap[id] ||
                    (it?.meta?.fecha && String(it.meta.fecha).trim()) ||
                    "";

                  const ruta =
                    it?.meta?.route ||
                    it?.meta?.ruta ||
                    it?.meta?.trayecto ||
                    "";
                  let punto = it?.meta?.hotspot || "";
                  if (
                    /^[0-9a-f-]{16,}$/i.test(String(punto)) ||
                    /^\d{3,}$/.test(String(punto))
                  ) {
                    punto = "";
                  }
                  const archivo = it?.meta?.fileName || it?.meta?.filename || "";
                  const totalItem = Math.round(
                    Number(it?.price || 0) * (it?.qty || 1)
                  );

                  return (
                    <li key={it.id} className="p-2 sm:p-3">
                      <div className="flex items-start gap-3">
                        {it?.img ? (
                          <div className="w-20 h-20 rounded-md border bg-white flex items-center justify-center overflow-hidden">
                            <img
                              src={it.img}
                              alt=""
                              className="w-full h-full object-contain"
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                        ) : (
                          <div className="w-20 h-20 rounded-md bg-white border" />
                        )}

                        <div className="flex-1 min-w-0 pt-0.5">
                          {/* 🔁 Antes: mostraba el nombre del fotógrafo (g.name).
                              ✅ Ahora: SOLO la fecha en negrita */}
                          <div className="text-[13px] font-extrabold text-slate-900 truncate">
                            {fechaLabel || "—"}
                          </div>

                          <div className="mt-0.5 space-y-0.5">
                            {/* Se quitó la fila "Fecha" para no duplicar */}
                            <InfoRow label="Ruta" value={ruta} />
                            <InfoRow label="Punto" value={punto} />
                            <InfoRow label="Archivo" value={archivo} />
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <div className="text-slate-900 font-bold">
                            {fmtQ(totalItem)}
                          </div>
                          <button
                            className="h-5 w-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px]"
                            onClick={() => removeItem(it.id)}
                            title="Eliminar esta foto"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="px-3 sm:px-4 py-3 border-t bg-white">
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-slate-600 text-sm">Total</div>
            <div className="text-slate-900 font-extrabold text-lg">
              {fmtQ(total)}
            </div>
          </div>
          <button
            className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
            onClick={() => {
              try {
                window.location.assign("/checkout");
              } catch {}
            }}
          >
            Ir al checkout
          </button>
        </div>
      </aside>
    </Fragment>
  );
}

/* =================== Root =================== */
export function CartDrawerRoot() {
  const { items, total, clear, open, setOpen, removeItem, getPhotographerName, getGroupKey } = useCart();

  // Agrupar por fotógrafo (igual que antes)
  const grouped = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const key = getGroupKey(it);
      if (!map.has(key)) {
        map.set(key, { key, name: getPhotographerName(it), items: [], total: 0 });
      }
      const g = map.get(key);
      g.items.push(it);
      g.total += (Number(it.price) || 0) * (it.qty || 1);
    }
    return Array.from(map.values());
  }, [items, getPhotographerName, getGroupKey]);

  // 🔑 Fechas por item (resueltas de forma independiente)
  const dateMap = useEventDateMap(items);

  // Host del portal
  const host =
    document.getElementById("biker-cart-drawer") ||
    (() => {
      const el = document.createElement("div");
      el.id = "biker-cart-drawer";
      document.body.appendChild(el);
      return el;
    })();

  return createPortal(
    <DrawerContent
      open={open}
      onClose={() => setOpen(false)}
      items={items}
      grouped={grouped}
      removeItem={removeItem}
      clear={clear}
      total={total}
      dateMap={dateMap}
    />,
    host
  );
}
