import React, { useMemo, useState } from "react";

/**
 * ESTADÍSTICAS (Studio)
 * - Filtros de rango
 * - Ingresos (línea)
 * - Conversión (funnel)
 * - Pedidos por estado (barra apilada)
 * - Actividad por hora/día (heatmap)
 * - Ingresos por evento (barras)
 * - Hotspots top + Almacenamiento
 * - Export (placeholder)
 */

export default function StudioEstadisticas() {
  const [range, setRange] = useState("30d"); // 7d | 30d | 90d
  const [view, setView] = useState("dia");   // dia | semana

  // ====== Datos demo ======
  const ingresosDia = useMemo(
    () =>
      range === "7d"
        ? [150, 210, 180, 260, 230, 320, 280]
        : range === "30d"
        ? [
            80, 120, 95, 160, 110, 150, 170, 140, 180, 200,
            220, 190, 210, 250, 230, 260, 240, 300, 270, 310,
            290, 330, 310, 350, 360, 340, 380, 370, 390, 410,
          ]
        : // 90d demo
          Array.from({ length: 90 }, (_, i) => 100 + Math.round(Math.sin(i / 5) * 60 + 200 + (i % 7) * 5)),
    [range]
  );

  // Resumen rápido
  const resumen = useMemo(
    () => ({
      ingresosTotal: ingresosDia.reduce((a, b) => a + b, 0),
      pedidos: 126,
      conversion: 18, // %
      ticketMedio: 72.5,
    }),
    [ingresosDia]
  );

  // Funnel de conversión
  const funnel = { visitas: 8200, vistas: 4200, carrito: 1200, pagos: 820 };

  // Estados de pedidos
  const estados = {
    pendiente: 22,
    en_proceso: 18,
    pagado: 54,
    completado: 25,
    cancelado: 7,
  };

  // Heatmap actividad [día][hora]
  const heatmap = useMemo(() => {
    const m = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    for (let d = 0; d < 7; d++) {
      for (let h = 6; h <= 12; h++) {
        m[d][h] = Math.round(Math.random() * 8 + (12 - Math.abs(9 - h)) * 1.5);
      }
      for (let h = 13; h <= 17; h++) {
        m[d][h] = Math.round(Math.random() * 5);
      }
    }
    return m;
  }, [range]);

  // Ingresos por evento
  const ingresosEventos = [
    { id: "EV-18-08", nombre: "18 Ago", ingresos: 14650 },
    { id: "EV-11-08", nombre: "11 Ago", ingresos: 12800 },
    { id: "EV-04-08", nombre: "04 Ago", ingresos: 15320 },
    { id: "EV-28-07", nombre: "28 Jul", ingresos: 13210 },
    { id: "EV-21-07", nombre: "21 Jul", ingresos: 12540 },
  ];

  // Hotspots top
  const hotspots = [
    { id: "pt2", nombre: "Puente Viejo", eventos: 8, fotos: 9200, convers: 21 },
    { id: "pt1", nombre: "Curva KM 23", eventos: 10, fotos: 11250, convers: 17 },
    { id: "pt4", nombre: "Mirador Este", eventos: 6, fotos: 6400, convers: 14 },
    { id: "pt5", nombre: "Gasolinera Norte", eventos: 5, fotos: 5200, convers: 12 },
  ];

  const storage = { used: 62, total: 100 };

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-6 text-slate-100">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl md:text-3xl font-display font-black">Estadísticas</h1>
        <div className="ml-auto flex items-center gap-2">
          <RangeButton current={range} value="7d" onClick={setRange}>7 días</RangeButton>
          <RangeButton current={range} value="30d" onClick={setRange}>30 días</RangeButton>
          <RangeButton current={range} value="90d" onClick={setRange}>90 días</RangeButton>
          <button className="h-10 px-4 rounded-xl border border-white/15 bg-white/5 text-white font-display font-bold">Exportar CSV</button>
        </div>
      </div>

      {/* Resumen */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="Ingresos (rango)" value={`Q${resumen.ingresosTotal.toFixed(2)}`} />
        <KpiCard title="Pedidos" value={resumen.pedidos} />
        <KpiCard title="Conversión" value={`${resumen.conversion}%`} />
        <KpiCard title="Ticket medio" value={`Q${resumen.ticketMedio.toFixed(2)}`} />
      </section>

      {/* Ingresos + Conversión */}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 mb-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Ingresos</h3>
            <div className="flex gap-1">
              <Toggle current={view} value="dia" onClick={setView}>Diario</Toggle>
              <Toggle current={view} value="semana" onClick={setView}>Semanal</Toggle>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <LineChart data={view === "dia" ? ingresosDia : toWeekly(ingresosDia)} height={160} />
            <div className="mt-3 grid grid-cols-3 gap-3">
              <MiniStat label="Promedio" value={`Q${avg(ingresosDia).toFixed(2)}`} />
              <MiniStat label="Máximo" value={`Q${Math.max(...ingresosDia).toFixed(2)}`} />
              <MiniStat label="Mínimo" value={`Q${Math.min(...ingresosDia).toFixed(2)}`} />
            </div>
          </div>
        </div>

        {/* Funnel (embudo) */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="font-semibold mb-3">Conversión</h3>
          <Funnel data={funnel} />
          <ul className="mt-3 text-xs text-white/70 space-y-1">
            <li>Visitas → Vistas de fotos → Añadidos al carrito → Pagos completados</li>
            <li>Tip: publicar el mismo día mejora la conversión 👌</li>
          </ul>
        </div>
      </section>

      {/* Estados + Heatmap */}
      <section className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 mb-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="font-semibold mb-3">Pedidos por estado</h3>
          <StackedBar data={estados} />
          <div className="mt-3 text-xs text-white/70">
            Sugerencia: mantené los “pendientes” y “en proceso” controlados para acelerar entregas 💨
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="font-semibold mb-3">Actividad por hora / día</h3>
          <Heatmap matrix={heatmap} />
          <div className="mt-2 text-xs text-white/60">Filas: Dom → Sáb · Columnas: 00 → 23 hrs</div>
        </div>
      </section>

      {/* Ingresos por evento + Hotspots + Storage */}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="font-semibold mb-3">Ingresos por evento</h3>
          <BarChart
            data={ingresosEventos.map((e) => ({ label: e.nombre, value: e.ingresos }))}
            height={180}
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Hotspots top</h3>
              <a href="/studio/perfil#puntos" className="text-blue-400 text-sm">Gestionar</a>
            </div>
            <div className="space-y-2">
              {hotspots.map((h) => (
                <div key={h.id}>
                  <div className="flex items-center justify-between text-sm">
                    <div>{h.nombre}</div>
                    <div className="text-white/70">{h.convers}%</div>
                  </div>
                  <div className="w-full h-2 rounded bg-white/10 overflow-hidden mt-1">
                    <div className="h-2 bg-blue-600" style={{ width: `${h.convers}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold mb-2">Almacenamiento</h3>
            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-3 bg-blue-600"
                style={{ width: `${Math.round((storage.used / storage.total) * 100)}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-white/70">
              {storage.used} GB de {storage.total} GB
            </div>
            <div className="mt-3">
              <a href="/studio/eventos" className="h-9 px-3 rounded-lg bg-blue-600 text-white font-display font-bold inline-flex items-center justify-center">
                Optimizar contenido
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ================== Subcomponentes UI ================== */

function RangeButton({ current, value, onClick, children }) {
  const active = current === value;
  return (
    <button
      className={`h-10 px-3 rounded-xl border text-sm ${active ? "bg-blue-600 text-white border-white/10" : "bg-white/5 text-white border-white/15"}`}
      onClick={() => onClick(value)}
    >
      {children}
    </button>
  );
}

function Toggle({ current, value, onClick, children }) {
  const active = current === value;
  return (
    <button
      className={`h-8 px-3 rounded-lg border text-sm ${active ? "bg-blue-600 text-white border-white/10" : "bg-white/5 text-white border-white/15"}`}
      onClick={() => onClick(value)}
    >
      {children}
    </button>
  );
}

function KpiCard({ title, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm text-white/70">{title}</div>
      <div className="mt-1 text-2xl font-display font-bold text-white">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="text-xs text-white/60">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

/* ================== Gráficos (SVG / CSS) ================== */

function LineChart({ data = [], height = 160 }) {
  const width = 720;
  const pad = 12;
  const W = width - pad * 2;
  const H = height - pad * 2;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = Math.max(max - min, 1);
  const step = data.length > 1 ? W / (data.length - 1) : W;

  const points = data
    .map((v, i) => {
      const x = pad + i * step;
      const y = pad + H - ((v - min) / range) * H;
      return `${x},${y}`;
    })
    .join(" ");

  const last = data[data.length - 1] || 0;
  const lastY = pad + H - ((last - min) / range) * H;
  const lastX = pad + (data.length - 1) * step;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[160px]">
      <polyline fill="none" stroke="rgba(59,130,246,0.9)" strokeWidth="2" points={points} />
      <circle cx={lastX} cy={lastY} r="3" fill="rgba(59,130,246,1)" />
    </svg>
  );
}

function StackedBar({ data }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  const palette = {
    pendiente: "#94a3b8",   // slate-400
    en_proceso: "#f59e0b",  // amber-500
    pagado: "#38bdf8",      // sky-400
    completado: "#34d399",  // emerald-400
    cancelado: "#f87171",   // red-400
  };
  return (
    <div>
      <div className="w-full h-4 rounded bg-white/10 overflow-hidden">
        {Object.entries(data).map(([k, v]) => (
          <div
            key={k}
            className="h-4 inline-block"
            style={{ width: `${(v / total) * 100}%`, backgroundColor: palette[k] }}
            title={`${labelEstado(k)}: ${v}`}
          />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-white/80">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: palette[k] }} />
            <span className="capitalize">{labelEstado(k)}:</span>
            <span className="font-semibold">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Heatmap({ matrix }) {
  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const max = Math.max(...matrix.flat(), 1);
  return (
    <div className="overflow-auto">
      <div className="inline-grid" style={{ gridTemplateColumns: `64px repeat(24, 24px)` }}>
        {/* encabezado horas */}
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-[10px] text-center text-white/70">{h}</div>
        ))}
        {matrix.map((row, d) => (
          <React.Fragment key={d}>
            <div className="text-[11px] pr-2 text-white/80 flex items-center">{days[d]}</div>
            {row.map((v, h) => {
              const pct = v / max;
              const bg = `rgba(59,130,246,${0.15 + pct * 0.85})`;
              return <div key={h} className="w-6 h-6 rounded-sm" style={{ backgroundColor: bg }} title={`${days[d]} ${h}:00 · ${v}`} />;
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function BarChart({ data = [], height = 180 }) {
  const width = 540;
  const pad = 12;
  const W = width - pad * 2;
  const H = height - pad * 2;
  const max = Math.max(...data.map((d) => d.value), 1);
  const bw = data.length ? W / data.length - 8 : 20;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[180px]">
      {data.map((d, i) => {
        const h = (d.value / max) * (H - 10);
        const x = pad + i * (bw + 8);
        const y = pad + (H - h);
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={h} rx="3" fill="rgba(59,130,246,0.9)" />
            <text x={x + bw / 2} y={height - 2} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,.8)">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ================== Funnel (embudo de conversión) ================== */
function Funnel({ data }) {
  const steps = [
    { key: "visitas", label: "Visitas", value: data?.visitas ?? 0 },
    { key: "vistas", label: "Vistas de fotos", value: data?.vistas ?? 0 },
    { key: "carrito", label: "Añadidos al carrito", value: data?.carrito ?? 0 },
    { key: "pagos", label: "Pagos completados", value: data?.pagos ?? 0 },
  ];

  const max = Math.max(...steps.map((s) => s.value), 1);

  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const pct = Math.max(0, Math.min(100, (s.value / max) * 100));
        const prev = i === 0 ? null : steps[i - 1].value;
        const conv = prev ? Math.round((s.value / prev) * 100) : 100;

        return (
          <div key={s.key}>
            <div className="flex items-center justify-between text-xs text-white/70 mb-1">
              <div className="font-medium">{s.label}</div>
              <div className="flex items-center gap-2">
                {prev != null && <span className="text-white/60">{conv}%</span>}
                <span className="font-mono text-white/90">{s.value.toLocaleString()}</span>
              </div>
            </div>
            <div className="relative h-6 bg-white/10 rounded-full overflow-hidden">
              <div
                className="absolute h-6 bg-blue-600 rounded-full"
                style={{
                  width: `${pct}%`,
                  left: `${(100 - pct) / 2}%`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ================== Utils ================== */

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
function toWeekly(arr) {
  const weeks = [];
  let acc = 0;
  for (let i = 0; i < arr.length; i++) {
    acc += arr[i];
    if ((i + 1) % 7 === 0) {
      weeks.push(acc);
      acc = 0;
    }
  }
  if (acc) weeks.push(acc);
  return weeks;
}
function labelEstado(k) {
  return k === "pagado"
    ? "Pagado"
    : k === "en_proceso"
    ? "En proceso"
    : k === "pendiente"
    ? "Pendiente"
    : k === "completado"
    ? "Completado"
    : "Cancelado";
}
