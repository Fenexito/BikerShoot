import React, { useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  getOrderById,
  ORDER_STATUS,
  PAYMENT_STATUS,
  resolvePhotographerName,
  resolvePhotographerLink,
  orderTotals,
} from "../../data/orders";

export default function BikerOrderDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const order = useMemo(() => getOrderById(id), [id]);

  if (!order) {
    return (
      <main className="max-w-5xl mx-auto px-5 py-8">
        <p className="text-slate-500">No se encontró el pedido.</p>
        <button
          className="mt-4 h-10 px-4 rounded-xl bg-blue-600 text-white font-display font-bold"
          onClick={() => nav("/app/historial")}
        >
          Volver al historial
        </button>
      </main>
    );
  }

  const { totalFotos, totalQ } = orderTotals(order);
  const puedeEditar = [ORDER_STATUS.PENDIENTE, ORDER_STATUS.EN_PROCESO].includes(order.estado);
  const puedePagar = [PAYMENT_STATUS.PENDIENTE, PAYMENT_STATUS.FALLIDO].includes(order.pagoEstado);
  const puedeDescargar = order.estado === ORDER_STATUS.COMPLETADO && order.pagoEstado === PAYMENT_STATUS.PAGADO;

  return (
    <main className="max-w-5xl mx-auto px-5 py-8">
      <button className="mb-4 text-sm text-blue-600 hover:underline" onClick={() => nav(-1)}>
        ← Regresar
      </button>

      {/* Header pedido */}
      <section className="rounded-2xl border border-slate-100 bg-white p-5 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold">Pedido {order.id}</h1>
            <div className="text-slate-500">{formatDate(order.fecha)}</div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={order.estado} />
            <PaymentBadge status={order.pagoEstado} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <Info label="Total a pagar" value={formatQ(totalQ)} />
          <Info label="Total de fotos" value={String(totalFotos)} />
          <Info label="Método de pago" value={order.pagoMetodo || "—"} />
          <Info label="Notas" value={order.notas || "—"} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {puedePagar && (
            <button className="h-10 px-4 rounded-xl bg-blue-600 text-white font-display font-bold">
              Pagar ahora
            </button>
          )}
          {puedeEditar && (
            <button className="h-10 px-4 rounded-xl bg-slate-200 text-slate-800 font-display font-bold">
              Editar pedido
            </button>
          )}
          {puedeDescargar && (
            <button className="h-10 px-4 rounded-xl bg-emerald-600 text-white font-display font-bold">
              Descargar fotos
            </button>
          )}
        </div>
      </section>

      {/* Items agrupados por fotógrafo */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Contenido del pedido</h2>
        {order.items.map((it, idx) => (
          <article key={idx} className="rounded-xl border border-slate-100 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-slate-500">Fotógrafo</div>
                <Link
                  to={resolvePhotographerLink(it.photographerId)}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {resolvePhotographerName(it.photographerId)}
                </Link>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-500">Subtotal</div>
                <div className="font-display font-bold">{formatQ(it.precio)}</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Info label="Fotos" value={String(it.fotos)} />
              <Info label="Entrega" value={order.estado === ORDER_STATUS.COMPLETADO ? "Disponible" : "En preparación"} />
              <Info label="Estado del pago" value={order.pagoEstado} />
              <Info label="Método" value={order.pagoMetodo || "—"} />
            </div>

            {puedeEditar && (
              <div className="mt-3 flex gap-2">
                <button className="h-9 px-3 rounded-lg bg-white text-slate-800 border border-slate-200 font-display">
                  Cambiar cantidad
                </button>
                <button className="h-9 px-3 rounded-lg bg-white text-rose-600 border border-rose-200 font-display">
                  Quitar del pedido
                </button>
              </div>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}

/** Subcomponentes */
function Info({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-slate-800">{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    CANCELADO: "bg-rose-100 text-rose-700 border border-rose-200",
    PENDIENTE: "bg-amber-100 text-amber-700 border border-amber-200",
    EN_PROCESO: "bg-sky-100 text-sky-700 border border-sky-200",
    PAGADO: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    COMPLETADO: "bg-green-100 text-green-700 border border-green-200",
    REEMBOLSADO: "bg-slate-100 text-slate-700 border border-slate-200",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs ${map[status] || "bg-slate-100 text-slate-700 border border-slate-200"}`}>
      {status}
    </span>
  );
}

function PaymentBadge({ status }) {
  const map = {
    PENDIENTE: "bg-amber-100 text-amber-700 border border-amber-200",
    PAGADO: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    FALLIDO: "bg-rose-100 text-rose-700 border border-rose-200",
    REEMBOLSADO: "bg-slate-100 text-slate-700 border border-slate-200",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs ${map[status] || "bg-slate-100 text-slate-700 border border-slate-200"}`}>
      {status}
    </span>
  );
}

function formatQ(n) {
  try {
    return new Intl.NumberFormat("es-GT", {
      style: "currency",
      currency: "GTQ",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `Q${n}`;
  }
}
function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("es-GT", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
