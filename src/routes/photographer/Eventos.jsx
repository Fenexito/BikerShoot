// src/pages/studio/Eventos.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient"; // ✅ cliente central

/* ========= Utils ========= */
const todayStr = () => new Date().toISOString().slice(0, 10);
function fmtNice(dateStr) {
  try {
    const d = new Date(dateStr + "T00:00:00");
    const dd = d.toLocaleDateString("es-GT", { day: "2-digit", month: "short" });
    return dd.replace(".", "");
  } catch {
    return dateStr;
  }
}
function yyyymm(dStr) {
  if (!dStr) return "";
  const d = new Date(dStr + "T00:00:00");
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function monthLabel(ym) {
  if (!ym) return "Todos los meses";
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("es-GT", { month: "long", year: "numeric" });
}

/* ========= Normalización lectura (tolerante) ========= */
function normalizeEventRow(row) {
  const nombre = row.nombre ?? row.title ?? row.name ?? "";
  const fecha = row.fecha ?? row.date ?? row.event_date ?? todayStr();
  const ruta = row.ruta ?? row.route ?? row.location ?? "";
  const estado = row.estado ?? row.status ?? "borrador";
  const precioBase = row.precio_base ?? row.base_price ?? row.precioBase ?? 50;
  const notas = row.notas ?? row.notes ?? "";
  const price_list_id = row.price_list_id ?? null;

  return {
    id: row.id,
    created_at: row.created_at,
    photographer_id: row.photographer_id ?? row.created_by ?? null,
    nombre,
    fecha,
    ruta,
    estado,
    precioBase,
    notas,
    price_list_id,
  };
}

/* ========= Página ========= */
export default function StudioEventos() {
  // Eventos
  const [events, setEvents] = useState([]);

  // Filtros
  const [query, setQuery] = useState("");
  const [estado, setEstado] = useState("todos");
  const [mes, setMes] = useState("todos");

  // Crear
  const [crearOpen, setCrearOpen] = useState(false);
  const [form, setForm] = useState(() => ({
    nombre: `Domingo ${fmtNice(todayStr())}`,
    fecha: todayStr(),
    ruta: "",
  }));

  useEffect(() => {
    reloadEvents();
  }, []);

  async function reloadEvents() {
    const { data: evs, error } = await supabase.from("event").select("*");
    if (error) {
      console.error("No se pudieron cargar eventos:", error);
      setEvents([]);
      return;
    }
    const norm = (evs || []).map(normalizeEventRow).sort((a, b) => {
      const da = a.fecha || a.created_at || "";
      const db = b.fecha || b.created_at || "";
      return da < db ? 1 : -1;
    });
    setEvents(norm);
  }

  /* ===== Crear evento (usa 'location' como oficial) ===== */
  async function crearEvento() {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess?.session?.user?.id;
      if (!uid) return alert("Tu sesión expiró. Volvé a iniciar sesión.");
      if (!form.fecha) return alert("Elegí la fecha del evento.");
      if (!form.ruta) return alert("Elegí la ruta del evento.");

      const payload = {
        photographer_id: uid,
        title: (form.nombre || "").trim() || `Evento ${fmtNice(form.fecha)}`,
        date: form.fecha,
        location: form.ruta, // 👈 tu tabla usa 'location'
        status: "draft",
      };

      const { error } = await supabase.from("event").insert([payload], { returning: "minimal" });
      if (error) {
        console.error("Insert event error:", error);
        alert(error.message || "No se pudo crear el evento (insert).");
        return;
      }

      await reloadEvents();
      setCrearOpen(false);
      setForm({
        nombre: `Domingo ${fmtNice(todayStr())}`,
        fecha: todayStr(),
        ruta: "",
      });
    } catch (e) {
      console.error("Crear evento - excepción:", e);
      alert("No se pudo crear el evento.");
    }
  }

  /* ===== Eliminar ===== */
  async function eliminarEvento(id) {
    if (!confirm("¿Eliminar este evento?")) return;
    try {
      const { error } = await supabase.from("event").delete().eq("id", id);
      if (error) throw error;
      await reloadEvents();
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar el evento.");
    }
  }

  /* ===== Publicar / Despublicar ===== */
  async function publicarToggle(id) {
    const current = events.find((e) => e.id === id);
    if (!current) return;
    const nuevoEstado = (current.estado || "borrador") === "publicado" ? "borrador" : "publicado";

    // Intentamos ambas llaves por compatibilidad
    const patches = [{ status: nuevoEstado }, { estado: nuevoEstado }];
    for (const patch of patches) {
      const { error } = await supabase.from("event").update(patch, { returning: "minimal" }).eq("id", id);
      if (!error) { await reloadEvents(); return; }
    }
    alert("No se pudo cambiar el estado del evento.");
  }

  /* ===== Selectores/memos ===== */
  const mesesDisponibles = useMemo(() => {
    const set = new Set(events.map((e) => yyyymm(e.fecha)).filter(Boolean));
    const arr = Array.from(set);
    arr.sort((a, b) => (a < b ? 1 : -1));
    return ["todos", ...arr];
  }, [events]);
  const filtrados = useMemo(() => {
    return events
      .filter((e) => (estado === "todos" ? true : (e.estado || "borrador") === estado))
      .filter((e) => (mes === "todos" ? true : yyyymm(e.fecha) === mes))
      .filter((e) => (e.nombre || "").toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }, [events, estado, mes, query]);

  return (
    <main className="w-full max-w-[1100px] mx-auto px-5 py-6 lg:py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl md:text-3xl font-display font-black">Eventos</h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="h-10 px-4 rounded-xl bg-blue-500 text-white font-display font-bold border border-white/10"
            onClick={() => setCrearOpen(true)}
          >
            Crear evento
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          className="h-10 rounded-lg border border-white/15 bg-white/5 text-white px-3 placeholder-white/50"
          placeholder="Buscar por nombre…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="h-10 rounded-lg border border-white/15 bg-white/5 text-white px-3"
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
        >
          <option value="todos">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="procesando">Procesando</option>
          <option value="publicado">Publicado</option>
          <option value="archivado">Archivado</option>
        </select>
        <select
          className="h-10 rounded-lg border border-white/15 bg-white/5 text-white px-3"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
        >
          {mesesDisponibles.map((m) => (
            <option key={m} value={m}>
              {m === "todos" ? "Todos los meses" : monthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      {/* Grilla */}
      {filtrados.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-slate-300">
          Sin eventos para este filtro
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtrados.map((e) => (
            <EventCard
              key={e.id}
              ev={e}
              onEliminar={() => eliminarEvento(e.id)}
              onPublicar={() => publicarToggle(e.id)}
            />
          ))}
        </div>
      )}

      {/* Modal crear */}
      {crearOpen && (
        <Modal onClose={() => setCrearOpen(false)} title="Nuevo evento">
          <div className="space-y-3">
            <div>
              <Label>Nombre</Label>
              <input
                className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3 placeholder-white/60"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Domingo 12 de mayo"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Fecha</Label>
                <input
                  type="date"
                  className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3"
                  value={form.fecha}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((f) => ({ ...f, fecha: v, nombre: f.nombre || `Domingo ${fmtNice(v)}` }));
                  }}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Ruta</Label>
                <input
                  className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3"
                  value={form.ruta}
                  onChange={(e) => setForm((f) => ({ ...f, ruta: e.target.value }))}
                  placeholder="Carretera a El Salvador"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button className="h-10 px-4 rounded-xl border border-white/15 bg-white/5 text-white font-display font-bold" onClick={() => setCrearOpen(false)}>
                Cancelar
              </button>
              <button className="h-10 px-4 rounded-xl bg-blue-500 text-white font-display font-bold border border-white/10" onClick={crearEvento}>
                Crear
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}

/* ========= UI helpers ========= */
function Label({ children }) {
  return <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/70">{children}</div>;
}
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-[#0a0f1a] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-semibold">{title}</div>
          <button className="text-white/70 hover:text-white" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function EventCard({ ev, onEliminar, onPublicar }) {
  const chip =
    ev.estado === "publicado" ? "bg-green-600" :
    ev.estado === "procesando" ? "bg-yellow-600" :
    ev.estado === "archivado" ? "bg-slate-600" : "bg-slate-500";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className={`inline-flex h-6 items-center rounded-full px-2 text-xs font-semibold ${chip}`}>
          {ev.estado}
        </span>
        <span className="text-white/60 text-sm">· {ev.fecha}</span>
      </div>
      <div className="text-lg font-semibold mb-1">{ev.nombre}</div>
      <div className="text-white/70 text-sm mb-3">{ev.ruta}</div>
      <div className="text-white/80 text-sm mb-3">
        {ev.price_list_id
          ? "Usa lista de precios"
          : <>Precio base: <strong>Q{ev.precioBase}</strong></>}
      </div>
      <div className="flex items-center gap-2">
        <Link to={`/studio/eventos/${ev.id}`} className="h-9 px-3 rounded-xl border border-white/15 bg-white/5 text-white font-display font-bold inline-flex items-center justify-center">
          Editar
        </Link>
        <button className="h-9 px-3 rounded-xl bg-blue-500 text-white font-display font-bold inline-flex items-center justify-center border border-white/10" onClick={onPublicar}>
          {ev.estado === "publicado" ? "Despublicar" : "Publicar"}
        </button>
        <button className="h-9 px-3 rounded-xl bg-red-600 text-white font-display font-bold inline-flex items-center justify-center ml-auto" onClick={onEliminar}>
          Eliminar
        </button>
      </div>
    </div>
  );
}
