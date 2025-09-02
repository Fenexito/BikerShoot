import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PhotoLightbox from "../../components/PhotoLightbox.jsx";
import { hotspots } from "../../data/hotspots";

/* ===== Persistencia ===== */
const LS_KEY = "studioOrders";
const loadAll = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const saveAll = (list) => localStorage.setItem(LS_KEY, JSON.stringify(list));

/* ===== Utils ===== */
const currency = (n) => `Q${(n || 0).toFixed(2)}`;
const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString("es-GT", { dateStyle: "medium", timeStyle: "short" });
const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" });

const getFileName = (it) =>
  it.fileName || (typeof it.url === "string" ? it.url.split("/").pop().split("?")[0] : "foto.jpg");

const STATUS_LABEL = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  pagado: "Pagado",
  completado: "Completado",
  cancelado: "Cancelado",
};
const statusChipCls = (s) =>
  s === "completado"
    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
    : s === "pagado"
    ? "bg-sky-500/20 text-sky-300 border-sky-500/30"
    : s === "en_proceso"
    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
    : s === "pendiente"
    ? "bg-slate-500/20 text-slate-300 border-slate-500/30"
    : "bg-red-500/20 text-red-300 border-red-500/30";

/* WhatsApp helper */
function buildWhatsAppLink(rawPhone, text) {
  const phone = (rawPhone || "").replace(/[^\d]/g, "");
  const msg = encodeURIComponent(text || "");
  return `https://wa.me/${phone}?text=${msg}`;
}

export default function OrderDetail() {
  const { id } = useParams();
  const [orders, setOrders] = useState(loadAll());
  const order = orders.find((o) => o.id === id);

  const deliveryRef = useRef(null);

  useEffect(() => saveAll(orders), [orders]);

  if (!order) {
    return (
      <main className="w-full max-w-[1100px] mx-auto px-5 py-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="mb-3 text-lg font-semibold">Pedido no encontrado</div>
          <Link to="/studio/pedidos" className="text-blue-400 font-semibold">
            Volver a pedidos
          </Link>
        </div>
      </main>
    );
  }

  function patch(p) {
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...p } : o)));
  }
  function setStatus(s) {
    patch({ estado: s });
  }

  function uploadDelivery(files) {
    if (!files?.length) return;
    const items = Array.from(files).map((f) => ({
      id: "d" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      name: f.name,
      url: URL.createObjectURL(f),
      size: f.size,
      ts: new Date().toISOString(),
    }));
    patch({ entregas: [...(order.entregas || []), ...items] });
  }

  // Nombre del punto por id
  const getHotspotName = (id) => hotspots.find((h) => h.id === id)?.name || id;

  // Agrupar por punto
  const puntos = useMemo(() => {
    const map = new Map();
    order.items.forEach((it) => {
      const key = it.hotspotId;
      const name = getHotspotName(key);
      const arr = map.get(key) || { name, items: [] };
      arr.items.push(it);
      map.set(key, arr);
    });
    return Array.from(map.values()).map((p) => ({
      ...p,
      items: p.items.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
    }));
  }, [order.items]);

  const itemsFlat = useMemo(
    () => order.items.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
    [order.items]
  );

  const canComplete =
    order.entregas?.length > 0 && (order.estado === "pagado" || order.estado === "en_proceso");

  /* ===== Lightbox (mismo que el buscador) ===== */
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);

  const lightboxImages = useMemo(
    () =>
      itemsFlat.map((it) => ({
        src: it.url,
        alt: getFileName(it),
        caption: `${getFileName(it)} · ${fmtTime(it.timestamp)}`,
        meta: {
          fileName: getFileName(it),
          time: fmtTime(it.timestamp),
          hotspot: getHotspotName(it.hotspotId),
        },
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemsFlat]
  );

  function openLB(idx) {
    setLbIndex(idx);
    setLbOpen(true);
  }

  /* ===== WhatsApp ===== */
  const waMsg = `¡Hola ${order.biker?.nombre?.split(" ")[0] || ""}! Soy el estudio. Sobre tu pedido ${order.id}, ¿en qué te puedo ayudar?`;
  const waHref = buildWhatsAppLink(order.biker?.telefono || "", waMsg);

  // Copiar nombre de archivo
  async function copyName(name) {
    try {
      await navigator.clipboard.writeText(name);
      // Podés meter un toast si querés; por ahora un alert suave:
      // alert("Nombre copiado");
    } catch (e) {
      console.error("Clipboard error", e);
    }
  }

  return (
    <main className="w-full max-w-[1100px] mx-auto px-5 py-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link to="/studio/pedidos" className="text-blue-400 font-semibold">
          ← Volver
        </Link>
        <h1 className="text-2xl md:text-3xl font-display font-black">Pedido {order.id}</h1>
        <span className={`px-2 py-0.5 rounded-full border text-xs ${statusChipCls(order.estado)}`}>
          {STATUS_LABEL[order.estado]}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            className="h-10 px-4 rounded-xl bg-green-500 text-white font-display font-bold inline-flex items-center justify-center"
            title="Abrir WhatsApp"
          >
            WhatsApp
          </a>
          <button
            className="h-10 px-4 rounded-xl border border-white/15 bg-white/5 text-white font-display font-bold"
            onClick={() => setStatus("en_proceso")}
          >
            Marcar en proceso
          </button>
          <button
            className="h-10 px-4 rounded-xl border border-white/15 bg-white/5 text-white font-display font-bold"
            onClick={() => setStatus("pagado")}
          >
            Marcar pagado
          </button>
          <button
            className={
              "h-10 px-4 rounded-xl font-display font-bold " +
              (canComplete
                ? "bg-blue-500 text-white border border-white/10"
                : "bg-white/5 text-white border border-white/15 opacity-60 cursor-not-allowed")
            }
            onClick={() => canComplete && setStatus("completado")}
          >
            Marcar completado
          </button>
          <button
            className="h-10 px-4 rounded-xl bg-red-600 text-white font-display font-bold"
            onClick={() => setStatus("cancelado")}
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* Layout */}
      <section className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        {/* Principal */}
        <div className="space-y-4">
          {/* Resumen */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold mb-3">Resumen</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Fecha" value={fmtDateTime(order.fecha)} />
              <Stat label="Items" value={order.items.length} />
              <Stat label="Total" value={currency(order.total)} />
              <Stat label="Estado" value={STATUS_LABEL[order.estado]} />
            </div>
          </div>

          {/* Fotos por punto + filename (copiable) */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold mb-3">Fotos solicitadas</h3>
            <div className="space-y-5">
              {puntos.map((p, idx) => (
                <div key={idx}>
                  <div className="mb-1 text-sm text-slate-300">{p.name}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                    {p.items.map((it) => {
                      const idxFlat = itemsFlat.findIndex((x) => x === it);
                      const file = getFileName(it);
                      return (
                       <div key={it.photoId || it.url} className="text-left">
                         <button
                           className="w-full"
                           onClick={() => openLB(idxFlat)}
                           title={file}
                         >
                           <div className="aspect-[3/4] rounded-xl overflow-hidden bg-neutral-800 border border-white/10">
                             <img src={it.url} alt="" className="w-full h-full object-cover" />
                           </div>
                         </button>
                         {/* 1) Punto */}
                         <div className="mt-1 text-[12px] text-slate-200 font-medium">
                           {getHotspotName(it.hotspotId)}
                         </div>
                         {/* 2) Hora */}
                         <div className="text-[11px] text-slate-400">
                           {fmtTime(it.timestamp)}
                         </div>
                         {/* 3) Nombre archivo + Copiar (más pequeño) */}
                         <div className="mt-0.5 flex items-center gap-2">
                           <span
                             className="font-mono text-xs font-semibold text-white/90 bg-white/10 px-2 py-0.5 rounded select-text"
                             title={file}
                           >
                             {file}
                           </span>
                           <button
                             className="text-[10px] px-1.5 py-0.5 rounded border border-white/15 bg-white/5 text-white hover:bg-white/10"
                             onClick={() => copyName(file)}
                             title="Copiar nombre"
                           >
                             Copiar
                           </button>
                         </div>
                       </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lateral: cliente + entrega */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold mb-3">Cliente</h3>
            <div className="space-y-1 text-sm">
              <div className="font-medium">{order.biker?.nombre}</div>
              <div className="text-slate-300">{order.biker?.email}</div>
              <div className="text-slate-300">{order.biker?.telefono}</div>
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex h-9 px-3 rounded-xl bg-green-500 text-white font-display font-bold items-center justify-center"
                title="Abrir WhatsApp"
              >
                WhatsApp
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold mb-3">Entregar archivos HD</h3>
            <div
              className="rounded-xl border border-dashed border-white/20 bg-white/5 p-5 text-center cursor-pointer"
              onClick={() => deliveryRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                uploadDelivery(e.dataTransfer.files);
              }}
            >
              <div className="font-medium">Arrastrá tus archivos aquí</div>
              <div className="text-sm text-slate-400">o hacé click para seleccionar</div>
              <input
                ref={deliveryRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => uploadDelivery(e.target.files)}
              />
            </div>

            <div className="mt-3 max-h-60 overflow-auto space-y-2">
              {(order.entregas || []).length === 0 ? (
                <div className="text-sm text-slate-400">Aún no entregaste archivos.</div>
              ) : (
                order.entregas.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <div className="w-10 h-10 rounded bg-neutral-800 border border-white/10 grid place-items-center text-xs">
                      HD
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium truncate">{d.name}</div>
                      <div className="text-[11px] text-slate-400">{fmtDateTime(d.ts)}</div>
                    </div>
                    <a
                      href={d.url}
                      download={d.name}
                      className="h-9 px-3 rounded-xl border border-white/15 bg-white/5 text-white font-display font-bold inline-flex items-center justify-center"
                    >
                      Descargar
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Lightbox – info abajo centrada y flechas azules */}
      {lbOpen && (
        <PhotoLightbox
          images={lightboxImages}
          index={lbIndex}
          onClose={() => setLbOpen(false)}
          onIndexChange={setLbIndex}
          captionPosition="bottom-centered"
          arrowBlue
        />
      )}
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
