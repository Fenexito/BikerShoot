import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function BikerPhotographers() {
  const nav = useNavigate();

  // Helpers
  const formatQ = (val) => {
    if (val === null || val === undefined) return "—";
    const n = Number(String(val).replace(/[^\d.]/g, ""));
    if (!isFinite(n)) return "—";
    return `Q${Number.isInteger(n) ? n : n.toFixed(2)}`;
  };
  // Saca el mínimo precio de listas públicas; si no hay, cae a "precios" (legacy).
  const priceFromOf = (price_lists, preciosLegacy) => {
    const numfy = (v) => Number(String(v ?? "").replace(/[^\d.]/g, ""));
    const fromLists = Array.isArray(price_lists)
      ? price_lists
          .filter((pl) => pl?.visible_publico)
          .flatMap((pl) => (Array.isArray(pl.items) ? pl.items : []))
          .map((it) => numfy(it?.precio))
          .filter((n) => isFinite(n))
      : [];
    if (fromLists.length) return Math.min(...fromLists);
    // fallback: precios (legacy)
    const fromLegacy = Array.isArray(preciosLegacy)
      ? preciosLegacy.map((x) => numfy(x?.precio)).filter((n) => isFinite(n))
      : [];
    return fromLegacy.length ? Math.min(...fromLegacy) : null;
  };

  // Estado UI
  const [q, setQ] = useState("");
  const [orden, setOrden] = useState("rating");
  const [filtroRuta, setFiltroRuta] = useState("Todas");
  const [filtroPunto, setFiltroPunto] = useState("Todos");

  // Datos
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Fetch al RPC (RUTA y PUNTO por nombre)
  React.useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        setErr("");
        const { data, error } = await supabase.rpc("get_photographers_cards", {
          q: q?.trim() || null,
          ruta: filtroRuta !== "Todas" ? filtroRuta : null,
          punto: filtroPunto !== "Todos" ? filtroPunto : null,
          orden,
          limit_n: 200,
          offset_n: 0,
        });
        if (error) throw error;
        if (!alive) return;

        const mapped = (data || []).map((r) => ({
          id: r.id,
          estudio: r.estudio,
          username: (r.username || "").replace(/^@/, ""),
          ubicacion: r.ubicacion || "",
          estilos: r.estilos || [],
          rating: Number(r.rating || 0),
          precios: r.precios || [],                 // legacy
          price_lists: r.price_lists || null,       // NUEVO (si el RPC lo devuelve)
          priceFrom: priceFromOf(r.price_lists || null, r.precios || []),
          portada: r.portada,
          avatar: r.avatar,
          rutas: r.rutas || [],
          puntos: r.puntos || [],
        }));
        setRows(mapped);
      } catch (e) {
        if (alive) setErr(e.message || "No se pudo cargar");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [q, filtroRuta, filtroPunto, orden]);

  // Opciones para los selects (únicas, orden alfabético)
  const rutas = useMemo(() => {
    const set = new Set(rows.flatMap((p) => p.rutas || []));
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const puntos = useMemo(() => {
    const set = new Set(rows.flatMap((p) => p.puntos || []));
    return ["Todos", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const lista = rows;

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-bold">Fotógrafos</h1>
        <p className="text-slate-500">Descubrí estudios y elegí a tu fotógraf@ ideal.</p>
      </header>

      {/* Filtros */}
      <section className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2 flex flex-col gap-1">
          <label className="text-xs text-slate-500">Buscar</label>
          <input
            className="flex-1 h-11 border rounded-lg px-3"
            placeholder="Buscar por estudio, usuario o texto…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Ruta</label>
          <select
            className="h-11 border rounded-lg px-3"
            value={filtroRuta}
            onChange={(e) => setFiltroRuta(e.target.value)}
          >
            {rutas.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Punto</label>
          <select
            className="h-11 border rounded-lg px-3"
            value={filtroPunto}
            onChange={(e) => setFiltroPunto(e.target.value)}
          >
            {puntos.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="mb-6 flex items-center justify-between">
        <div className="text-sm text-slate-500">
          {loading ? "Cargando…" : `${lista.length} resultado${lista.length === 1 ? "" : "s"}`}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Ordenar por:</span>
          <select
            className="h-10 border rounded-lg px-3"
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
          >
            <option value="rating">Mejor rating</option>
            <option value="precio">Precio (1 foto)</option>
            <option value="nombre">Nombre</option>
          </select>
        </div>
      </section>

      {/* Grid de tarjetas */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {!loading &&
          lista.map((p) => (
            <article
              key={p.id}
              className="rounded-2xl shadow-card bg-white overflow-hidden border border-slate-100"
            >
              <div className="aspect-[16/9] overflow-hidden">
                <img src={p.portada} alt={p.estudio} className="w-full h-full object-cover" />
              </div>

              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={p.avatar}
                    alt={p.estudio}
                    className="w-12 h-12 rounded-full border-2 border-white shadow"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{p.estudio}</h3>
                    <div className="text-sm text-slate-500 truncate">
                      {p.username ? `@${p.username}` : "—"}
                      {p.ubicacion ? ` · ${p.ubicacion}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-yellow-500 font-semibold">★ {p.rating.toFixed(1)}</div>
                    <div className="text-xs text-slate-400">calificación</div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-slate-500">Desde</div>
                  <div className="text-base font-display font-bold">
                    {formatQ(p.priceFrom)}
                  </div>
                </div>

                <button
                  className="w-full h-10 rounded-xl bg-blue-600 text-white font-display font-bold"
                  onClick={() => nav(`/app/fotografos/${p.id}`)}
                >
                  Ver perfil
                </button>
              </div>
            </article>
          ))}

        {loading &&
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200 bg-white animate-pulse h-[340px]"
            />
          ))}
      </section>

      {err && <div className="text-red-600 mt-4">{err}</div>}
    </main>
  );
}
