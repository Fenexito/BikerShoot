import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { searchPhotos } from "../../data/searchPhotos";

/* ====== Persistencia ====== */
const LS_KEY = "studioOrders";

/* ====== Utilidades ====== */
const currency = (n) => `Q${(n || 0).toFixed(2)}`;
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("es-GT", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const STATUS = ["pendiente", "en_proceso", "pagado", "completado", "cancelado"];
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

/* Pago: etiqueta por estado del pedido */
const paymentLabel = (estado) =>
  estado === "cancelado" ? "REEMBOLSADO" : estado === "pagado" || estado === "completado" ? "PAGADO" : "PENDIENTE";
const paymentChipCls = (estado) =>
  estado === "cancelado"
    ? "bg-slate-500/20 text-slate-300 border-slate-500/30"
    : estado === "pagado" || estado === "completado"
    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
    : "bg-amber-500/20 text-amber-300 border-amber-500/30";

function loadOrders() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveOrders(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

/* ====== Seed con datos falsos (ahora incluye fileName) ====== */
function seedIfEmpty() {
  let data = loadOrders();
  if (data && Array.isArray(data) && data.length) return data;

  const myStudio = localStorage.getItem("studioId") || "ph1";
  const mine = searchPhotos.filter((p) => p.photographerId === myStudio);
  const randPick = (arr, n) => arr.slice().sort(() => 0.5 - Math.random()).slice(0, n);

  const buyers = [
    { id: "bk1", nombre: "Carlos Pérez", email: "carlos@example.com", telefono: "+502 5555 1111" },
    { id: "bk2", nombre: "María López", email: "maria@example.com", telefono: "+502 5555 2222" },
    { id: "bk3", nombre: "Luis Gómez", email: "luis@example.com", telefono: "+502 5555 3333" },
  ];

  const estados = ["pendiente", "en_proceso", "pagado", "completado", "cancelado"];

  data = Array.from({ length: 8 }).map((_, i) => {
    const itemsPhotos = randPick(mine, Math.floor(Math.random() * 3) + 1);
    const items = itemsPhotos.map((ph, idx) => {
      const fallback = `IMG_${1000 + i * 10 + idx}.jpg`;
      const fileName =
        typeof ph.url === "string" ? ph.url.split("/").pop().split("?")[0] : fallback;
      return {
        photoId: ph.id || `${ph.photographerId}-${ph.hotspotId}-${ph.timestamp}`,
        url: ph.url,
        hotspotId: ph.hotspotId,
        timestamp: ph.timestamp,
        price: 35 + Math.floor(Math.random() * 25),
        fileName,
      };
    });
    const total = items.reduce((s, it) => s + it.price, 0);
    const buyer = buyers[i % buyers.length];

    return {
      id: "OR" + (20250 + i),
      fecha: new Date(Date.now() - i * 86400000).toISOString(),
      estado: estados[i % estados.length],
      biker: buyer,
      items,
      total,
      mensajes: [],
      entregas: [],
    };
  });

  saveOrders(data);
  return data;
}

export default function StudioPedidos() {
  const [orders, setOrders] = useState(() => seedIfEmpty());
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("todos");
  const [mes, setMes] = useState("todos"); // YYYY-MM
  const [orderBy, setOrderBy] = useState("recientes"); // recientes|antiguos

  useEffect(() => saveOrders(orders), [orders]);

  const months = useMemo(() => {
    const set = new Set(orders.map((o) => o.fecha.slice(0, 7)));
    const arr = Array.from(set);
    arr.sort((a, b) => (a < b ? 1 : -1));
    return ["todos", ...arr];
  }, [orders]);

  const filtered = useMemo(() => {
    let out = orders
      .filter((o) => (status === "todos" ? true : o.estado === status))
      .filter((o) => (mes === "todos" ? true : o.fecha.startsWith(mes)))
      .filter((o) => {
        const needle = q.trim().toLowerCase();
        if (!needle) return true;
        return (
          o.id.toLowerCase().includes(needle) ||
          o.biker?.nombre?.toLowerCase().includes(needle) ||
          o.biker?.email?.toLowerCase().includes(needle)
        );
      });

    out.sort((a, b) =>
      orderBy === "recientes" ? (a.fecha < b.fecha ? 1 : -1) : (a.fecha > b.fecha ? 1 : -1)
    );
    return out;
  }, [orders, q, status, mes, orderBy]);

  const activos = filtered.filter((o) => o.estado !== "completado");
  const completados = filtered.filter((o) => o.estado === "completado");

  return (
    <main className="w-full max-w-[1100px] mx-auto px-5 py-6 lg:py-8">
      <div className="mb-3">
        <h1 className="text-2xl md:text-3xl font-display font-black">Pedidos</h1>
        <p className="text-slate-300 text-sm">Revisá tus pedidos activos y accedé al detalle de cada pedido.</p>
      </div>

      {/* Filtros (estilo similar al biker) */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-[1fr_220px_220px_220px] gap-3">
        <input
          className="h-10 rounded-lg border border-white/15 bg-white/5 text-white px-3 placeholder-white/50"
          placeholder="Buscar por #pedido, cliente o correo…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="h-10 rounded-lg border border-white/15 bg-white/5 text-white px-3"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="todos">Todos</option>
          {STATUS.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-lg border border-white/15 bg-white/5 text-white px-3"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {m === "todos"
                ? "Todos los meses"
                : new Date(m + "-01").toLocaleDateString("es-GT", { month: "long", year: "numeric" })}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-lg border border-white/15 bg-white/5 text-white px-3"
          value={orderBy}
          onChange={(e) => setOrderBy(e.target.value)}
        >
          <option value="recientes">Más recientes</option>
          <option value="antiguos">Más antiguos</option>
        </select>
      </div>

      {/* Tabla de pedidos ACTIVOS */}
      <OrdersTable orders={activos} emptyLabel="Sin pedidos activos con estos filtros." />

      {/* Historial de COMPLETADOS */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-2">Historial de pedidos completados</h2>
        <OrdersTable orders={completados} emptyLabel="Aún no tenés pedidos completados para estos filtros." />
      </div>
    </main>
  );
}

/* =================== Subcomponentes =================== */

function OrdersTable({ orders, emptyLabel }) {
  if (!orders.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-slate-300">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="hidden md:grid md:grid-cols-[160px_150px_140px_140px_100px_1fr_120px] bg-white/[0.03] text-slate-300 text-sm px-4 py-2">
        <div># Pedido</div>
        <div>Fecha</div>
        <div>Estado</div>
        <div>Pago</div>
        <div>Fotos</div>
        <div>Cliente</div>
        <div></div>
      </div>

      {/* Rows */}
      {orders.map((o) => (
        <div
          key={o.id}
          className="grid grid-cols-1 md:grid-cols-[160px_150px_140px_140px_100px_1fr_120px] items-center border-t border-white/10 px-4 py-3 gap-2"
        >
          <div className="font-semibold">{o.id}</div>
          <div className="text-sm text-slate-300">{fmtDate(o.fecha)}</div>
          <div>
            <span className={`px-2 py-0.5 rounded-full border text-xs ${statusChipCls(o.estado)}`}>
              {STATUS_LABEL[o.estado]}
            </span>
          </div>
          <div className="text-sm">
            <div>
              <span className={`px-2 py-0.5 rounded-full border text-xs ${paymentChipCls(o.estado)}`}>
                {paymentLabel(o.estado)}
              </span>
            </div>
            <div className="mt-1 font-medium">{currency(o.total)}</div>
          </div>
          <div className="font-medium">{o.items.length}</div>
          <div className="text-sm">
            <div className="font-medium truncate">{o.biker?.nombre}</div>
            <div className="text-slate-400 truncate">{o.biker?.email}</div>
          </div>
          <div className="flex md:justify-end">
            <Link
              to={`/studio/pedidos/${o.id}`}
              className="h-9 px-3 rounded-xl bg-blue-500 text-white font-display font-bold inline-flex items-center justify-center"
            >
              Ver
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
