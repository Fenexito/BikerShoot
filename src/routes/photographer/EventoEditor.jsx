import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import UploadManager from "./upload/UploadManager.jsx";
import { supabase } from "../../lib/supabaseClient";

/* ===== Utils ===== */
const fmtDate = (iso) =>
  new Date((iso || "") + "T00:00:00").toLocaleDateString("es-GT", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

function windowsFromPerfilPunto(p) {
  try {
    const horarios = Array.isArray(p?.horarios) ? p.horarios : [];
    const dom = horarios.find((h) => (h?.dia ?? "").toLowerCase() === "domingo");
    const h0 = dom || horarios[0] || {};
    const start = String(h0?.inicio ?? "06:00");
    const end = String(h0?.fin ?? "12:00");
    return [{ start, end }];
  } catch {
    return [{ start: "06:00", end: "12:00" }];
  }
}

function mapEventRow(row) {
  return {
    id: row.id,
    nombre: row.nombre ?? row.title ?? `Evento ${row.id}`,
    fecha: row.fecha ?? row.date ?? new Date().toISOString().slice(0, 10),
    ruta: row.ruta ?? row.location ?? "",
    estado: row.estado ?? (row.status === "published" ? "publicado" : "borrador"),
    precioBase: row.precioBase ?? row.base_price ?? 50,
    notas: row.notas ?? row.notes ?? "",
    price_list_id: row.price_list_id ?? null,
    photographer_id: row.photographer_id ?? row.created_by ?? null,
  };
}
function buildEventPatch(ev) {
  return {
    // Mantener NOT NULL del schema
    title: ev.nombre,
    date: ev.fecha,
    status: ev.estado === "publicado" ? "published" : "draft",
    nombre: ev.nombre,
    fecha: ev.fecha,
    ruta: ev.ruta,
    location: ev.ruta,
    estado: ev.estado,
    precioBase: ev.precioBase,
    notas: ev.notas,
    price_list_id: ev.price_list_id || null,
  };
}

/* ===== Componente ===== */
export default function EventoEditor() {
  const routeParams = useParams();
  const [searchParams] = useSearchParams();
  const paramId = routeParams.id || routeParams.eventId || routeParams.evId || "";
  const initialTab = searchParams.get("tab") || "resumen";

  const [ev, setEv] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [puntos, setPuntos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(initialTab);
  const [authReady, setAuthReady] = useState(false);
  const [noSession, setNoSession] = useState(false);
  const [uid, setUid] = useState(null);

  // Catálogo leído del perfil (JSON)
  const [catalog, setCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // Listas de precios (placeholder)
  const [priceLists, setPriceLists] = useState([]);

  // Subida
  const [uploadPoint, setUploadPoint] = useState("");

  /* ==== Hooks MEMO (siempre al tope, nunca después de returns) ==== */
  const fotosPorPunto = useMemo(() => {
    const map = new Map();
    const arr = Array.isArray(fotos) ? fotos : [];
    for (const f of arr) {
      const k = f?.hotspot_id || null;
      const prev = map.get(k) || [];
      prev.push(f);
      map.set(k, prev);
    }
    for (const [, list] of map) list.sort((a, b) => new Date(a?.taken_at || 0) - new Date(b?.taken_at || 0));
    return map;
  }, [fotos]);

  const catalogFiltered = useMemo(() => {
    if (!ev?.ruta) return Array.isArray(catalog) ? catalog : [];
    return (Array.isArray(catalog) ? catalog : []).filter((h) => (h.route_name || "") === ev.ruta);
  }, [catalog, ev?.ruta]);

  useEffect(() => {
    if (!uploadPoint && puntos.length) setUploadPoint(puntos[0].id);
  }, [puntos, uploadPoint]);

  /* ---- Sesión ---- */
  useEffect(() => {
    let unsub;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const sUid = data?.session?.user?.id || null;
      setUid(sUid);
      if (!data?.session) {
        unsub = supabase.auth.onAuthStateChange((_e, session) => {
          setUid(session?.user?.id || null);
          setAuthReady(true);
          setNoSession(!session?.user?.id);
        }).data?.subscription;
        setAuthReady(true);
        setNoSession(true);
      } else {
        setAuthReady(true);
        setNoSession(false);
      }
    })();
    return () => unsub?.unsubscribe?.();
  }, []);

  /* ---- Evento + assets ---- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!authReady) return;
        if (!paramId) throw new Error("Falta el id del evento en la URL");
        setLoading(true);

        const { data: row, error } = await supabase
          .from("event")
          .select("*")
          .eq("id", paramId)
          .maybeSingle();
        if (error) throw error;
        if (!row) throw new Error("Evento no encontrado");
        if (!mounted) return;
        setEv(mapEventRow(row));

        const { data: assets, error: aErr } = await supabase
          .from("event_asset")
          .select("*")
          .eq("event_id", paramId)
          .order("taken_at", { ascending: true });
        if (aErr) console.warn("[EventoEditor] event_asset error:", aErr?.message || aErr);
        if (!mounted) return;
        setFotos(Array.isArray(assets) ? assets : []);
      } catch (e) {
        console.error(e);
        if (mounted) {
          setEv(null);
          setFotos([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramId, authReady]);

  /* ---- Catálogo desde photographer_profile.puntos ---- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingCatalog(true);
        const ownerId = ev?.photographer_id || uid;
        if (!ownerId) {
          if (mounted) setCatalog([]);
          return;
        }
        const { data: profile, error: profErr } = await supabase
          .from("photographer_profile")
          .select("puntos")
          .eq("user_id", ownerId)
          .maybeSingle();
        if (profErr) throw profErr;

        let puntosPerfil = [];
        const raw = profile?.puntos;
        if (Array.isArray(raw)) puntosPerfil = raw;
        else if (typeof raw === "string" && raw.trim().startsWith("[")) {
          try { puntosPerfil = JSON.parse(raw); } catch {}
        }

        const mapped = (puntosPerfil || []).map((p, i) => ({
          key: String(p?.id ?? `${p?.nombre}-${p?.ruta}-${p?.lat}-${p?.lon}-${i}`),
          id: p?.id ?? null, // id del perfil (referencia)
          name: String(p?.nombre ?? "Punto"),
          route_name: String(p?.ruta ?? ""),
          lat: p?.lat != null ? Number(p.lat) : null,
          lng: p?.lon != null ? Number(p.lon) : null,
          default_windows: windowsFromPerfilPunto(p),
        }));

        if (!mounted) return;
        setCatalog(mapped);
      } catch (e) {
        console.warn("[EventoEditor] catalog (perfil.puntos) error:", e?.message || e);
        if (mounted) setCatalog([]);
      } finally {
        if (mounted) setLoadingCatalog(false);
      }
    })();
    return () => (mounted = false);
  }, [ev?.photographer_id, uid]);

  /* ---- Puntos del evento (usa windows) ---- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!ev?.id) return;
        const { data: ehs, error: ehErr } = await supabase
          .from("event_hotspot")
          .select("id, name, lat, lng, windows, route_id")
          .eq("event_id", ev.id)
          .order("id", { ascending: true });
        if (ehErr) throw ehErr;

        const puntosIniciales = (Array.isArray(ehs) ? ehs : []).map((h) => ({
          id: h.id,
          nombre: h.name || "Punto",
          activo: true,
          horaIni: (Array.isArray(h.windows) && h.windows[0]?.start) || "06:00",
          horaFin: (Array.isArray(h.windows) && h.windows[0]?.end) || "12:00",
          route_id: h.route_id || null,
        }));
        if (!mounted) return;
        setPuntos(puntosIniciales);
      } catch (e) {
        console.warn("[EventoEditor] event_hotspot error:", e?.message || e);
        if (mounted) setPuntos([]);
      }
    })();
    return () => (mounted = false);
  }, [ev?.id]);

  // helper: validar uuid (simple y suficiente)
  const isUuid = (v) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

  /* ---- helpers SQL ---- */
  async function ensureEventRouteId(eventId, routeName) {
    if (!routeName) return null;
    const { data: rows } = await supabase
      .from("event_route")
      .select("id")
      .eq("event_id", eventId)
      .eq("name", routeName)
      .maybeSingle();
    if (rows?.id) return rows.id;
    const { data: inserted, error: insErr } = await supabase
      .from("event_route")
      .insert([{ event_id: eventId, name: routeName }])
      .select("id")
      .single();
    if (insErr) throw insErr;
    return inserted.id;
  }

  /* ---- Acciones evento ---- */
  async function guardarTodo() {
    try {
      const patch = buildEventPatch(ev);
      const { error } = await supabase.from("event").update(patch).eq("id", ev.id);
      if (error) throw error;

      const { data: row } = await supabase.from("event").select("*").eq("id", ev.id).maybeSingle();
      if (row) setEv(mapEventRow(row));

      // Persistir ventanas de puntos
      for (const p of puntos) {
        const windows = [{ start: p.horaIni || "06:00", end: p.horaFin || "12:00" }];
        await supabase.from("event_hotspot").update({ windows }).eq("id", p.id);
      }

      alert("Cambios guardados ✨");
    } catch (e) {
      console.error(e);
      alert(e.message || "No se pudo guardar. Probá de nuevo.");
    }
  }
  async function publicarToggle() {
    const nuevo = ev.estado === "publicado" ? "borrador" : "publicado";
    try {
    const { error } = await supabase
        .from("event")
        .update({ 
          estado: nuevo,
          status: nuevo === "publicado" ? "published" : "draft",
        })
        .eq("id", ev.id);      if (error) throw error;
      setEv((o) => ({ ...o, estado: nuevo }));
    } catch (e) {
      console.error(e);
      alert("No se pudo cambiar el estado del evento.");
    }
  }
  function updatePointLocal(pid, patch) {
    setPuntos((arr) => arr.map((p) => (p.id === pid ? { ...p, ...patch } : p)));
  }
  async function addPointFromCatalog(h) {
    try {
      if (!h) return;
      if (puntos.some((p) => p.nombre === (h.name || h.nombre))) {
        return alert("Ya agregaste este punto 😅");
      }
      const routeId = await ensureEventRouteId(ev.id, ev.ruta || "");
      const windows = Array.isArray(h.default_windows) && h.default_windows.length
        ? h.default_windows
        : [{ start: "06:00", end: "12:00" }];

      const payload = {
        event_id: ev.id,
        route_id: routeId,
        // SOLO si es UUID. Si viene un id corto del perfil, lo omitimos
        ...(isUuid(h.id) ? { source_hotspot_id: h.id } : {}),
        name: h.name || h.nombre || "Punto",
        lat: Number(h.lat ?? 0),
        lng: Number(h.lng ?? 0),
        windows,
      };
      const { data: inserted, error } = await supabase
        .from("event_hotspot")
        .insert([payload])
        .select("id, name, windows, route_id")
        .single();
      if (error) throw error;

      const w0 = inserted?.windows?.[0] || {};
      setPuntos((arr) => [
        ...arr,
        {
          id: inserted.id,
          nombre: inserted.name,
          activo: true,
          horaIni: w0.start || "06:00",
          horaFin: w0.end || "12:00",
          route_id: inserted?.route_id || null,
        },
      ]);
      if (!uploadPoint) setUploadPoint(inserted.id);
    } catch (e) {
      console.error(e);
      alert("No se pudo agregar el punto.");
    }
  }
  async function removePoint(pid) {
    try {
      const { error } = await supabase.from("event_hotspot").delete().eq("id", pid);
      if (error) throw error;
      setPuntos((arr) => arr.filter((p) => p.id !== pid));
      if (uploadPoint === pid) setUploadPoint(puntos.find((x) => x.id !== pid)?.id || "");
    } catch (e) {
      console.error(e);
      alert("No se pudo quitar el punto (revisá si no tiene fotos asociadas).");
    }
  }

  /* ---- subida ---- */
  async function getSignedUrl({ eventId, pointId, filename, size, contentType }) {
    const base = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || supabase?.supabaseUrl || "";
    const FN_BASE = (base || "").replace(/\/$/, "");
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token || null;
    const res = await fetch(`${FN_BASE}/functions/v1/signed-event-upload`, {
      method: "POST",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      body: JSON.stringify({ eventId, pointId, filename, size, contentType }),
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out?.error || "No se pudo firmar la subida");
    return out;
  }
  async function onUploaded(assets) {
    try {
      const base = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || supabase?.supabaseUrl || "";
      const FN_BASE = (base || "").replace(/\/$/, "");
      const res = await fetch(`${FN_BASE}/functions/v1/events/${ev.id}/assets/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          (assets || []).map((a) => ({
            path: a.path,
            size: a.size,
            pointId: a.pointId,
            takenAt: a.takenAt,
          }))
        ),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out?.error || "No se pudieron registrar las fotos");

      const { data: rows, error } = await supabase
        .from("event_asset")
        .select("*")
        .eq("event_id", ev.id)
        .order("taken_at", { ascending: true });
      if (error) throw error;
      setFotos(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error(e);
      alert("Se peló registrando las fotos.");
    }
  }

  /* ===== Render ===== */
  if (!authReady) return uiBox("Inicializando sesión…");
  if (noSession)
    return uiBox(
      <>
        Iniciá sesión para editar tu evento.
        <div className="mt-2 text-xs text-slate-400">Si ya iniciaste, recargá esta página.</div>
      </>
    );
  if (loading) return uiBox("Cargando…");
  if (!ev)
    return uiBox(
      <>
        <div className="mb-3 text-lg font-semibold">Evento no encontrado</div>
        <div className="text-xs text-slate-400 mb-3">
          Revisá que la URL sea <code>/studio/eventos/&lt;id&gt;</code>. Param recibido: <code>{paramId || "(vacío)"}</code>
        </div>
        <Link to="/studio/eventos" className="text-blue-400 font-semibold">Volver a eventos</Link>
      </>
    );

  const selectedList = ev.price_list_id ? priceLists.find((l) => l.id === ev.price_list_id) : null;

  return (
    <main className="w-full max-w-[1100px] mx-auto px-5 py-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link to="/studio/eventos" className="text-blue-400 font-semibold">← Volver</Link>
        <h1 className="text-2xl md:text-3xl font-display font-black">{ev.nombre}</h1>
        <span className="text-slate-400">· {fmtDate(ev.fecha)} · {ev.ruta}</span>

        <div className="ml-auto flex items-center gap-2">
          <button className="h-10 px-4 rounded-xl bg-green-600 text-white font-display font-bold border border-white/10" onClick={guardarTodo}>
            Guardar
          </button>
          <button className="h-10 px-4 rounded-xl bg-blue-500 text-white font-display font-bold border border-white/10" onClick={publicarToggle}>
            {ev.estado === "publicado" ? "Despublicar" : "Publicar"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Tab active={tab === "resumen"} onClick={() => setTab("resumen")}>Resumen</Tab>
        <Tab active={tab === "puntos"} onClick={() => setTab("puntos")}>Puntos</Tab>
        <Tab active={tab === "subida"} onClick={() => setTab("subida")}>Subida</Tab>
        <Tab active={tab === "organizar"} onClick={() => setTab("organizar")}>Organizar</Tab>
      </div>

      {/* ===== Resumen ===== */}
      {tab === "resumen" && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold mb-3">Información del evento</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nombre">
                <input className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3" value={ev.nombre} onChange={(e) => setEv({ ...ev, nombre: e.target.value })} />
              </Field>
              <Field label="Fecha">
                <input type="date" className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3" value={ev.fecha} onChange={(e) => setEv({ ...ev, fecha: e.target.value })} />
              </Field>
              <Field label="Ruta">
                <input className="h-11 w-full rounded-lg border border-white/15 bg-white/10 text-white px-3" value={ev.ruta} readOnly />
              </Field>

              <Field label="Precio base (Q)">
                <input type="number" min={1} className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3" value={ev.precioBase || 50} onChange={(e) => setEv({ ...ev, precioBase: Number(e.target.value || 0) })} disabled={!!ev.price_list_id} />
              </Field>
              <Field label="Lista de precios (opcional)">
                <select className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3" value={ev.price_list_id || ""} onChange={(e) => setEv({ ...ev, price_list_id: e.target.value || null })}>
                  <option value="">— Sin lista (usa precio base)</option>
                  {priceLists.map((pl) => (
                    <option key={pl.id} value={pl.id}>{pl.nombre}</option>
                  ))}
                </select>
              </Field>

              <Field label="Notas (privadas)" full>
                <textarea rows={3} className="w-full rounded-lg border border-white/15 bg-white/5 text-white px-3 py-2" value={ev.notas || ""} onChange={(e) => setEv({ ...ev, notas: e.target.value })} />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold mb-3">Resumen</h3>
            <div className="grid grid-cols-2 gap-3">
              <KPI label="Puntos" value={puntos.length} />
              <KPI label="Fotos" value={fotos.length} />
              <div className="col-span-2">
                <div className="text-xs text-slate-400 mb-1">Estado</div>
                <div className="text-sm font-semibold">{ev.estado}</div>
              </div>
            </div>
            {ev.price_list_id && selectedList ? (
              <div className="mt-4">
                <div className="text-xs text-slate-400 mb-1">Lista seleccionada</div>
                <div className="text-sm font-semibold mb-2">{selectedList.nombre}</div>
                <div className="text-xs text-white/70">Si hay <strong>lista</strong>, manda sobre el precio base.</div>
              </div>
            ) : (
              <div className="mt-4 text-xs text-white/70">Sin lista asignada. Se usará <strong>precio base</strong> (Q{ev.precioBase || 50}).</div>
            )}
          </div>
        </section>
      )}

      {/* ===== Puntos ===== */}
      {tab === "puntos" && (
        <section className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Puntos de foto</h3>
            </div>

            {puntos.length === 0 ? (
              <div className="text-slate-300 text-sm">Aún no agregaste puntos al evento.</div>
            ) : (
              <div className="space-y-3">
                {puntos.map((p) => {
                  const count = (fotos || []).filter((f) => (f.hotspot_id || null) === p.id).length;
                  return (
                    <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1">
                        <div className="font-semibold">{p.nombre}</div>
                        <div className="text-xs text-slate-400">
                          {p.horaIni || "—"} – {p.horaFin || "—"} · {count} foto{count === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div className="sm:w-[300px] grid grid-cols-3 gap-2">
                        <input type="time" className="h-10 rounded-lg border border-white/15 bg-white/5 text-white px-2" value={p.horaIni || ""} onChange={(e) => updatePointLocal(p.id, { horaIni: e.target.value })} />
                        <input type="time" className="h-10 rounded-lg border border-white/15 bg-white/5 text-white px-2" value={p.horaFin || ""} onChange={(e) => updatePointLocal(p.id, { horaFin: e.target.value })} />
                        <label className="inline-flex items-center gap-2 justify-center rounded-lg border border-white/15 bg-white/5">
                          <input type="checkbox" checked={!!p.activo} onChange={(e) => updatePointLocal(p.id, { activo: e.target.checked })} />
                          <span className="text-sm">Activo</span>
                        </label>
                      </div>
                      <button className="h-9 px-3 rounded-xl bg-red-600 text-white font-display font-bold" onClick={() => removePoint(p.id)}>Quitar</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold mb-3">Agregar desde mi catálogo</h3>

            {loadingCatalog ? (
              <div className="text-slate-300 text-sm">Cargando catálogo…</div>
            ) : (catalogFiltered || []).length === 0 ? (
              <div className="text-slate-300 text-sm">
                {catalog.length === 0
                  ? "No hay puntos en tu catálogo aún."
                  : `No hay puntos para la ruta “${ev.ruta}”. Cambiá la ruta del evento o creá puntos en tu perfil.`}
              </div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
                {catalogFiltered
                  .filter((h) => !puntos.some((p) => p.nombre === h.name))
                  .map((h, i) => (
                    <div key={h.key || `${h.name}-${h.route_name}-${h.lat}-${h.lng}-${i}`} className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{h.name}</div>
                        <div className="text-xs text-slate-400">{h.route_name}</div>
                        {Array.isArray(h.default_windows) && h.default_windows[0] && (
                          <div className="text-xs text-slate-400">
                            {h.default_windows[0].start}–{h.default_windows[0].end}
                          </div>
                        )}
                      </div>
                      <button className="h-8 px-3 rounded-lg bg-blue-600 text-white" onClick={() => addPointFromCatalog(h)}>
                        Agregar
                      </button>
                    </div>
                  ))}
                {catalogFiltered.length > 0 &&
                  catalogFiltered.every((h) => puntos.some((p) => p.nombre === h.name)) && (
                    <div className="text-slate-300 text-sm">Ya agregaste todos los puntos de esta ruta 🙌</div>
                  )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ===== Subida ===== */}
      {tab === "subida" && (
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold mb-3">Subida de fotos</h3>
            {puntos.length === 0 ? (
              <div className="text-slate-300 text-sm">Agregá al menos un punto para habilitar la subida.</div>
            ) : (
              <UploadManager
                eventId={ev.id}
                pointId={uploadPoint || puntos[0]?.id || null}
                onUploaded={onUploaded}
                getSignedUrl={getSignedUrl}
                options={{ watermark: { src: null, scale: 0.25, opacity: 0.5, position: "br" } }}
              />
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3">
              <div className="text-xs text-slate-400 mb-1">Asignar al punto</div>
              <select className="h-10 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3" value={uploadPoint} onChange={(e) => setUploadPoint(e.target.value)}>
                {(puntos.length ? puntos : [{ id: "", nombre: "—" }]).map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-400">Arrastrá y soltá tus fotos. Se suben con URL firmada y luego se registran en la base.</div>
          </div>
        </section>
      )}

      {/* ===== Organizar ===== */}
      {tab === "organizar" && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="font-semibold mb-3">Organizar por punto</h3>
          {puntos.length === 0 ? (
            <div className="text-slate-300 text-sm">Sin puntos aún.</div>
          ) : (
            <div className="space-y-4">
              {puntos.map((p) => {
                const list = fotosPorPunto.get(p.id) || [];
                return (
                  <div key={p.id}>
                    <div className="font-semibold mb-2">
                      {p.nombre} · {p.horaIni ?? "—"}–{p.horaFin ?? "—"} · {list.length} foto{list.length === 1 ? "" : "s"}
                    </div>
                    {list.length === 0 ? (
                      <div className="text-slate-300 text-sm">Sin fotos aún.</div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {list.map((f) => (
                          <img key={f.id} src={f.public_url || f.storage_path} alt="" className="w-full h-28 object-cover rounded-lg" />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

/* ===== UI helpers ===== */
function uiBox(children) {
  return (
    <main className="w-full max-w-[1100px] mx-auto px-5 py-8">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">{children}</div>
    </main>
  );
}
function Tab({ active, onClick, children }) {
  return (
    <button
      className={
        "h-9 px-3 rounded-lg border " +
        (active ? "bg-blue-600 text-white border-white/10" : "bg-white/5 text-white border-white/15")
      }
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
function Field({ label, full, children }) {
  return (
    <label className={"block " + (full ? "sm:col-span-2" : "")}>
      <div className="mb-1 text-sm text-slate-300">{label}</div>
      {children}
    </label>
  );
}
function KPI({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 p-3 bg-white/5">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="text-xl font-display font-bold">{value}</div>
    </div>
  );
}
