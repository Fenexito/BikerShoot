// src/routes/photographer/EventoEditor.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import UploadManager from "./upload/UploadManager.jsx"; // ajustá si tu ruta es distinta
import { supabase } from "../../../lib/supabaseClient"; // 👈 usa el cliente central

/* ============ Helpers ============ */
const fmtDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("es-GT", {
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
  };
}
function buildEventPatch(ev) {
  return {
    nombre: ev.nombre,
    fecha: ev.fecha,
    ruta: ev.ruta,
    location: ev.ruta, // 👈 guardar oficial en 'location'
    estado: ev.estado,
    precio_base: ev.precioBase, // 👈 unificar aquí
    notas: ev.notas,
    price_list_id: ev.price_list_id || null, // 👈 si hay lista, se guarda el id
  };
}

/* ============ Componente ============ */
export default function EventoEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const initialTab = params.get("tab") || "resumen";

  // ---- state base ----
  const [ev, setEv] = useState(null);       // evento
  const [fotos, setFotos] = useState([]);   // event_asset
  const [puntos, setPuntos] = useState([]); // por ahora UI local (ver TODO para persistir)
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(initialTab);

  // Subida
  const [uploadPoint, setUploadPoint] = useState("");

  // Listas de precios del fotógrafo
  const [priceLists, setPriceLists] = useState([]); // [{id, nombre, items: [...] }]
  const [loadingLists, setLoadingLists] = useState(true);

  // Agrupar fotos x punto
  const fotosPorPunto = useMemo(() => {
    const map = new Map();
    const all = Array.isArray(fotos) ? fotos : [];
    all.forEach((f) => {
      const key = f.hotspot_id || null;
      const arr = map.get(key) || [];
      arr.push(f);
      map.set(key, arr);
    });
    for (const [, arr] of map) arr.sort((a, b) => new Date(a.taken_at) - new Date(b.taken_at));
    return map;
  }, [fotos]);

  // default uploadPoint
  useEffect(() => {
    if (!uploadPoint && Array.isArray(puntos) && puntos.length) {
      setUploadPoint(puntos[0].id);
    }
  }, [puntos, uploadPoint]);

  /* ---- cargar evento + assets + listas ---- */
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

        // 2) assets
        const { data: assets, error: aErr } = await supabase
          .from("event_asset")
          .select("*")
          .eq("event_id", id)
          .order("taken_at", { ascending: true });
        if (aErr) throw aErr;

        // 3) puntos del evento (si tuvieras tabla event_hotspot)
        // const { data: hs } = await supabase
        //   .from("event_hotspot")
        //   .select("id, nombre, meta")
        //   .eq("event_id", id);
        // const puntosIniciales = (hs || []).map(h => ({
        //   id: h.id, nombre: h.nombre || "Punto", ...((h.meta || {}))
        // }));

        // 4) listas de precios del fotógrafo
        setLoadingLists(true);
        let lists = [];
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess?.session?.user?.id || null;
        if (uid) {
          const { data: lrows, error: lerr } = await supabase
            .from("photographer_price_list")
            .select("id, nombre, items")
            .eq("photographer_id", uid)
            .order("created_at", { ascending: false });
          if (lerr) throw lerr;
          lists = (lrows || []).map((r) => ({
            id: r.id,
            nombre: r.nombre,
            items: Array.isArray(r.items) ? r.items : [],
          }));
        }

        if (!mounted) return;
        setEv(evUI);
        setFotos(assets || []);
        setPuntos([]); // reemplazá por 'puntosIniciales' si usás event_hotspot
        setPriceLists(lists);
      } catch (e) {
        console.error(e);
        if (mounted) setEv(null);
      } finally {
        if (mounted) {
          setLoading(false);
          setLoadingLists(false);
        }
      }
    })();
    return () => (mounted = false);
  }, [id]);

  /* ---- acciones: guardar / publicar ---- */
  async function guardarTodo() {
    try {
      const patch = buildEventPatch(ev);
      const { error } = await supabase
        .from("event")
        .update(patch, { returning: "minimal" })
        .eq("id", ev.id);
      if (error) throw error;

      // refrescar por si triggers tocan algo
      const { data: row } = await supabase.from("event").select("*").eq("id", ev.id).maybeSingle();
      if (row) setEv(mapEventRow(row));

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

  /* ---- puntos (UI local; ver TODO para persistir) ---- */
  function updatePoint(pid, patch) {
    setPuntos((arr) => arr.map((p) => (p.id === pid ? { ...p, ...patch } : p)));
    // TODO: si tenés event_hotspot.meta jsonb => update
  }
  function addPointFromCatalog(h) {
    setPuntos((arr) => {
      if (!h) return arr;
      if (arr.some((x) => x.id === h.id)) return arr;
      return [
        ...arr,
        {
          id: h.id,
          nombre: h.name || h.nombre || "Punto",
          activo: true,
          horaIni: (h.default_windows?.[0]?.start) || "06:00",
          horaFin: (h.default_windows?.[0]?.end) || "12:00",
        },
      ];
    });
    // TODO: insert en event_hotspot
  }
  function removePoint(pid) {
    setPuntos((arr) => arr.filter((p) => p.id !== pid));
    // TODO: delete en event_hotspot
  }

  /* ---- subida de fotos ---- */
  async function getSignedUrl({ eventId, pointId, filename, size, contentType }) {
    // Usamos funciones de Supabase (edge): /functions/v1/signed-event-upload
    const base = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || supabase?.supabaseUrl || "";
    const FN_BASE = (base || "").replace(/\/$/, "");
    const res = await fetch(`${FN_BASE}/functions/v1/signed-event-upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, pointId, filename, size, contentType }),
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out?.error || "No se pudo firmar la subida");
    return out; // { uploadUrl, path, headers? }
  }
  async function onUploaded(assets) {
    try {
      // Registrar en DB
      const base = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || supabase?.supabaseUrl || "";
      const FN_BASE = (base || "").replace(/\/$/, "");
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

      // refrescar assets
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

  // catálogo mock — conectalo a tu perfil cuando querrás
  const myCatalog = []; // ej: [{id:'A-1', name:'Salida', default_windows:[{start:'06:00', end:'08:00'}]}]
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

              {/* Precio base *y* Lista de precios */}
              <Field label="Precio base (Q)">
                <input
                  type="number"
                  min={1}
                  className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3"
                  value={ev.precioBase || 50}
                  onChange={(e) => updateEvent({ precioBase: Number(e.target.value || 0) })}
                  disabled={!!ev.price_list_id}
                  title={ev.price_list_id ? "Este evento usa una lista de precios" : "Editar precio base"}
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
            {/* Preview de la lista de precios */}
            {loadingLists ? (
              <div className="mt-4 text-sm text-slate-400">Cargando listas…</div>
            ) : ev.price_list_id && selectedList ? (
              <div className="mt-4">
                <div className="text-xs text-slate-400 mb-1">Lista seleccionada</div>
                <div className="text-sm font-semibold mb-2">{selectedList.nombre}</div>
                <div className="rounded-xl border border-white/10 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-white/10">
                      <tr>
                        <th className="text-left px-3 py-2">Concepto</th>
                        <th className="text-right px-3 py-2">Precio (Q)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedList.items || []).map((it, i) => (
                        <tr key={i} className="border-t border-white/10">
                          <td className="px-3 py-2">{it?.nombre || it?.name || "Item"}</td>
                          <td className="px-3 py-2 text-right">{Number(it?.precio ?? it?.price ?? 0)}</td>
                        </tr>
                      ))}
                      {(!selectedList.items || selectedList.items.length === 0) && (
                        <tr className="border-t border-white/10">
                          <td className="px-3 py-2 text-slate-400" colSpan={2}>Sin items configurados.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 text-xs text-white/70">
                  Nota: Si hay <strong>lista</strong>, esa manda sobre el precio base para mostrar precios al público.
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
              <button
                className="h-9 px-3 rounded-xl bg-blue-500 text-white font-display font-bold border border-white/10"
                onClick={() => {
                  const first = myCatalog.find((h) => !puntos.some((p) => p.id === h.id));
                  if (!first) return alert("Ya agregaste todos los puntos de tu catálogo 😅");
                  addPointFromCatalog(first);
                }}
              >
                Agregar punto
              </button>
            </div>

            {puntos.length === 0 ? (
              <div className="text-slate-300 text-sm">Aún no agregaste puntos.</div>
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
                          onChange={(e) => updatePoint(p.id, { horaIni: e.target.value })}
                        />
                        <input
                          type="time"
                          className="h-10 rounded-lg border border-white/15 bg-white/5 text-white px-2"
                          value={p.horaFin || ""}
                          onChange={(e) => updatePoint(p.id, { horaFin: e.target.value })}
                        />
                        <label className="inline-flex items-center gap-2 justify-center rounded-lg border border-white/15 bg-white/5">
                          <input
                            type="checkbox"
                            checked={!!p.activo}
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
                .filter((h) => !puntos.some((p) => p.id === h.id))
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

/* ============ UI chilerito ============ */
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
