import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import UploadManager from "./upload/UploadManager.jsx"; // ajustá si tu ruta es distinta
import { createClient } from "@supabase/supabase-js";

/* ================== Supabase client ================== */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "") || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ================== Functions base (para firmar/registrar) ================== */
const FN_BASE =
  (import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || "").replace(/\/$/, "") ||
  SUPABASE_URL; // en prod las functions también cuelgan del dominio .co

/* ================== Helpers ================== */
const fmtDate = (isoDate) =>
  new Date(isoDate + "T00:00:00").toLocaleDateString("es-GT", {
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
    ruta: row.ruta ?? row.route ?? "",
    estado: row.estado ?? row.status ?? "borrador",
    precioBase: row.precioBase ?? row.base_price ?? 50,
    notas: row.notas ?? row.notes ?? "",
  };
}

function buildEventPatch(ev) {
  return {
    // usá tus columnas reales de la tabla "event"
    nombre: ev.nombre,
    fecha: ev.fecha,
    ruta: ev.ruta,
    estado: ev.estado,
    precioBase: ev.precioBase,
    notas: ev.notas,
  };
}

/* ================== Componente ================== */
export default function EventoEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const initialTab = params.get("tab") || "resumen";

  const [ev, setEv] = useState(null);
  const [fotos, setFotos] = useState([]); // event_asset
  const [puntos, setPuntos] = useState([]); // si luego los querés persistir, hacemos otra función
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(initialTab);

  /* ===== Cargar evento + assets ===== */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);

        // 1) evento
        const { data: row, error } = await supabase
          .from("event")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (!row) throw new Error("Evento no encontrado");
        const evUI = mapEventRow(row);

        // 2) assets del evento
        const { data: assets, error: aErr } = await supabase
          .from("event_asset")
          .select("*")
          .eq("event_id", id)
          .order("taken_at", { ascending: true });
        if (aErr) throw aErr;

        if (!mounted) return;
        setEv(evUI);
        setFotos(assets || []);
        // si vos querés precargar puntos desde el perfil, lo podés hacer igualito que en Eventos.jsx. :contentReference[oaicite:2]{index=2}
        setPuntos([]); // por ahora vacío (UI)
      } catch (e) {
        console.error(e);
        if (mounted) setEv(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, [id]);

  // ⚠️ Hooks siempre antes de cualquier return condicional
  const fotosPorPunto = useMemo(() => {
    const map = new Map();
    const all = Array.isArray(fotos) ? fotos : [];        // si usás `fotos` en esta versión
    const puntosList = Array.isArray(puntos) ? puntos : []; // si usás `puntos` en esta versión
    all.forEach((f) => {
      const key = f.hotspot_id || null;
      const arr = map.get(key) || [];
      arr.push(f);
      map.set(key, arr);
    });
    for (const [, arr] of map) {
      arr.sort((a, b) => new Date(a.taken_at) - new Date(b.taken_at));
    }
    return map;
  }, [fotos, puntos]);

  const [uploadPoint, setUploadPoint] = useState(() => {
    // seed inicial seguro aunque ev/puntos aún no existan
    return Array.isArray(puntos) && puntos.length ? puntos[0].id : "";
  });

  if (loading) {
    return (
      <main className="w-full max-w-[1100px] mx-auto px-5 py-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">Cargando…</div>
      </main>
    );
  }
  if (!ev) {
    return (
      <main className="w-full max-w-[1100px] mx-auto px-5 py-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="mb-3 text-lg font-semibold">Evento no encontrado</div>
          <Link to="/studio/eventos" className="text-blue-400 font-semibold">Volver a eventos</Link>
        </div>
      </main>
    );
  }

  /* ===== Guardar evento ===== */
  async function guardarTodo() {
    try {
      const patch = buildEventPatch(ev);
      const { error } = await supabase
        .from("event")
        .update(patch, { returning: "minimal" })
        .eq("id", ev.id);
      if (error) throw error;

      // recargar por si el trigger cambió algo
      const { data: row } = await supabase.from("event").select("*").eq("id", ev.id).maybeSingle();
      if (row) setEv(mapEventRow(row));

      alert("Cambios guardados ✨");
    } catch (e) {
      console.error(e);
      alert(e.message || "No se pudo guardar. Probá de nuevo.");
    }
  }

  function updateEvent(localPatch) {
    setEv((old) => ({ ...old, ...localPatch }));
  }

  /* ===== Publicar / Despublicar ===== */
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

  /* ===== Subida ===== */

  // 1) Conseguir URL firmada para subir (usa tu edge function EXISTENTE)
  async function getSignedUrl({ eventId, pointId, filename, size, contentType }) {
    // si querés mandar JWT del usuario, copiá el patrón de tu Perfil (getSession + Authorization). :contentReference[oaicite:3]{index=3}
    const res = await fetch(`${FN_BASE}/functions/v1/signed-event-upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, pointId, filename, size, contentType }),
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out?.error || "No se pudo firmar la subida");
    return out; // { uploadUrl, path }
  }

  // 2) Registrar en DB después de subir (usa tu edge function EXISTENTE)
  async function onUploaded(assets) {
    // assets: [{ path, size, pointId, takenAt }]
    try {
      const res = await fetch(`${FN_BASE}/functions/v1/events/${ev.id}/assets/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          assets.map((a) => ({
            path: a.path,
            size: a.size,
            pointId: a.pointId,
            takenAt: a.takenAt,
          }))
        ),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out?.error || "No se pudieron registrar las fotos");

      // refrescar los assets desde la tabla
      const { data: rows, error } = await supabase
        .from("event_asset")
        .select("*")
        .eq("event_id", ev.id)
        .order("taken_at", { ascending: true });
      if (error) throw error;
      setFotos(rows || []);
    } catch (e) {
      console.error(e);
      alert("Se peló registrando las fotos.");
    }
  }

  /* ===== UI ===== */
  const fotosPorPunto = useMemo(() => {
    const map = new Map();
    (fotos || []).forEach((f) => {
      const arr = map.get(f.hotspot_id || null) || [];
      arr.push(f);
      map.set(f.hotspot_id || null, arr);
    });
    for (const [, arr] of map) arr.sort((a, b) => new Date(a.taken_at) - new Date(b.taken_at));
    return map;
  }, [fotos]);

  const [uploadPoint, setUploadPoint] = useState(puntos[0]?.id || "");

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

          <Link
            to={`/app/buscar?hotspots=${puntos.map((p) => p.id).join(",")}`}
            className="h-10 px-4 rounded-xl border border-white/15 bg-white/5 text-white font-display font-bold inline-flex items-center justify-center"
            target="_blank"
            rel="noreferrer"
          >
            Ver como Biker
          </Link>

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
                  readOnly // no editable aquí
                />
              </Field>
              <Field label="Precio base (Q)">
                <input
                  type="number"
                  min={1}
                  className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3"
                  value={ev.precioBase || 50}
                  onChange={(e) => updateEvent({ precioBase: Number(e.target.value || 0) })}
                />
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
            <div className="grid grid-cols-3 gap-3">
              <KPI label="Puntos" value={puntos.length} />
              <KPI label="Fotos" value={fotos.length} />
              <KPI label="Estado" value={ev.estado} />
            </div>
          </div>
        </section>
      )}

      {/* ===== Puntos (solo UI por ahora) ===== */}
      {tab === "puntos" && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="font-semibold mb-3">Puntos de foto</h3>
          {puntos.length === 0 ? (
            <div className="text-slate-300 text-sm">Aún no agregaste puntos.</div>
          ) : (
            <div className="space-y-3">
              {puntos.map((p) => {
                const count = (fotos || []).filter((f) => (f.hotspot_id || null) === p.id).length;
                return (
                  <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1">
                      <div className="font-semibold">{p.nombre}</div>
                      <div className="text-xs text-slate-400">{p.horaIni} – {p.horaFin} · {count} foto{count === 1 ? "" : "s"}</div>
                    </div>
                    <div className="sm:w-[300px] grid grid-cols-3 gap-2">
                      <input
                        type="time"
                        className="h-10 rounded-lg border border-white/15 bg-white/5 text-white px-2"
                        value={p.horaIni}
                        onChange={(e) => setPuntos((arr) => arr.map((x) => x.id === p.id ? { ...x, horaIni: e.target.value } : x))}
                      />
                      <input
                        type="time"
                        className="h-10 rounded-lg border border-white/15 bg-white/5 text-white px-2"
                        value={p.horaFin}
                        onChange={(e) => setPuntos((arr) => arr.map((x) => x.id === p.id ? { ...x, horaFin: e.target.value } : x))}
                      />
                      <label className="inline-flex items-center gap-2 justify-center rounded-lg border border-white/15 bg-white/5">
                        <input
                          type="checkbox"
                          checked={p.activo}
                          onChange={(e) => setPuntos((arr) => arr.map((x) => x.id === p.id ? { ...x, activo: e.target.checked } : x))}
                        />
                        <span className="text-sm">Activo</span>
                      </label>
                    </div>
                    <button
                      className="h-9 px-3 rounded-xl bg-red-600 text-white font-display font-bold"
                      onClick={() => setPuntos((arr) => arr.filter((x) => x.id !== p.id))}
                    >
                      Quitar
                    </button>
                  </div>
                );
              })}
            </div>
          )}
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
                pointId={puntos[0]?.id || null}    // elegí tu punto destino
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
                value={puntos[0]?.id || ""}
                onChange={(e) => {
                  const pid = e.target.value;
                  // mover el punto seleccionado a la primera posición (simple)
                  setPuntos((arr) => {
                    const found = arr.find((x) => x.id === pid);
                    if (!found) return arr;
                    return [found, ...arr.filter((x) => x.id !== pid)];
                  });
                }}
              >
                {puntos.map((p) => (
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
                    <div className="font-semibold mb-2">{p.nombre} · {p.horaIni ?? "—"}–{p.horaFin ?? "—"} · {list.length} foto{list.length === 1 ? "" : "s"}</div>
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

/* ================== UI ================== */
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
