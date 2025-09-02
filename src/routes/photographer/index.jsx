import React, { useMemo, useState } from "react";

/**
 * INICIO (Studio) — Resumen compacto
 * - KPIs pequeños
 * - Accesos rápidos
 * - Pedidos activos
 * - Eventos recientes
 * - Notificaciones
 * (Las estadísticas heavy viven en /studio/estadisticas)
 */

export default function StudioHome() {
  const [range] = useState("7d");

  // Data demo resumida
  const stats = useMemo(
    () => ({
      ingresosMes: 2150.75, // Q
      pedidosActivos: 4,
      fotosSemana: 368,
    }),
    []
  );

  const pedidos = [
    {
      id: "ORD-1093",
      biker: "José Pérez",
      telefono: "+502 5511 2233",
      total: 150,
      estado: "pagado",
      items: 3,
      evento: "Domingo 18 Ago",
      punto: "Puente Viejo",
      hora: "07:42",
    },
    {
      id: "ORD-1094",
      biker: "María López",
      telefono: "+502 4411 8822",
      total: 50,
      estado: "en_proceso",
      items: 1,
      evento: "Domingo 18 Ago",
      punto: "Curva KM 23",
      hora: "08:05",
    },
    {
      id: "ORD-1095",
      biker: "Carlos Díaz",
      telefono: "+502 5522 9911",
      total: 90,
      estado: "pendiente",
      items: 2,
      evento: "Domingo 18 Ago",
      punto: "Mirador Este",
      hora: "07:18",
    },
    {
      id: "ORD-1096",
      biker: "Ana Gómez",
      telefono: "+502 5588 4422",
      total: 120,
      estado: "pagado",
      items: 2,
      evento: "Domingo 11 Ago",
      punto: "Curva KM 23",
      hora: "07:55",
    },
  ];

  const eventos = [
    { id: "EV-18-08", nombre: "Domingo 18 Ago 2025", ruta: "Carretera a El Salvador", puntos: 3, fotos: 1820, estado: "Borrador" },
    { id: "EV-11-08", nombre: "Domingo 11 Ago 2025", ruta: "Ruta al Atlántico", puntos: 2, fotos: 1465, estado: "Publicado" },
    { id: "EV-04-08", nombre: "Domingo 4 Ago 2025", ruta: "Interamericana", puntos: 3, fotos: 2010, estado: "Publicado" },
  ];

  const notifs = [
    { id: 1, text: "Tenés 2 pedidos pagados listos para entrega.", when: "hace 12 min" },
    { id: 2, text: "Nuevo mensaje de José Pérez sobre orden ORD-1093.", when: "hace 1 h" },
    { id: 3, text: "Tu evento del 18 Ago aún está en borrador.", when: "hace 3 h" },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-6 text-slate-100">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl md:text-3xl font-display font-black">Panel del Estudio</h1>
        <div className="ml-auto flex items-center gap-2">
          <a href="/studio/estadisticas" className="h-10 px-4 rounded-xl border border-white/15 bg-white/5 text-white font-display font-bold inline-flex items-center justify-center">
            Ver estadísticas
          </a>
          <a href="/studio/eventos" className="h-10 px-4 rounded-xl bg-blue-600 text-white font-display font-bold inline-flex items-center justify-center">
            Crear evento
          </a>
        </div>
      </div>

      {/* KPIs compactos */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiMini title="Ingresos del mes" value={`Q${stats.ingresosMes.toFixed(2)}`} />
        <KpiMini title="Pedidos activos" value={stats.pedidosActivos} />
        <KpiMini title="Fotos esta semana" value={stats.fotosSemana} />
      </section>

      {/* Acciones + Notificaciones */}
      <section className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 mb-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="font-semibold mb-3">Atajos</h3>
          <div className="grid grid-cols-2 gap-3">
            <Shortcut href="/studio/eventos" label="Nuevo evento" />
            <Shortcut href="/studio/carga-rapida" label="Subir fotos" />
            <Shortcut href="/studio/pedidos" label="Ver pedidos" />
            <Shortcut href="/studio/perfil" label="Mi perfil" />
          </div>

          <div className="mt-5">
            <div className="mb-2 font-semibold">Notificaciones</div>
            <div className="space-y-2">
              {notifs.map((n) => (
                <div key={n.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-sm">{n.text}</div>
                  <div className="text-[11px] text-white/60">{n.when}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pedidos activos */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Pedidos activos</h3>
            <a href="/studio/pedidos" className="text-blue-400 font-medium">Ver todos</a>
          </div>

          <div className="space-y-3">
            {pedidos.map((o) => (
              <div key={o.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs border ${statusCls(o.estado)}`}>
                    {statusLabel(o.estado)}
                  </span>
                  <div className="ml-auto text-sm text-white/80 font-medium">{o.id}</div>
                </div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <div className="text-xs text-white/60">Cliente</div>
                    <div className="text-sm">{o.biker}</div>
                    <div className="text-xs text-white/60">{o.telefono}</div>
                  </div>
                  <div>
                    <div className="text-xs text-white/60">Evento / Punto</div>
                    <div className="text-sm">{o.evento}</div>
                    <div className="text-xs text-white/60">{o.punto} · {o.hora}</div>
                  </div>
                  <div className="md:text-right">
                    <div className="text-xs text-white/60">Total</div>
                    <div className="text-sm font-semibold">Q{o.total.toFixed(2)}</div>
                    <div className="text-xs text-white/60">Items: {o.items}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end">
                  <a
                    href={`/studio/pedidos?ver=${o.id}`}
                    className="h-9 px-3 rounded-lg bg-blue-600 text-white font-display font-bold inline-flex items-center justify-center"
                  >
                    Ver
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Eventos recientes */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Eventos recientes</h3>
          <a href="/studio/eventos" className="text-blue-400 font-medium">Ver todos</a>
        </div>
        <div className="space-y-3">
          {eventos.map((ev) => (
            <div key={ev.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-2">
                <div className="font-medium">{ev.nombre}</div>
                <span className="ml-auto text-xs text-white/60">{ev.ruta}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
                <div><span className="text-white/60">Puntos:</span> {ev.puntos}</div>
                <div><span className="text-white/60">Fotos:</span> {ev.fotos}</div>
                <div className="text-right"><StatusBadge label={ev.estado} /></div>
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <a href={`/studio/eventos?open=${ev.id}`} className="h-9 px-3 rounded-lg border border-white/15 bg-white/5 text-white">
                  Abrir
                </a>
                <a href={`/studio/eventos?open=${ev.id}&tab=subir`} className="h-9 px-3 rounded-lg bg-blue-600 text-white font-display font-bold">
                  Subir fotos
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

/* ================== Subcomponentes compactos ================== */

function KpiMini({ title, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs text-white/70">{title}</div>
      <div className="mt-1 text-xl font-display font-bold text-white">{value}</div>
    </div>
  );
}

function Shortcut({ href, label }) {
  return (
    <a
      href={href}
      className="rounded-xl border border-white/10 bg-white/5 p-3 text-center hover:bg-white/10 transition"
    >
      <div className="font-display font-bold">{label}</div>
    </a>
  );
}

function StatusBadge({ label }) {
  const cls =
    label === "Publicado"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
      : "bg-slate-500/20 text-slate-300 border-slate-500/30";
  return <span className={`px-2 py-0.5 rounded-full text-xs border ${cls}`}>{label}</span>;
}

function statusLabel(s) {
  return s === "pagado"
    ? "Pagado"
    : s === "en_proceso"
    ? "En proceso"
    : s === "pendiente"
    ? "Pendiente"
    : s === "completado"
    ? "Completado"
    : "Cancelado";
}
function statusCls(s) {
  return s === "pagado"
    ? "bg-sky-500/20 text-sky-300 border-sky-500/30"
    : s === "en_proceso"
    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
    : s === "pendiente"
    ? "bg-slate-500/20 text-slate-300 border-slate-500/30"
    : s === "completado"
    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
    : "bg-red-500/20 text-red-300 border-red-500/30";
}
