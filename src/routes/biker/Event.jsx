import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

/** Utils visuales */
function fmtFecha(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return "—";
  return dt.toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtHora(dtLike) {
  if (!dtLike) return "";
  const dt = new Date(dtLike);
  if (isNaN(dt)) return "";
  return dt.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Mini carrusel (scroll horizontal suave) */
function MiniCarousel({ images = [] }) {
  if (!images.length) {
    return (
      <div className="h-24 rounded-xl bg-slate-50 grid place-items-center text-slate-400 text-sm">
        Sin fotos de muestra
      </div>
    );
  }
  return (
    <div className="overflow-x-auto no-scrollbar">
      <div className="flex gap-2">
        {images.map((url, i) => (
          <div
            key={i}
            className="w-40 h-24 rounded-xl overflow-hidden bg-slate-200 border border-slate-100 shrink-0"
            title="Vista previa"
          >
            <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BikerEvent() {
  const { id } = useParams(); // /app/eventos/:id (o donde registres la ruta)
  const nav = useNavigate();

  /** Estado evento */
  const [evt, setEvt] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");

  /** Puntos (hotspots) e imágenes */
  const [hotspots, setHotspots] = React.useState([]);
  const [assetsByHotspot, setAssetsByHotspot] = React.useState({});
  const [loadingPts, setLoadingPts] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    async function loadEvent() {
      try {
        setLoading(true);
        setErr("");
        // Tabla real: public.event (singular). Campos en “dos sabores”:
        // nombre/title, fecha/date, ruta/location, estado/status, cover_url
        const { data, error } = await supabase
          .from("event")
          .select(
            "id, photographer_id, nombre, title, fecha, date, ruta, location, estado, status, cover_url"
          )
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (!alive) return;

        if (!data) {
          setEvt(null);
          return;
        }
        const nombre = data.nombre || data.title || "Evento";
        const fecha = data.fecha || data.date || null;
        const ruta = data.ruta || data.location || "";
        const portada = data.cover_url || "";
        setEvt({
          id: data.id,
          photographer_id: data.photographer_id,
          nombre,
          fecha,
          ruta,
          portada,
          estado: data.estado || null,
          status: data.status || null,
        });
      } catch (e) {
        if (!alive) return;
        setErr(e.message || "No se pudo cargar el evento");
      } finally {
        if (alive) setLoading(false);
      }
    }
    if (id) loadEvent();
    return () => {
      alive = false;
    };
  }, [id]);

  /** Carga puntos del evento + assets del evento (una sola consulta) */
  React.useEffect(() => {
    let alive = true;
    async function loadHotspotsAndAssets() {
      if (!id) return;
      try {
        setLoadingPts(true);

        // 1) Puntos del evento (ajustá nombres si difieren)
        // Sugeridos en tu esquema: public.event_hotspot
        // Posibles columnas: id, event_id, nombre/name, ruta/location, lat, lon,
        // start_time/end_time o un JSON horarios
        const { data: pts, error: errPts } = await supabase
          .from("event_hotspot")
          .select(
            "id, event_id, nombre, name, ruta, location, lat, lon, start_time, end_time, horarios"
          )
          .eq("event_id", id)
          .order("start_time", { ascending: true });
        if (errPts) throw errPts;

        const mappedPts =
          (pts || []).map((p) => ({
            id: p.id,
            nombre: p.nombre || p.name || "Punto",
            ruta: p.ruta || p.location || "",
            lat: p.lat ?? null,
            lon: p.lon ?? null,
            start_time: p.start_time || null,
            end_time: p.end_time || null,
            horarios: Array.isArray(p.horarios) ? p.horarios : null,
          })) || [];

        // 2) Todas las fotos del evento (para muestrarios)
        // Tabla sugerida: public.event_asset
        // Posibles columnas: id, event_id, hotspot_id, url/asset_url/thumb_url/preview_url, created_at
        const { data: assets, error: errAssets } = await supabase
          .from("event_asset")
          .select("id, event_id, hotspot_id, url, asset_url, thumb_url, preview_url, created_at")
          .eq("event_id", id)
          .order("created_at", { ascending: false })
          .limit(500);
        if (errAssets) throw errAssets;

        // Normalizar URL de imagen
        const allAssets = (assets || []).map((a) => ({
          id: a.id,
          event_id: a.event_id,
          hotspot_id: a.hotspot_id || null,
          url: a.thumb_url || a.preview_url || a.url || a.asset_url || "",
        }));

        // Agrupar por hotspot_id (si existe)
        const byHotspot = {};
        for (const pt of mappedPts) {
          byHotspot[pt.id] = [];
        }
        const general = []; // sin hotspot_id

        for (const a of allAssets) {
          if (a.hotspot_id && byHotspot[a.hotspot_id]) {
            byHotspot[a.hotspot_id].push(a.url);
          } else {
            general.push(a.url);
          }
        }

        // Para cada punto, si no hay fotos propias, usar un sample general del evento
        const finalByHotspot = {};
        for (const pt of mappedPts) {
          const pool = byHotspot[pt.id]?.length ? byHotspot[pt.id] : general;
          const pics = shuffle(pool).slice(0, 8); // 8 de muestra
          finalByHotspot[pt.id] = pics;
        }

        if (!alive) return;
        setHotspots(mappedPts);
        setAssetsByHotspot(finalByHotspot);
      } catch (e) {
        if (!alive) return;
        // No bloqueamos la vista, solo mostramos sin muestrarios si falla
        console.error("Hotspots/Assets:", e);
      } finally {
        if (alive) setLoadingPts(false);
      }
    }
    loadHotspotsAndAssets();
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-5 py-8">
        <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-card bg-white">
          <div className="h-56 bg-slate-200 animate-pulse" />
          <div className="p-5 space-y-3">
            <div className="h-6 w-2/3 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-1/3 bg-slate-200 rounded animate-pulse" />
            <div className="h-20 w-full bg-slate-200 rounded animate-pulse" />
          </div>
        </div>
      </main>
    );
  }

  if (err || !evt) {
    return (
      <main className="max-w-6xl mx-auto px-5 py-8">
        <p className="text-slate-600">{err || "No encontramos este evento."}</p>
        <button
          className="mt-4 h-10 px-4 rounded-xl bg-blue-600 text-white font-display font-bold"
          onClick={() => nav(-1)}
        >
          Regresar
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      {/* Header tipo biker: portada compacta + datos */}
      <div className="mb-6">
        <button className="mb-4 text-sm text-blue-600 hover:underline" onClick={() => nav(-1)}>
          ← Regresar
        </button>

        <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-card bg-white">
          {/* Portada reducida (misma lógica que usamos en el perfil de fotógrafo) */}
          <div className="h-56 sm:h-60 md:h-64 overflow-hidden">
            <img src={evt.portada} alt={evt.nombre} className="w-full h-full object-cover" />
          </div>
          <div className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h1 className="text-2xl font-display font-bold">{evt.nombre}</h1>
                <div className="text-slate-500">
                  {fmtFecha(evt.fecha)} {evt.ruta ? "· " + evt.ruta : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">evento</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Puntos del evento */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-display font-bold">Puntos del evento</h2>
          {loadingPts && <span className="text-sm text-slate-500">Cargando…</span>}
        </div>

        {!loadingPts && hotspots.length === 0 && (
          <div className="text-slate-500 text-sm">Este evento no tiene puntos configurados.</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {hotspots.map((pt, idx) => (
            <article
              key={pt.id || idx}
              className="rounded-2xl shadow-card bg-white overflow-hidden border border-slate-100"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold leading-tight">{pt.nombre}</h3>
                    <div className="text-sm text-slate-500">
                      {pt.ruta ? `Ruta: ${pt.ruta}` : ""}
                      {(pt.lat ?? null) !== null && (pt.lon ?? null) !== null
                        ? ` · [${pt.lat}, ${pt.lon}]`
                        : ""}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    {/* Horarios: si viene start/end, los mostramos; si viene arreglo horarios, listamos */}
                    {pt.start_time && (
                      <div>
                        {fmtHora(pt.start_time)}
                        {pt.end_time ? ` – ${fmtHora(pt.end_time)}` : ""}
                      </div>
                    )}
                    {!pt.start_time && Array.isArray(pt.horarios) && pt.horarios.length > 0 && (
                      <div className="space-y-0.5">
                        {pt.horarios.slice(0, 2).map((h, i) => (
                          <div key={i}>
                            {fmtHora(h.inicio)} {h.fin ? `– ${fmtHora(h.fin)}` : ""}
                          </div>
                        ))}
                        {pt.horarios.length > 2 && <div>+{pt.horarios.length - 2} más</div>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3">
                  <MiniCarousel images={assetsByHotspot[pt.id] || []} />
                </div>

                <button
                  className="mt-4 w-full h-10 rounded-xl bg-blue-600 text-white font-display font-bold"
                  onClick={() =>
                    nav(
                      `/app/buscar?evento=${encodeURIComponent(
                        evt.id
                      )}&hotspot=${encodeURIComponent(pt.id)}&punto=${encodeURIComponent(pt.nombre)}`
                    )
                  }
                >
                  BUSCAR EN ESTE PUNTO
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* CTA general para el evento */}
      <section className="mb-6">
        <button
          className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-display font-bold"
          onClick={() => nav(`/app/buscar?evento=${encodeURIComponent(evt.id)}`)}
        >
          BUSCAR FOTOS DEL EVENTO
        </button>
      </section>
    </main>
  );
}
