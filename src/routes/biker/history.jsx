import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  orders,
  ORDER_STATUS,
  PAYMENT_STATUS,
  resolvePhotographerName,
  orderTotals,
} from "../../data/orders";

export default function BikerHistory() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("Todos");
  const [orden, setOrden] = useState("fecha_desc");

  const estados = useMemo(
    () => ["Todos", ...Object.values(ORDER_STATUS)],
    []
  );

  const listado = useMemo(() => {
    let arr = orders.slice();

    // Buscar por No. pedido o nombre de estudio
    if (q.trim()) {
      const t = q.toLowerCase();
      arr = arr.filter((o) => {
        const { totalFotos } = orderTotals(o);
        const estudios = o.items.map((it) => resolvePhotographerName(it.photographerId)).join(" ");
        return (
          o.id.toLowerCase().includes(t) ||
          estudios.toLowerCase().includes(t) ||
          String(totalFotos).includes(t)
        );
      });
    }

    // Filtro por estado
    if (estado !== "Todos") {
      arr = arr.filter((o) => o.estado === estado);
    }

    // Orden
    if (orden === "fecha_desc") {
      arr.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    } else if (orden === "fecha_asc") {
      arr.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    } else if (orden === "total_desc") {
      arr.sort((a, b) => orderTotals(b).totalQ - orderTotals(a).totalQ);
    } else if (orden === "total_asc") {
      arr.sort((a, b) => orderTotals(a).totalQ - orderTotals(b).totalQ);
    }

    return arr;
  }, [q, estado, orden]);

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-bold">Historial de pedidos</h1>
        <p className="text-slate-500">
          Revisá tus compras recientes y accedé al detalle de cada pedido.
        </p>
      </header>

      {/* Controles */}
      <section className="mb-5 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <input
            className="w-full h-11 border rounded-lg px-3"
            placeholder="Buscar por #pedido, estudio o cantidad de fotos…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <select
          className="h-11 border rounded-lg px-3"
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
        >
          {estados.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          className="h-11 border rounded-lg px-3"
          value={orden}
          onChange={(e) => setOrden(e.target.value)}
        >
          <option value="fecha_desc">Más recientes</option>
          <option value="fecha_asc">Más antiguos</option>
          <option value="total_desc">Total más alto</option>
          <option value="total_asc">Total más bajo</option>
        </select>
      </section>

      {/* Tabla desktop / cards móvil */}
      <div className="hidden md:block">
        <table className="w-full text-sm border border-slate-100 rounded-xl overflow-hidden">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <Th># Pedido</Th>
              <Th>Fecha</Th>
              <Th>Estado</Th>
              <Th>Pago</Th>
              <Th>Fotos</Th>
              <Th>Fotógrafo(s)</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {listado.map((o) => {
              const { totalFotos, totalQ } = orderTotals(o);
              const estudios = o.items
                .map((it) => resolvePhotographerName(it.photographerId))
                .slice(0, 2)
                .join(" · ");
              const extras =
                o.items.length > 2 ? ` +${o.items.length - 2}` : "";

              return (
                <tr key={o.id} className="border-t border-slate-100">
                  <Td className="font-medium">{o.id}</Td>
                  <Td>{formatDate(o.fecha)}</Td>
                  <Td>
                    <StatusBadge status={o.estado} />
                  </Td>
                  <Td>
                    <PaymentBadge status={o.pagoEstado} />
                    <div className="text-slate-700 font-medium">
                      {formatQ(totalQ)}
                    </div>
                  </Td>
                  <Td>{totalFotos}</Td>
                  <Td className="truncate">
                    {estudios}
                    {extras}
                  </Td>
                  <Td className="text-right">
                    <button
                      className="h-9 px-3 rounded-lg bg-blue-600 text-white font-display font-bold"
                      onClick={() => nav(`/app/historial/${o.id}`)}
                    >
                      Ver detalle
                    </button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cards móvil */}
      <section className="md:hidden space-y-3">
        {listado.map((o) => {
          const { totalFotos, totalQ } = orderTotals(o);
          const estudios = o.items
            .map((it) => resolvePhotographerName(it.photographerId))
            .slice(0, 2)
            .join(" · ");
          const extras = o.items.length > 2 ? ` +${o.items.length - 2}` : "";

          return (
            <article
              key={o.id}
              className="rounded-2xl border border-slate-100 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500">Pedido</div>
                  <div className="font-medium">{o.id}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {formatDate(o.fecha)}
                  </div>
                </div>
                <StatusBadge status={o.estado} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-slate-500">Pago</div>
                  <div className="flex items-center gap-2">
                    <PaymentBadge status={o.pagoEstado} />
                    <span className="font-medium">{formatQ(totalQ)}</span>
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Fotos</div>
                  <div className="font-medium">{totalFotos}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-slate-500">Fotógrafo(s)</div>
                  <div className="font-medium truncate">
                    {estudios}
                    {extras}
                  </div>
                </div>
              </div>

              <button
                className="mt-3 w-full h-10 rounded-xl bg-blue-600 text-white font-display font-bold"
                onClick={() => nav(`/app/historial/${o.id}`)}
              >
                Ver detalle
              </button>
            </article>
          );
        })}
      </section>
    </main>
  );
}

/** Helpers UI */
function Th({ children }) {
  return <th className="text-left px-4 py-3">{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
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
    <span className={`px-2 py-0.5 rounded-full text-[11px] ${map[status] || "bg-slate-100 text-slate-700 border border-slate-200"}`}>
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
    });
  } catch {
    return iso;
  }
}
