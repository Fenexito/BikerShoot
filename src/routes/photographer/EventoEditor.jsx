import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import UploadManager from "./upload/UploadManager.jsx"; // 👈 tu ruta real del UploadManager

/* ================== Helpers de formato ================== */
const fmtDate = (isoDate) =>
  new Date(isoDate + "T00:00:00").toLocaleDateString("es-GT", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

/* ================== Mapeos backend <-> UI ================== */
// ✅ Convierte la respuesta de /events/:id a la forma que usa este editor (ev)
function mapEventFromApi(d) {
  const puntos = Array.isArray(d?.event_hotspot)
    ? d.event_hotspot.map((h) => {
        let horaIni = "06:00";
        let horaFin = "12:00";
        if (Array.isArray(h?.windows) && h.windows.length > 0) {
          const w0 = h.windows[0];
          if (w0?.start) horaIni = w0.start;
          if (w0?.end) horaFin = w0.end;
        }
        return {
          id: h.id,
          nombre: h.name || `Punto ${h.id}`,
          activo: h.active ?? true,
          horaIni,
          horaFin,
        };
      })
    : [];

  const fotos = Array.isArray(d?.event_asset)
    ? d.event_asset.map((a) => ({
        id: a.id,
        url: a.public_url || a.storage_path || "",
        puntoId: a.hotspot_id || null,
        timestamp: a.taken_at || new Date().toISOString(),
      }))
    : [];

  return {
    id: d.id,
    nombre: d.nombre || d.title || `Evento ${d.id}`,
    fecha: d.fecha || d.date || new Date().toISOString().slice(0, 10),
    ruta: d.ruta || d.location || "", // 👈 solo lectura en UI
    estado: d.estado || d.status || "borrador",
    precioBase: d.precioBase ?? d.base_price ?? 50,
    notas: d.notas || d.notes || "",
    puntos,
    fotos,
    _raw: d,
  };
}

// ✅ payload mínimo para PUT /events/:id (botón Guardar)
function buildEventPatch(ev) {
  return {
    nombre: ev.nombre,
    fecha: ev.fecha,
    ruta: ev.ruta,          // aunque no se edite aquí, lo mandamos igual
    estado: ev.estado,
    precioBase: ev.precioBase,
    notas: ev.notas,
  };
}

/* ================== Editor ================== */
export default function EventoEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const initialTab = params.get("tab") || "resumen";

  const FN_BASE =
    (import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || "").replace(/\/$/, "") ||
    (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");

  const [ev, setEv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(initialTab);

  // Cargar evento
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch(`${FN_BASE}/functions/v1/events/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        if (!d || d.error) throw new Error(d?.error || "Evento no encontrado");
        setEv(mapEventFromApi(d));
      })
      .catch((e) => {
        console.error(e);
        setEv(null);
      })
      .finally(() => mounted && setLoading(false));
    return () => (mounted = false);
  }, [id, FN_BASE]);

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
          <Link to="/studio/eventos" className="text-blue-400 font-semibold">
            Volver a eventos
          </Link>
        </div>
      </main>
    );
  }

  /* ===== Guardado simple del evento ===== */
  async function persistPatch(patch) {
    const res = await fetch(`${FN_BASE}/functions/v1/events/${ev.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Error al guardar");
    return data;
  }

  function updateEvent(localPatch, persist = false) {
    const next = { ...ev, ...localPatch };
    setEv(next);
    if (persist) {
      const payload = buildEventPatch(next);
      persistPatch(payload)
        .then((d) => setEv(mapEventFromApi(d)))
        .catch((e) => {
          console.error(e);
          alert("No se pudo guardar los cambios del evento.");
        });
    }
  }

  async function guardarTodo() {
    try {
      const patch = buildEventPatch(ev);
      const saved = await persistPatch(patch);
      setEv(mapEventFromApi(saved));
      alert("Cambios guardados ✨");
    } catch (e) {
      console.error(e);
      alert(e.message || "No se pudo guardar. Probá de nuevo.");
    }
  }

  /* ===== Puntos (UI local por ahora) ===== */
  function updatePoint(pid, patch) {
    const puntos = ev.puntos.map((p) => (p.id === pid ? { ...p, ...patch } : p));
    setEv({ ...ev, puntos });
  }
  function addPointFromCatalog(h) {
    if (ev.puntos.some((x) => x.id === h.id)) return;
    const puntos = [
      ...ev.puntos,
      {
        id: h.id,
        nombre: h.name || h.nombre || "Punto",
        activo: true,
        horaIni: (h.default_windows?.[0]?.start) || "06:00",
        horaFin: (h.default_windows?.[0]?.end) || "12:00",
      },
    ];
    setEv({ ...ev, puntos });
  }
  function removePoint(pid) {
    const puntos = ev.puntos.filter((p) => p.id !== pid);
    setEv({ ...ev, puntos });
  }

  // Catálogo mock (lado derecho) — en tu app real viene del perfil del fotógrafo
  const myCatalog = (ev._raw?.catalog_hotspots || []).length
    ? ev._raw.catalog_hotspots
    : []; // si ya traés un catálogo en tu /events/:id, úsalo; si no, dejalo vacío

  /* ===== Subida (UploadManager) ===== */
  const [uploadPoint, setUploadPoint] = useState(ev.puntos[0]?.id || "");

  // 1) firmar subida (URL firmada en Supabase Storage)
  async function getSignedUrl({ eventId, pointId, filename, size, contentType }) {
    // si tenés supabase-js global y querés mandar Authorization, lo podés agregar aquí
    // const { data: sess } = await window.supabase?.auth?.getSession?.() || { data: null };
    // const token = sess?.session?.access_token;

    const res = await fetch(`${FN_BASE}/functions/v1/signed-event-upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ eventId, pointId, filename, size, contentType }),
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out?.error || "No se pudo firmar la subida");
    return out; // { uploadUrl, path, headers? }
  }

  // 2) registrar después de subir (DB: event_asset)
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

      // refrescar evento para ver las fotos nuevas
      const r2 = await fetch(`${FN_BASE}/functions/v1/events/${ev.id}`);
      const d2 = await r2.json();
      if (!r2.ok) throw new Error(d2?.error || "No se pudo refrescar evento");
      setEv(mapEventFromApi(d2));
    } catch (e) {
      console.error(e);
      alert("Se peló registrando las fotos.");
    }
  }

  const fotosPorPunto = useMemo(() => {
    const map = new Map();
    (ev.fotos || []).forEach((f) => {
      const arr = map.get(f.puntoId) || [];
      arr.push(f);
      map.set(f.puntoId, arr);
    });
    for (const [k, arr] of map) {
      arr.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }
    return map;
  }, [ev.fotos]);

  async function publicarToggle() {
    const nuevo = ev.estado === "publicado" ? "borrador" : "publicado";
    try {
      const res = await fetch(`${FN_BASE}/functions/v1/events/${ev.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevo, status: nuevo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo cambiar estado");
      setEv(mapEventFromApi(data));
    } catch (e) {
      console.error(e);
      alert("No se pudo cambiar el estado del evento.");
    }
  }

  return (
    <main className="w-full max-w-[1100px] mx-auto px-5 py-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link to="/studio/eventos" className="text-blue-400 font-semibold">
          ← Volver
        </Link>
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
            to={`/app/buscar?hotspots=${ev.puntos.map((p) => p.id).join(",")}`}
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
                  onBlur={() => updateEvent({}, true)}
                />
              </Field>
              <Field label="Fecha">
                <input
                  type="date"
                  className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3"
                  value={ev.fecha}
                  onChange={(e) => updateEvent({ fecha: e.target.value })}
                  onBlur={() => updateEvent({}, true)}
                />
              </Field>
              <Field label="Ruta">
                <input
                  className="h-11 w-full rounded-lg border border-white/15 bg-white/10 text-white px-3"
                  value={ev.ruta}
                  readOnly // 👈 bloqueada para no modificarla aquí
                />
              </Field>
              <Field label="Precio base (Q)">
                <input
                  type="number"
                  min={1}
                  className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3"
                  value={ev.precioBase || 50}
                  onChange={(e) => updateEvent({ precioBase: Number(e.target.value || 0) })}
                  onBlur={() => updateEvent({}, true)}
                />
              </Field>
              <Field label="Notas (privadas)" full>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-white/15 bg-white/5 text-white px-3 py-2"
                  value={ev.notas || ""}
                  onChange={(e) => updateEvent({ notas: e.target.value })}
                  onBlur={() => updateEvent({}, true)}
                />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold mb-3">Resumen</h3>
            <div className="grid grid-cols-3 gap-3">
              <KPI label="Puntos" value={ev.puntos.length} />
              <KPI label="Fotos" value={ev.fotos.length} />
              <KPI label="Estado" value={ev.estado} />
            </div>
          </div>
        </section>
      )}

      {/* ===== Puntos ===== */}
      {tab === "puntos" && (
        <section className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Puntos de foto</h3>
              {/* Ya no mostramos “Importar desde mi perfil” aquí */}
              <button
                className="h-9 px-3 rounded-xl bg-blue-500 text-white font-display font-bold border border-white/10"
                onClick={() => {
                  const first = myCatalog.find((h) => !ev.puntos.some((p) => p.id === h.id));
                  if (!first) return alert("Ya agregaste todos los puntos de tu catálogo 😅");
                  addPointFromCatalog(first);
                }}
              >
                Agregar punto
              </button>
            </div>

            {ev.puntos.length === 0 ? (
              <div className="text-slate-300 text-sm">Aún no agregaste puntos.</div>
            ) : (
              <div className="space-y-3">
                {ev.puntos.map((p) => {
                  const count = (ev.fotos || []).filter((f) => f.puntoId === p.id).length;
                  return (
                    <div
                      key={p.id}
                      className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col sm:flex-row sm:items-center gap-3"
                    >
                      <div className="flex-1">
                        <div className="font-semibold">{p.nombre}</div>
                        <div className="text-xs text-slate-400">
                          {p.horaIni} – {p.horaFin} · {count} foto{count === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div className="sm:w-[300px] grid grid-cols-3 gap-2">
                        <input
                          type="time"
                          className="h-10 rounded-lg border border-white/15 bg-white/5 text-white px-2"
                          value={p.horaIni}
                          onChange={(e) => updatePoint(p.id, { horaIni: e.target.value })}
                        />
                        <input
                          type="time"
                          className="h-10 rounded-lg border border-white/15 bg-white/5 text-white px-2"
                          value={p.horaFin}
                          onChange={(e) => updatePoint(p.id, { horaFin: e.target.value })}
                        />
                        <label className="inline-flex items-center gap-2 justify-center rounded-lg border border-white/15 bg-white/5">
                          <input
                            type="checkbox"
                            checked={p.activo}
                            onChange={(e) => updatePoint(p.id, { activo: e.target.checked })}
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
            <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
              {myCatalog
                .filter((h) => !ev.puntos.some((p) => p.id === h.id))
                .map((h) => (
                  <div
                    key={h.id}
                    className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{h.name || h.nombre}</div>
                      {h.route_name && <div className="text-xs text-slate-400">{h.route_name}</div>}
                    </div>
                    <button
                      className="h-8 px-3 rounded-lg bg-blue-600 text-white"
                      onClick={() => addPointFromCatalog(h)}
                    >
                      Agregar
                    </button>
                  </div>
                ))}
              {myCatalog.length === 0 && (
                <div className="text-slate-300 text-sm">No tenés catálogo cargado todavía.</div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ===== Subida ===== */}
      {tab === "subida" && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="font-semibold mb-3">Subida de fotos</h3>
          {ev.puntos.length === 0 ? (
            <div className="text-slate-300 text-sm">Agregá al menos un punto para habilitar la subida.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
              <div>
                <UploadManager
                  eventId={ev.id}
                  pointId={uploadPoint}
                  onUploaded={onUploaded}
                  getSignedUrl={getSignedUrl}
                  options={{
                    watermark: { src: null, scale: 0.25, opacity: 0.5, position: "br" },
                  }}
                />
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3">
                  <div className="text-xs text-slate-400 mb-1">Asignar al punto</div>
                  <select
                    className="h-10 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3"
                    value={uploadPoint}
                    onChange={(e) => setUploadPoint(e.target.value)}
                  >
                    <option value="">Elegí punto…</option>
                    {ev.puntos.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="text-xs text-slate-400">
                  Arrastrá y soltá tus fotos. Se suben directo al storage con URL firmada y luego se registran en el evento.
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ===== Organizar (preview simple por punto) ===== */}
      {tab === "organizar" && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="font-semibold mb-3">Organizar por punto</h3>
          {ev.puntos.length === 0 ? (
            <div className="text-slate-300 text-sm">No hay puntos.</div>
          ) : (
            <div className="space-y-4">
              {ev.puntos.map((p) => {
                const fotos = fotosPorPunto.get(p.id) || [];
                return (
                  <div key={p.id}>
                    <div className="font-semibold mb-2">{p.nombre} · {p.horaIni}–{p.horaFin} · {fotos.length} foto{fotos.length === 1 ? "" : "s"}</div>
                    {fotos.length === 0 ? (
                      <div className="text-slate-300 text-sm">Sin fotos aún.</div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {fotos.map((f) => (
                          <img key={f.id || f.url} src={f.url} alt="" className="w-full h-28 object-cover rounded-lg" />
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

/* ================== UI chilerito ================== */
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
