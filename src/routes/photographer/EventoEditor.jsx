// src/routes/photographer/EventoEditor.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import UploadManager from "./upload/UploadManager.jsx";
import { supabase } from "../../lib/supabaseClient";

/* ============ Helpers ============ */
const fmtDate = (iso) =>
  new Date((iso || "") + "T00:00:00").toLocaleDateString("es-GT", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

function mapEventRow(row) {
  return {
    id: row.id,
    nombre: row.nombre ?? row.title ?? `Evento ${row.id}`,
    fecha: row.fecha ?? row.date ?? new Date().toISOString().slice(0, 10),
    ruta: row.ruta ?? row.location ?? "",
    estado: row.estado ?? row.status ?? "borrador",
    precioBase: row.precio_base ?? row.base_price ?? row.precioBase ?? 50,
    notas: row.notas ?? row.notes ?? "",
    price_list_id: row.price_list_id ?? null,
    photographer_id: row.photographer_id ?? row.created_by ?? null,
  };
}
function buildEventPatch(ev) {
  return {
    nombre: ev.nombre,
    fecha: ev.fecha,
    ruta: ev.ruta,
    location: ev.ruta,            // oficial
    estado: ev.estado,
    precio_base: ev.precioBase,   // unificado
    notas: ev.notas,
    price_list_id: ev.price_list_id || null,
  };
}

/* ============ Componente ============ */
export default function EventoEditor() {
  // Param flexible por si tu route usa :id / :eventId / :evId
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

  // Subida
  const [uploadPoint, setUploadPoint] = useState("");

  // Listas de precios del fotógrafo
  const [priceLists, setPriceLists] = useState([]);
  const [loadingLists, setLoadingLists] = useState(true);

  // Catálogo del fotógrafo
  const [catalog, setCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // Agrupar fotos x punto (defensivo)
  const fotosPorPunto = useMemo(() => {
    const map = new Map();
    const all = Array.isArray(fotos) ? fotos : [];
    all.forEach((f) => {
      const key = f?.hotspot_id || null;
      const arr = map.get(key) || [];
      arr.push(f);
      map.set(key, arr);
    });
    for (const [, arr] of map) {
      arr.sort((a, b) => new Date(a?.taken_at || 0) - new Date(b?.taken_at || 0));
    }
    return map;
  }, [fotos]);

  // default point para subida
  useEffect(() => {
    if (!uploadPoint && Array.isArray(puntos) && puntos.length) {
      setUploadPoint(puntos[0].id);
    }
  }, [puntos, uploadPoint]);

  /* ---- Esperar sesión (evita RLS vacías) ---- */
  useEffect(() => {
    let unsub = null;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) {
        unsub = supabase.auth.onAuthStateChange((_event, session) => {
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

  /* ---- Cargar evento + assets ---- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!authReady) return;
        if (!paramId) throw new Error("Falta el id del evento en la URL");
        setLoading(true);

        // 1) evento
        const { data: row, error } = await supabase
          .from("event")
          .select("*")
          .eq("id", paramId)
          .maybeSingle();
        if (error) throw error;
        if (!row) throw new Error("Evento no encontrado");
        const evUI = mapEventRow(row);
        if (!mounted) return;
        setEv(evUI);

        // 2) assets
        const { data: assets, error: aErr } = await supabase
          .from("event_asset")
          .select("*")
          .eq("event_id", paramId)
          .order("taken_at", { ascending: true }); // esta sí existe
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramId, authReady]);

  /* ---- Cargar listas de precios ---- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingLists(true);
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess?.session?.user?.id || null;
        if (!uid) {
          if (mounted) setPriceLists([]);
          return;
        }
        const { data: lrows, error: lerr } = await supabase
          .from("photographer_price_list")
          .select("id, nombre, items")
          .eq("photographer_id", uid)
          .order("id", { ascending: true }); // ✅ sin created_at
        if (lerr) throw lerr;
        if (!mounted) return;
        setPriceLists(
          Array.isArray(lrows)
            ? lrows.map((r) => ({
                id: r.id,
                nombre: r.nombre,
                items: Array.isArray(r.items) ? r.items : [],
              }))
            : []
        );
      } catch (e) {
        console.warn("[EventoEditor] price lists error:", e?.message || e);
        if (mounted) setPriceLists([]);
      } finally {
        if (mounted) setLoadingLists(false);
      }
    })();
    return () => (mounted = false);
  }, []);

  /* ---- Cargar catálogo (sin join embebido, sin created_at) ---- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingCatalog(true);
        if (!ev?.photographer_id) {
          if (mounted) setCatalog([]);
          return;
        }
        const { data: hs, error: hErr } = await supabase
          .from("photographer_hotspot")
          .select("id, name, lat, lng, default_windows, route_id")
          .eq("photographer_id", ev.photographer_id)
          .order("id", { ascending: true }); // ✅ sin created_at
        if (hErr) throw hErr;
        if (!mounted) return;
        setCatalog(
          Array.isArray(hs)
            ? hs.map((h) => ({
                id: h.id,
                name: h.name,
                lat: h.lat,
                lng: h.lng,
                route_id: h.route_id,
                default_windows: Array.isArray(h.default_windows) ? h.default_windows : [],
              }))
            : []
        );
      } catch (e) {
        console.warn("[EventoEditor] catalog error:", e?.message || e);
        if (mounted) setCatalog([]);
      } finally {
        if (mounted) setLoadingCatalog(false);
      }
    })();
    return () => (mounted = false);
  }, [ev?.photographer_id]);

  /* ---- Cargar puntos del evento (sin created_at) ---- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!ev?.id) return;
        const { data: ehs, error: ehErr } = await supabase
          .from("event_hotspot")
          .select("id, name, lat, lng, time_windows, route_id")
          .eq("event_id", ev.id)
          .order("id", { ascending: true }); // ✅ sin created_at
        if (ehErr) throw ehErr;

        const puntosIniciales = (Array.isArray(ehs) ? ehs : []).map((h) => ({
          id: h.id,
          nombre: h.name || "Punto",
          activo: true,
          horaIni: (Array.isArray(h.time_windows) && h.time_windows[0]?.start) || "06:00",
          horaFin: (Array.isArray(h.time_windows) && h.time_windows[0]?.end) || "12:00",
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
  function toTimeWindows(horaIni, horaFin) {
    const start = (horaIni || "06:00").trim();
    const end = (horaFin || "12:00").trim();
    return [{ start, end }];
  }

  /* ---- acciones: guardar / publicar ---- */
  async function guardarTodo() {
    try {
      const patch = buildEventPatch(ev);
      const { error } = await supabase
        .from("event")
        .update(patch, { returning: "minimal" })
        .eq("id", ev.id);
      if (error) throw error;

      // refrescar encabezado
      const { data: row } = await supabase.from("event").select("*").eq("id", ev.id).maybeSingle();
      if (row) setEv(mapEventRow(row));

      // persistir time_windows de puntos
      for (const p of puntos) {
        const time_windows = toTimeWindows(p.horaIni, p.horaFin);
        await supabase.from("event_hotspot").update({ time_windows }).eq("id", p.id);
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
        .update({ estado: nuevo }, { returning: "minimal" })
        .eq("id", ev.id);
      if (error) throw error;
      setEv((o) => ({ ...o, estado: nuevo }));
    } catch (e) {
      console.error(e);
      alert("No se pudo cambiar el estado del evento.");
    }
  }
  function updateEvent(localPatch) {
    setEv((old) => ({ ...old, ...localPatch }));
  }

  /* ---- puntos (persistiendo en event_hotspot) ---- */
  function updatePointLocal(pid, patch) {
    setPuntos((arr) => arr.map((p) => (p.id === pid ? { ...p, ...patch } : p)));
  }
  async function addPointFromCatalog(h) {
    try {
      if (!h) return;
      if (puntos.some((p) => p.nombre === (h.name || h.nombre))) {
        return alert("Ya agregaste este punto 😅");
      }
      // Si tu evento guarda la ruta en ev.ruta (texto), aseguramos event_route
      const routeId = await ensureEventRouteId(ev.id, ev.ruta || "");
      const dw = Array.isArray(h.default_windows) && h.default_windows.length
        ? h.default_windows
        : toTimeWindows("06:00", "12:00");

      const payload = {
        event_id: ev.id,
        route_id: routeId,
        source_hotspot_id: h.id,
        name: h.name || h.nombre || "Punto",
        lat: h.lat,
        lng: h.lng,
        time_windows: dw,
      };
      const { data: inserted, error } = await supabase
        .from("event_hotspot")
        .insert([payload])
        .select("id, name, time_windows, route_id")
        .single();
      if (error) throw error;

      const horaIni = inserted?.time_windows?.[0]?.start || "06:00";
      const horaFin = inserted?.time_windows?.[0]?.end || "12:00";
      setPuntos((arr) => [
        ...arr,
        {
          id: inserted.id,
          nombre: inserted.name,
          activo: true,
          horaIni,
          horaFin,
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

  /* ---- subida de fotos ---- */
  async function getSignedUrl({ eventId, pointId, filename, size, contentType }) {
    const base = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || supabase?.supabaseUrl || "";
    const FN_BASE = (base || "").replace(/\/$/, "");
    const res = await fetch(`${FN_BASE}/functions/v1/signed-event-upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
          <button
            className="h-10 px-4 rounded-xl bg-green-600 text-white font-display font-bold inline-flex items-center justify-center border border-white/10"
            onClick={guardarTodo}
            title="Guardar todos los cambios del evento"
          >
            Guardar
          </button>
          <button
            className="h-10 px-4 rounded-xl bg-blue-500 text-white font-display font-bold inline-flex items-center justify-center border border-white/10"
            onClick={publicarToggle}
          >
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
                <input
                  className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3"
                  value={ev.nombre}
                  onChange={(e) => updateEvent({ nombre: e.target.value })}
                />
              </Field>
              <Field label="Fecha">
                <input
                  type="date"
                  className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3"
                  value={ev.fecha}
                  onChange={(e) => updateEvent({ fecha: e.target.value })}
                />
              </Field>
              <Field label="Ruta">
                <input
                  className="h-11 w-full rounded-lg border border-white/15 bg-white/10 text-white px-3"
                  value={ev.ruta}
                  readOnly
                />
              </Field>

              <Field label="Precio base (Q)">
                <input
                  type="number"
                  min={1}
                  className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3"
                  value={ev.precioBase || 50}
                  onChange={(e) => updateEvent({ precioBase: Number(e.target.value || 0) })}
                  disabled={!!ev.price_list_id}
                />
              </Field>
              <Field label="Lista de precios (opcional)">
                <select
                  className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3"
                  value={ev.price_list_id || ""}
                  onChange={(e) => updateEvent({ price_list_id: e.target.value || null })}
                >
                  <option value="">— Sin lista (usa precio base)</option>
                  {priceLists.map((pl) => (
                    <option key={pl.id} value={pl.id}>{pl.nombre}</option>
                  ))}
                </select>
              </Field>

              <Field label="Notas (privadas)" full>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-white/15 bg-white/5 text-white px-3 py-2"
                  value={ev.notas || ""}
                  onChange={(e) => updateEvent({ notas: e.target.value })}
                />
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
            {ev.price_list_id && (priceLists.find((l) => l.id === ev.price_list_id)) ? (
              <div className="mt-4">
                <div className="text-xs text-slate-400 mb-1">Lista seleccionada</div>
                <div className="text-sm font-semibold mb-2">
                  {priceLists.find((l) => l.id === ev.price_list_id)?.nombre}
                </div>
                <div className="text-xs text-white/70">
                  Nota: Si hay <strong>lista</strong>, esa manda sobre el precio base para el público.
                </div>
              </div>
            ) : (
              <div className="mt-4 text-xs text-white/70">
                Sin lista asignada. Se usará <strong>precio base</strong> (Q{ev.precioBase || 50}).
              </div>
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
                    <div
                      key={p.id}
                      className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col sm:flex-row sm:items-center gap-3"
                    >
                      <div className="flex-1">
                        <div className="font-semibold">{p.nombre}</div>
                        <div className="text-xs text-slate-400">
                          {p.horaIni || "—"} – {p.horaFin || "—"} · {count} foto{count === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div className="sm:w-[300px] grid grid-cols-3 gap-2">
                        <input
                          type="time"
                          className="h-10 rounded-lg border border-white/15 bg-white/5 text-white px-2"
                          value={p.horaIni || ""}
                          onChange={(e) => updatePointLocal(p.id, { horaIni: e.target.value })}
                        />
                        <input
                          type="time"
                          className="h-10 rounded-lg border border-white/15 bg-white/5 text-white px-2"
                          value={p.horaFin || ""}
                          onChange={(e) => updatePointLocal(p.id, { horaFin: e.target.value })}
                        />
                        <label className="inline-flex items-center gap-2 justify-center rounded-lg border border-white/15 bg-white/5">
                          <input
                            type="checkbox"
                            checked={!!p.activo}
                            onChange={(e) => updatePointLocal(p.id, { activo: e.target.checked })}
                          />
                          <span className="text-sm">Activo</span>
                        </label>
                      </div>
                      <button
                        className="h-9 px-3 rounded-xl bg-red-600 text-white font-display font-bold"
                        onClick={() => removePoint(p.id)}
                      >
                        Quitar
                      </button>
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
            ) : (catalog || []).length === 0 ? (
              <div className="text-slate-300 text-sm">No hay puntos en tu catálogo aún.</div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
                {(catalog || [])
                  .filter((h) => !puntos.some((p) => p.nombre === h.name))
                  .map((h) => (
                    <div
                      key={h.id}
                      className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">{h.name}</div>
                        {Array.isArray(h.default_windows) && h.default_windows[0] && (
                          <div className="text-xs text-slate-400">
                            {h.default_windows[0].start}–{h.default_windows[0].end}
                          </div>
                        )}
                      </div>
                      <button
                        className="h-8 px-3 rounded-lg bg-blue-600 text-white"
                        onClick={() => addPointFromCatalog(h)}
                      >
                        Agregar
                      </button>
                    </div>
                  ))}
                {(catalog || []).length > 0 &&
                  (catalog || []).every((h) => puntos.some((p) => p.nombre === h.name)) && (
                    <div className="text-slate-300 text-sm">Ya agregaste todos los puntos de tu catálogo 🙌</div>
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
              <div className="text-slate-300 text-sm">Agregá al menos un punto del catálogo para habilitar la subida.</div>
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
              <select
                className="h-10 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3"
                value={uploadPoint}
                onChange={(e) => setUploadPoint(e.target.value)}
              >
                {(puntos.length ? puntos : [{ id: "", nombre: "—" }]).map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-400">
              Arrastrá y soltá tus fotos. Se suben con URL firmada y luego se registran en la base.
            </div>
          </div>
        </section>
      )}

      {/* ===== Organizar ===== */}
      {tab === "organizar" && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="font-semibold mb-3">Organizar por punto</h3>
          {puntos.length === 0 ? (
            <div className="text-slate-300 text-sm">No hay puntos.</div>
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
                          <img
                            key={f.id}
                            src={f.public_url || f.storage_path}
                            alt=""
                            className="w-full h-28 object-cover rounded-lg"
                          />
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

/* ============ UI helpers ============ */
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
