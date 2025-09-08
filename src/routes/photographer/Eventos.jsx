import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

/* ========= Utils ========= */
const todayStr = () => new Date().toISOString().slice(0, 10);
function fmtNice(dateStr) {
  try {
    const d = new Date((dateStr || "") + "T00:00:00");
    const dd = d.toLocaleDateString("es-GT", { day: "2-digit", month: "short" });
    return dd.replace(".", "");
  } catch {
    return dateStr || "";
  }
}

/* ========= Página ========= */
export default function StudioEventos() {
  const nav = useNavigate();

  const [uid, setUid] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // eventos del fotógrafo
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // perfil -> puntos -> rutas únicas
  const [profilePoints, setProfilePoints] = useState([]);
  const rutasDisponibles = useMemo(() => {
    const set = new Set(
      (profilePoints || [])
        .map((p) => (typeof p?.ruta === "string" ? p.ruta.trim() : ""))
        .filter(Boolean)
    );
    return Array.from(set).sort();
  }, [profilePoints]);

  // modal crear
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    fecha: todayStr(),
    ruta: "",       // select
    precioBase: 50,
    notas: "",
  });

  /* ---- sesión ---- */
  useEffect(() => {
    let unsub;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const id = data?.session?.user?.id || null;
      setUid(id);
      if (!data?.session) {
        unsub = supabase.auth.onAuthStateChange((_e, session) => {
          setUid(session?.user?.id || null);
          setAuthReady(true);
        }).data?.subscription;
        setAuthReady(true);
      } else {
        setAuthReady(true);
      }
    })();
    return () => unsub?.unsubscribe?.();
  }, []);

  /* ---- cargar eventos ---- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!authReady || !uid) return;
        setLoading(true);
        const { data, error } = await supabase
          .from("event")
          .select("*")
          .eq("photographer_id", uid)
          .order("fecha", { ascending: false });
        if (error) throw error;
        if (!mounted) return;
        setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        console.warn("eventos error:", e?.message || e);
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, [authReady, uid]);

  /* ---- cargar puntos del perfil (para rutas) ---- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!authReady || !uid) return;
        const { data, error } = await supabase
          .from("photographer_profile")
          .select("puntos")
          .eq("user_id", uid)
          .maybeSingle();
        if (error) throw error;
        let pts = [];
        const raw = data?.puntos;
        if (Array.isArray(raw)) pts = raw;
        else if (typeof raw === "string" && raw.trim().startsWith("[")) {
          try { pts = JSON.parse(raw); } catch {}
        }
        if (!mounted) return;
        setProfilePoints(Array.isArray(pts) ? pts : []);
      } catch (e) {
        console.warn("perfil puntos error:", e?.message || e);
        if (mounted) setProfilePoints([]);
      }
    })();
    return () => (mounted = false);
  }, [authReady, uid]);

  /* ---- acciones ---- */
  async function crearEvento() {
    try {
      if (!uid) return alert("Tenés que iniciar sesión, vos.");
      if (!form.nombre.trim()) return alert("Poné un nombre al evento.");
      if (!form.ruta) return alert("Seleccioná una ruta (creá puntos en tu perfil si no aparece).");

      const payload = {
        // NOT NULL del schema
        title: form.nombre.trim(),
        date: form.fecha,              // 👈 REQUERIDO (NOT NULL)
        status: "draft",               // 👈 alinear con schema (published/draft)
        // Campos “espejo” que usa tu app
        nombre: form.nombre.trim(),
        fecha: form.fecha,
        ruta: form.ruta,
        location: form.ruta,
        estado: "borrador",
        precioBase: Number(form.precioBase || 0),
        notas: form.notas || "",
        photographer_id: uid,
      };

      const { data: inserted, error } = await supabase
        .from("event")
        .insert([payload])
        .select("id")
        .single();
      if (error) throw error;

      // asegurar event_route
      await supabase
        .from("event_route")
        .insert([{ event_id: inserted.id, name: form.ruta }]);

      setOpenNew(false);
      setForm({ nombre: "", fecha: todayStr(), ruta: "", precioBase: 50, notas: "" });
      nav(`/studio/eventos/${inserted.id}?tab=puntos`);
    } catch (e) {
      console.error(e);
      alert(e.message || "No se pudo crear el evento.");
    }
  }

  async function togglePublicar(id, estado) {
    try {
      const nuevo = estado === "publicado" ? "borrador" : "publicado";
      const { error } = await supabase.from("event").update({ estado: nuevo }).eq("id", id);
      if (error) throw error;
      const { data } = await supabase
        .from("event")
        .select("*")
        .eq("photographer_id", uid)
        .order("fecha", { ascending: false });
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      alert("No se pudo cambiar el estado.");
    }
  }

  async function eliminarEvento(id) {
    if (!confirm("¿Seguro que querés eliminar este evento?")) return;
    try {
      const { error } = await supabase.from("event").delete().eq("id", id);
      if (error) throw error;
      setItems((arr) => arr.filter((x) => x.id !== id));
    } catch (e) {
      alert("No se pudo eliminar.");
    }
  }

  /* ---- Render ---- */
  if (!authReady) {
    return (
      <main className="w-full max-w-[1100px] mx-auto px-5 py-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">Inicializando…</div>
      </main>
    );
  }

  return (
    <main className="w-full max-w-[1100px] mx-auto px-5 py-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-display font-black">Mis eventos</h1>
        <button
          className="h-10 px-4 rounded-xl bg-emerald-600 text-white font-display font-bold border border-white/10"
          onClick={() => setOpenNew(true)}
        >
          Nuevo evento
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">Cargando eventos…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          No tenés eventos aún. Creá uno para empezar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((ev) => (
            <CardEvento
              key={ev.id}
              ev={ev}
              onPublicar={() => togglePublicar(ev.id, ev.estado)}
              onEliminar={() => eliminarEvento(ev.id)}
            />
          ))}
        </div>
      )}

      {/* Modal nuevo */}
      {openNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-5">
            <div className="text-lg font-semibold mb-3">Crear evento</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <div className="text-sm text-slate-300 mb-1">Nombre</div>
                <input
                  className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </label>

              <label className="block">
                <div className="text-sm text-slate-300 mb-1">Fecha</div>
                <input
                  type="date"
                  className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3"
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                />
              </label>

              <label className="block sm:col-span-2">
                <div className="text-sm text-slate-300 mb-1">Ruta</div>
                <select
                  className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3"
                  value={form.ruta}
                  onChange={(e) => setForm({ ...form, ruta: e.target.value })}
                >
                  <option value="">{rutasDisponibles.length ? "— Seleccioná —" : "— No hay rutas en tu perfil —"}</option>
                  {rutasDisponibles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                {rutasDisponibles.length === 0 && (
                  <div className="text-[12px] text-slate-400 mt-1">
                    Creá puntos (con su ruta) en tu perfil para habilitar esta lista.
                  </div>
                )}
              </label>

              <label className="block">
                <div className="text-sm text-slate-300 mb-1">Precio base (Q)</div>
                <input
                  type="number"
                  min={1}
                  className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3"
                  value={form.precioBase}
                  onChange={(e) => setForm({ ...form, precioBase: Number(e.target.value || 0) })}
                />
              </label>

              <label className="block sm:col-span-2">
                <div className="text-sm text-slate-300 mb-1">Notas (privado)</div>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-white/15 bg-white/5 text-white px-3 py-2"
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                />
              </label>
            </div>

            <div className="mt-4 flex gap-2 justify-end">
              <button className="h-10 px-4 rounded-xl bg-white/10 text-white" onClick={() => setOpenNew(false)}>
                Cancelar
              </button>
              <button
                className="h-10 px-4 rounded-xl bg-emerald-600 text-white font-display font-bold"
                onClick={crearEvento}
                disabled={!form.nombre.trim() || !form.ruta}
                title={!form.ruta ? "Necesitás seleccionar una ruta" : ""}
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ========= Tarjeta ========= */
function CardEvento({ ev, onPublicar, onEliminar }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm text-slate-400">{fmtNice(ev.fecha)} · {ev.ruta}</div>
      <div className="text-lg font-semibold">{ev.nombre ?? ev.title}</div>
      <div className="text-xs text-slate-400 mb-3">Estado: {ev.estado}</div>

      <div className="flex items-center gap-2">
        <Link
          to={`/studio/eventos/${ev.id}`}
          className="h-9 px-3 rounded-xl bg-white/10 text-white border border-white/10 inline-flex items-center justify-center"
        >
          Editar
        </Link>
        <button
          className="h-9 px-3 rounded-xl bg-blue-500 text-white border border-white/10"
          onClick={onPublicar}
        >
          {ev.estado === "publicado" ? "Despublicar" : "Publicar"}
        </button>
        <button
          className="h-9 px-3 rounded-xl bg-red-600 text-white border border-white/10 ml-auto"
          onClick={onEliminar}
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}
