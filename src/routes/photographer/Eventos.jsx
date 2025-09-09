// src/routes/photographer/Eventos.jsx
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

// ✅ Helper: validar UUID (para no mandar "pl_xxx" a una columna UUID)
function isValidUuid(uuid) {
  const r = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return r.test(String(uuid || ""));
}

/* Mapeo visual del estado */
const estadoStyle = (estado) => {
  const st = (estado || "").toLowerCase();
  if (st === "publicado") {
    return {
      label: "Publicado",
      text: "text-emerald-200",
      dot: "bg-emerald-400",
    };
  }
  return {
    label: "Borrador",
    text: "text-amber-200",
    dot: "bg-amber-400",
  };
};

/* ========= Página ========= */
export default function StudioEventos() {
  const nav = useNavigate();

  const [uid, setUid] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // eventos del fotógrafo
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Ordenar por fecha (más reciente primero) por si acaso
  const itemsSorted = useMemo(() => {
    return [...(items || [])].sort((a, b) => {
      const da = new Date((a?.fecha || "") + "T00:00:00");
      const db = new Date((b?.fecha || "") + "T00:00:00");
      return db - da; // descendente
    });
  }, [items]);

  // perfil -> puntos y listas de precios
  const [profilePoints, setProfilePoints] = useState([]);
  const [priceLists, setPriceLists] = useState([]);

  const rutasDisponibles = useMemo(() => {
    const set = new Set(
      (profilePoints || [])
        .map((p) => (typeof p?.ruta === "string" ? p.ruta.trim() : ""))
        .filter(Boolean)
    );
    return Array.from(set).sort();
  }, [profilePoints]);

  const listasOrdenadas = useMemo(() => {
    const arr = Array.isArray(priceLists) ? [...priceLists] : [];
    // Domingo primero, luego alfabético
    arr.sort((a, b) => {
      const A = /domingo/i.test(a?.nombre || "") ? 0 : 1;
      const B = /domingo/i.test(b?.nombre || "") ? 0 : 1;
      if (A !== B) return A - B;
      return String(a?.nombre || "").localeCompare(String(b?.nombre || ""));
    });
    return arr;
  }, [priceLists]);

  // modal crear
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    fecha: todayStr(),
    ruta: "",       // select
    price_list_id: "",
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

  /* ---- cargar puntos del perfil + listas de precios ---- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!authReady || !uid) return;
        const { data, error } = await supabase
          .from("photographer_profile")
          .select("puntos, price_lists")
          .eq("user_id", uid)
          .maybeSingle();
        if (error) throw error;

        // puntos
        let pts = [];
        const rawPts = data?.puntos;
        if (Array.isArray(rawPts)) pts = rawPts;
        else if (typeof rawPts === "string" && rawPts.trim().startsWith("[")) {
          try { pts = JSON.parse(rawPts); } catch {}
        }

        // listas
        let pls = [];
        const rawPls = data?.price_lists;
        if (Array.isArray(rawPls)) pls = rawPls;
        else if (typeof rawPls === "string" && rawPls.trim().startsWith("[")) {
          try { pls = JSON.parse(rawPls); } catch {}
        }

        if (!mounted) return;
        setProfilePoints(Array.isArray(pts) ? pts : []);
        setPriceLists(Array.isArray(pls) ? pls : []);
      } catch (e) {
        console.warn("perfil puntos/listas error:", e?.message || e);
        if (mounted) {
          setProfilePoints([]);
          setPriceLists([]);
        }
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
        // ✅ SOLO si es UUID válido; si es "pl_xxx" → null para no petar el INSERT
        price_list_id: isValidUuid(form.price_list_id) ? form.price_list_id : null,
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
      setForm({ nombre: "", fecha: todayStr(), ruta: "", price_list_id: "", precioBase: 50, notas: "" });
      nav(`/studio/eventos/${inserted.id}?tab=puntos`);
    } catch (e) {
      console.error(e);
      alert(e.message || "No se pudo crear el evento.");
    }
  }

  async function togglePublicar(id, estado) {
    try {
      const nuevo = estado === "publicado" ? "borrador" : "publicado";
      const { error } = await supabase.from("event").update({
        estado: nuevo,
        status: nuevo === "publicado" ? "published" : "draft",
      }).eq("id", id);
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

      {!authReady ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">Inicializando…</div>
      ) : loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">Cargando eventos…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          No tenés eventos aún. Creá uno para empezar.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {itemsSorted.map((ev) => (
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
                  disabled={!!form.price_list_id}
                  title={form.price_list_id ? "Usando lista de precios" : ""}
                />
              </label>

              <label className="block">
                <div className="text-sm text-slate-300 mb-1">Lista de precios (opcional)</div>
                <select
                  className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3"
                  value={form.price_list_id || ""}
                  onChange={(e) => setForm({ ...form, price_list_id: e.target.value || "" })}
                >
                  <option value="">— Sin lista (usa precio base) —</option>
                  {listasOrdenadas.map((pl) => (
                    <option key={pl.id || pl.nombre} value={pl.id || ""}>{pl.nombre}</option>
                  ))}
                </select>
                {priceLists.length === 0 && (
                  <div className="text-[12px] text-slate-400 mt-1">
                    Podés crear listas en tu Perfil &rarr; “Listas de precios”.
                  </div>
                )}
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
  const est = estadoStyle(ev.estado);
  const portada =
    ev.cover_url || ev.portada_url || ev.portada || ev.cover || null;

  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden shadow-card">
      {/* Portada / Placeholder */}
      <div className="relative aspect-video w-full bg-gradient-to-br from-slate-800 to-slate-900">
        {portada ? (
          <img
            src={portada}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-slate-400 text-sm">
            Sin portada
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        {/* Estado arriba a la derecha: texto grande + dot de color */}
        <div className="absolute top-2 right-3 flex items-center gap-2">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${est.dot}`} />
          <span className={`text-xs md:text-sm font-bold drop-shadow ${est.text}`}>
            {est.label}
          </span>
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4">
        <div className="text-sm text-slate-400">{fmtNice(ev.fecha)} · {ev.ruta}</div>
        <div className="text-lg font-semibold mb-1">{ev.nombre ?? ev.title}</div>

        {/* Contador de fotos */}
        <PhotoCount eventId={ev.id} />

        {/* Acciones */}
        <div className="mt-3 flex items-center gap-2">
          <Link
            to={`/studio/eventos/${ev.id}`}
            className="h-9 px-3 rounded-xl bg-white/10 text-white border border-white/10 inline-flex items-center justify-center"
          >
            Editar
          </Link>

          {/* Publicar / Despublicar con color dinámico */}
          <button
            className={`h-9 px-3 rounded-xl text-white border border-white/10 ${
              ev.estado === "publicado" ? "bg-red-600" : "bg-blue-600"
            }`}
            onClick={onPublicar}
          >
            {ev.estado === "publicado" ? "Despublicar" : "Publicar"}
          </button>

          <button
            className="h-9 px-3 rounded-xl bg-transparent text-red-300 border border-red-500/40 hover:bg-red-500/10 ml-auto"
            onClick={onEliminar}
          >
            Eliminar
          </button>
        </div>

        {/* Link para setear portada desde el editor */}
        <div className="mt-2 text-xs">
          <Link
            to={`/studio/eventos/${ev.id}?tab=fotos`}
            className="text-slate-300 hover:text-white underline underline-offset-4"
            title="Cambiar portada del evento"
          >
            Cambiar portada
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ========= Contador de fotos (intenta dos tablas comunes) ========= */
function PhotoCount({ eventId }) {
  const [count, setCount] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // 1) event_photo
        let { count: c1, error: e1 } = await supabase
          .from("event_photo")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId);

        if (!e1 && typeof c1 === "number") {
          if (mounted) setCount(c1);
          return;
        }

        // 2) photo (fallback)
        let { count: c2, error: e2 } = await supabase
          .from("photo")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId);

        if (!e2 && typeof c2 === "number") {
          if (mounted) setCount(c2);
          return;
        }

        if (mounted) setCount(0);
      } catch {
        if (mounted) setCount(0);
      }
    })();
    return () => { mounted = false; };
  }, [eventId]);

  return (
    <div className="text-sm text-slate-400">
      {count === null ? "Cargando fotos…" : `Fotos: ${count}`}
    </div>
  );
}
