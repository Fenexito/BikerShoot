// src/routes/biker/index.jsx
import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { photographers } from "../../data/photographers";
import {
  orders,
  ORDER_STATUS,
  PAYMENT_STATUS,
  orderTotals,
} from "../../data/orders";
import { events } from "../../data/events";

export default function BikerHome() {
  const nav = useNavigate();

  // KPIs simples (mock)
  const activos = orders.filter((o) =>
    [ORDER_STATUS.PENDIENTE, ORDER_STATUS.EN_PROCESO, ORDER_STATUS.PAGADO].includes(o.estado)
  ).length;

  const fotosEsteMes = useMemo(() => {
    const now = new Date();
    const m = now.getMonth(), y = now.getFullYear();
    return orders
      .filter((o) => {
        const d = new Date(o.fecha);
        return d.getMonth() === m && d.getFullYear() === y;
      })
      .reduce((acc, o) => acc + orderTotals(o).totalFotos, 0);
  }, []);

  const progresoPerfil = 70; // mock de onboarding

  const ultimosPedidos = useMemo(() => {
    return orders
      .slice()
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, 3);
  }, []);

  const recomendados = useMemo(() => {
    return photographers
      .slice()
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 6);
  }, []);

  const fotosRecientes = useMemo(() => {
    // Tomamos primeras imágenes de portafolios como demo
    return photographers.flatMap((p) => (p.portafolio || []).slice(0, 1)).slice(0, 8);
  }, []);

  // Eventos PASADOS (los más recientes primero)
  const eventosPasados = useMemo(() => {
    const ahora = new Date();
    return events
      .filter((e) => new Date(e.fecha) < ahora)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, 4);
  }, []);

  return (
    <main className="max-w-7xl mx-auto px-5 py-8">
      {/* HERO (sin barra de búsqueda) */}
      <section className="rounded-3xl bg-white shadow-card border border-slate-100 p-6 md:p-8 mb-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex items-center gap-4">
            <img
              src="/images/default-avatar.png"
              alt="Avatar"
              className="w-16 h-16 rounded-full object-cover border-4 border-blue-600"
            />
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold">
                ¡Qué pedo, Rider! 👋
              </h1>
              <p className="text-slate-500">
                Aquí tenés tu panel con todo lo que necesitás al chilazo.
              </p>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-3 gap-3 md:ml-auto">
            <KPI title="Pedidos activos" value={String(activos)} />
            <KPI title="Fotos este mes" value={String(fotosEsteMes)} />
            <KPI title="Perfil" value={`${progresoPerfil}%`} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <QuickAction to="/app/fotografos">Explorar fotógrafos</QuickAction>
          <QuickAction to="/eventos">Ver eventos</QuickAction>
          <QuickAction to="/app/historial">Mis pedidos</QuickAction>
          <QuickAction to="/app/perfil">Mi perfil</QuickAction>
        </div>
      </section>

      {/* GRID PRINCIPAL */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda (principal) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Notificaciones ARRIBA */}
          <Card title="Notificaciones">
            <div className="space-y-3 text-sm">
              <Notif text="Tu pedido ORD-2025-00018 fue completado. ¡Ya podés descargar!" />
              <Notif text="Ráfaga Pro te envió un mensaje: 'Fotos listas mañana 👌'." />
              <Notif text="Nuevo evento agregado a tu historial." />
            </div>
          </Card>

          {/* Pedidos recientes */}
          <Card title="Seguimiento de tus pedidos">
            <div className="grid gap-3">
              {ultimosPedidos.map((o) => (
                <OrderRow key={o.id} order={o} onOpen={() => nav(`/app/historial/${o.id}`)} />
              ))}
            </div>
            <div className="mt-4 text-right">
              <Link
                to="/app/historial"
                className="inline-flex items-center gap-2 text-blue-600 font-medium"
              >
                Ver todo →
              </Link>
            </div>
          </Card>

          {/* Recomendados */}
          <Card title="Recomendados para vos">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {recomendados.map((p) => (
                <StudioCard key={p.id} p={p} onOpen={() => nav(`/app/fotografos/${p.id}`)} />
              ))}
            </div>
          </Card>

          {/* Fotos recientes */}
          <Card title="Tus fotos recientes">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {fotosRecientes.map((src, i) => (
                <div key={i} className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100">
                  <img src={src} alt={`foto ${i + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition" />
                  <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition">
                    <button className="px-3 py-1 rounded-lg bg-white text-slate-800 text-sm font-display">
                      Descargar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Columna derecha */}
        <div className="space-y-6">
          {/* Checklist de perfil HASTA ARRIBA */}
          <Card title="Checklist de perfil">
            <Checklist progreso={progresoPerfil} />
          </Card>

          {/* Eventos PASADOS */}
          <Card title="Eventos pasados">
            {eventosPasados.length === 0 ? (
              <div className="text-sm text-slate-500">Aún no hay eventos en tu historial.</div>
            ) : (
              <>
                <div className="space-y-3">
                  {eventosPasados.map((ev) => (
                    <EventItem key={ev.id} ev={ev} />
                  ))}
                </div>
                <div className="mt-4 text-right">
                  <Link to="/eventos" className="text-blue-600 font-medium">
                    Ver todos →
                  </Link>
                </div>
              </>
            )}
          </Card>

          {/* Mapa mini */}
          <Card title="Descubrí spots y estudios">
            <div className="h-48 rounded-xl bg-slate-100 grid place-items-center text-slate-500">
              [Mapa interactivo pronto 🔜]
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Estudios populares cerca de vos</span>
                <Link to="/app/fotografos" className="text-blue-600">Ver</Link>
              </div>
              <ul className="list-disc pl-5 text-slate-600">
                <li>Luz y Motor Studio (Zona 10)</li>
                <li>Ráfaga Pro Shots (Antigua)</li>
                <li>Asfalto & Flash (Xela)</li>
              </ul>
            </div>
          </Card>

          {/* Promos */}
          <Card title="Promos y recompensas">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="font-display font-bold">Invitá a un cuate y ganá Q25</div>
              <p className="text-sm text-slate-600 mt-1">
                Compartí tu código y ambos reciben crédito para su próxima compra.
              </p>
              <button className="mt-3 h-10 px-4 rounded-xl bg-blue-600 text-white font-display font-bold">
                Compartir código
              </button>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}

/* ============== Subcomponentes ============== */

function KPI({ title, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="text-lg font-display font-bold">{value}</div>
    </div>
  );
}

function QuickAction({ to, children }) {
  return (
    <Link
      to={to}
      className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm hover:bg-slate-50"
    >
      {children}
    </Link>
  );
}

function Card({ title, children }) {
  return (
    <section className="rounded-2xl bg-white border border-slate-100 shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </section>
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
    <span
      className={`px-2 py-1 rounded-full text-xs ${map[status] || "bg-slate-100 text-slate-700 border border-slate-200"}`}
    >
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
    <span
      className={`px-2 py-1 rounded-full text-[11px] ${map[status] || "bg-slate-100 text-slate-700 border border-slate-200"}`}
    >
      {status}
    </span>
  );
}

function OrderRow({ order, onOpen }) {
  const { totalFotos, totalQ } = orderTotals(order);
  const puedePagar = [PAYMENT_STATUS.PENDIENTE, PAYMENT_STATUS.FALLIDO].includes(order.pagoEstado);

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 flex items-center justify-between gap-3">
      <div>
        <div className="text-xs text-slate-500">Pedido</div>
        <div className="font-medium">{order.id}</div>
        <div className="text-xs text-slate-500">{formatDate(order.fecha)}</div>
      </div>

      <div className="hidden sm:flex items-center gap-3">
        <StatusBadge status={order.estado} />
        <PaymentBadge status={order.pagoEstado} />
      </div>

      <div className="text-right">
        <div className="text-xs text-slate-500">Total</div>
        <div className="font-display font-bold">{formatQ(totalQ)}</div>
        <div className="text-xs text-slate-500">{totalFotos} fotos</div>
      </div>

      <div className="flex items-center gap-2">
        {puedePagar && (
          <button className="h-10 px-3 rounded-xl bg-blue-600 text-white font-display font-bold">
            Pagar ahora
          </button>
        )}
        <button
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-display font-bold"
          onClick={onOpen}
        >
          Ver detalle
        </button>
      </div>
    </div>
  );
}

function StudioCard({ p, onOpen }) {
  return (
    <article className="rounded-xl border border-slate-100 overflow-hidden bg-white">
      <div className="aspect-[16/9] overflow-hidden">
        <img src={p.portada} alt={p.estudio} className="w-full h-full object-cover" />
      </div>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <img
            src={p.avatar}
            alt={p.estudio}
            className="w-10 h-10 rounded-full border-2 border-white -mt-8 shadow"
          />
          <div className="flex-1">
            <div className="font-semibold">{p.estudio}</div>
            <div className="text-xs text-slate-500">{p.ubicacion}</div>
          </div>
          <div className="text-yellow-500 text-sm font-semibold">★ {p.rating.toFixed(1)}</div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(p.estilos || []).slice(0, 3).map((tag) => (
            <span key={tag} className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-slate-500">Desde</div>
          <div className="font-display font-bold">Q{p.precios?.[0]?.precio ?? "—"}</div>
        </div>

        <button
          className="mt-3 w-full h-10 rounded-xl bg-blue-600 text-white font-display font-bold"
          onClick={onOpen}
        >
          Ver perfil
        </button>
      </div>
    </article>
  );
}

function EventItem({ ev }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 flex gap-3">
      <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100">
        <img src={ev.cover} alt={ev.titulo} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{ev.titulo}</div>
        <div className="text-xs text-slate-500 truncate">
          {formatDateDay(ev.fecha)} · {ev.ubicacion}
        </div>
        <div className="mt-1 text-xs inline-flex px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
          {ev.tipo}
        </div>
      </div>
    </div>
  );
}

function Checklist({ progreso }) {
  const items = [
    { label: "Completar información personal", done: true },
    { label: "Agregar mi motocicleta", done: true },
    { label: "Conectar Instagram o Facebook", done: false },
    { label: "Subir una foto de perfil", done: false },
  ];
  return (
    <>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-600" style={{ width: `${progreso}%` }} />
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className={`w-5 h-5 grid place-items-center rounded-full text-white text-xs ${
                it.done ? "bg-green-500" : "bg-slate-300"
              }`}
            >
              {it.done ? "✓" : "•"}
            </span>
            <span className={it.done ? "line-through text-slate-400" : ""}>{it.label}</span>
          </li>
        ))}
      </ul>
      <button className="mt-3 h-10 px-4 rounded-xl bg-blue-600 text-white font-display font-bold">
        Completar ahora
      </button>
    </>
  );
}

function Notif({ text }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">{text}</div>
  );
}

/* ============== Utils ============== */

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
function formatDateDay(iso) {
  try {
    return new Date(iso).toLocaleDateString("es-GT", {
      weekday: "short",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}
