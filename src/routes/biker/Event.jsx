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
/** Obtener URL pública desde Supabase Storage (bucket 'fotos') */
async function getPublicUrl(storagePath) {
  if (!storagePath) return "";
  const raw = String(storagePath).trim();
  if (/^https?:\/\//i.test(raw)) return raw; // ya es URL completa
  // quitar "/" inicial y prefijo "fotos/"
  const clean = raw.replace(/^\/+/, "").replace(/^fotos\//i, "");
  const { data } = supabase.storage.from("fotos").getPublicUrl(clean);
  if (data?.publicUrl) return data.publicUrl;
  // fallback: bucket privado → URL firmada 1h
  const signed = await supabase.storage.from("fotos").createSignedUrl(clean, 3600);
  return signed?.data?.signedUrl || "";
}

/** Lista recursivamente en 'fotos/events/<eventId>/**' y devuelve {hotspot_id,url}[] */
async function listAssetsFromStorage(eventId) {
  const root = `events/${eventId}`;

  // Lista todos los archivos recursivamente bajo una carpeta dada.
  async function listAllFiles(folder) {
    const acc = [];
    const stack = [folder]; // DFS iterativa
    while (stack.length) {
      const cur = stack.pop();
      const { data, error } = await supabase.storage.from("fotos").list(cur, { limit: 1000 });
      if (error) continue;
      for (const entry of data || []) {
        // Heurística: si tiene extensión, tratamos como archivo; si no, tratamos como subcarpeta.
        if (entry.name && /\.[a-z0-9]{2,4}$/i.test(entry.name)) {
          acc.push(`${cur}/${entry.name}`);
        } else if (entry.name) {
          stack.push(`${cur}/${entry.name}`);
        }
      }
    }
    return acc;
  }

  // Archivos bajo events/<eventId> (pueden estar directo o bajo <hotspotId>/YYYY/MM/...)
  const allPaths = await listAllFiles(root); // array de 'events/<eventId>/.../archivo.jpg'

  // Derivar hotspot_id de la ruta: events/<eventId>/<hotspotId>/...
  const result = [];
  for (const p of allPaths) {
    const parts = p.split("/").filter(Boolean);
    // parts: ['events', '<eventId>', '<hotspotId>', ...]
    const idxEvents = parts.indexOf("events");
    const evId = parts[idxEvents + 1];
    const hsId = parts[idxEvents + 2] || null;
    if (evId !== String(eventId)) continue; // seguridad
    const url = await getPublicUrl(p);
    if (url) result.push({ hotspot_id: hsId, storage_path: p, url });
  }
  return result;
}

/** Mini carrusel (scroll horizontal suave) */
function MiniCarousel({ images = [], intervalMs = 3500, fadeMs = 700 }) {
  const pics = (images || []).filter(Boolean);
  const [idx, setIdx] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  // Auto-advance (una imagen a la vez)
  React.useEffect(() => {
    if (!pics.length) return;
    const t = setInterval(() => {
      if (!paused) {
        setIdx((i) => (i + 1) % pics.length);
      }
    }, Math.max(1500, intervalMs));
    return () => clearInterval(t);
  }, [pics.length, paused, intervalMs]);

  // Preload siguiente para evitar parpadeo
  React.useEffect(() => {
    if (pics.length < 2) return;
    const next = new Image();
    next.src = pics[(idx + 1) % pics.length];
  }, [idx, pics]);

  if (!pics.length) {
    return (
      <div className="h-72 md:h-80 rounded-xl bg-slate-50 grid place-items-center text-slate-400 text-sm">
        Sin fotos de muestra
      </div>
    );
  }

  return (
    <div
      className="relative h-72 md:h-80 rounded-xl overflow-hidden border border-slate-100 bg-slate-200"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <style>{`
        .fade-slide {
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity ${fadeMs}ms ease-in-out, transform ${fadeMs}ms ease-in-out;
          transform: scale(1.02);
          will-change: opacity, transform;
        }
        .fade-slide.active {
          opacity: 1;
          transform: scale(1.0);
        }
      `}</style>
      {pics.map((url, i) => (
        <div key={i} className={`fade-slide ${i === idx ? "active" : ""}`}>
          <img
            src={url}
            alt=""
            className="w-full h-full object-cover" 
            loading="lazy"
            draggable={false}
          />
        </div>
      ))}
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

  /** Carga puntos del evento + assets del evento (siguiendo el schema real) */
  React.useEffect(() => {
    let alive = true;
    async function loadHotspotsAndAssets() {
      if (!id) return;
      try {
        setLoadingPts(true);

        // 1) Puntos del evento (schema: event_hotspot con name, windows, lat/lng, route_id)
        const { data: pts, error: errPts } = await supabase
          .from("event_hotspot")
          .select("id, event_id, name, lat, lng, windows, route_id")
          .eq("event_id", id)
          .order("id", { ascending: true });
        if (errPts) throw errPts;

        const mappedPts = (pts || []).map((p) => {
          const w0 = Array.isArray(p?.windows) && p.windows[0] ? p.windows[0] : null;
          return {
            id: p.id,
            nombre: p.name || "Punto",
            lat: p.lat ?? null,
            lng: p.lng ?? null,
            route_id: p.route_id || null,
            horaIni: (w0?.start ?? "") || "",
            horaFin: (w0?.end ?? "") || "",
          };
        });

        // 2) Assets desde tabla (puede fallar con anon por RLS)
        let allAssets = [];
        try {
          const { data: assets } = await supabase
            .from("event_asset")
            .select("id, event_id, hotspot_id, storage_path, taken_at")
            .eq("event_id", id)
            .order("taken_at", { ascending: false })
            .limit(1000);
          if (Array.isArray(assets) && assets.length) {
            // Resolver URLs (getPublicUrl ahora es async)
            const withUrls = [];
            for (const a of assets) {
              const url = await getPublicUrl(a.storage_path);
              if (url) withUrls.push({
                id: a.id,
                event_id: a.event_id,
                hotspot_id: a.hotspot_id || null,
                url
              });
            }
            allAssets = withUrls;
          }
        } catch (_) {
          // ignoramos: probamos por storage
        }

        // Plan B: si DB no devolvió nada, leemos del Storage por carpetas
        if (!allAssets.length) {
          const listed = await listAssetsFromStorage(id);
          allAssets = listed;
        }

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
          const pool = (byHotspot[pt.id]?.length ? byHotspot[pt.id] : general).filter(Boolean);
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
          {/* Portada un poco más grande */}
          <div className="h-72 md:h-80 lg:h-96 overflow-hidden">
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
          <div className="flex items-center gap-3">
            {loadingPts && <span className="text-sm text-slate-500">Cargando…</span>}
          </div>
        </div>

        {!loadingPts && hotspots.length === 0 && (
          <div className="text-slate-500 text-sm">Este evento no tiene puntos configurados.</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {hotspots.map((pt, idx) => (
            <article
              key={pt.id || idx}
              className="rounded-2xl shadow-card bg-white overflow-hidden border border-slate-100"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold leading-tight">{pt.nombre}</h3>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    {pt.horaIni || pt.horaFin ? (
                      <div>
                        {(pt.horaIni || "—")}{pt.horaFin ? ` – ${pt.horaFin}` : ""}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3">
                  <MiniCarousel images={assetsByHotspot[pt.id] || []} />
                </div>

                <button
                  className="mt-4 h-10 px-4 rounded-xl bg-blue-600 text-white font-display font-bold mx-auto block"
                  onClick={() => {
                    if (!evt) return;
                    const puntoNombre = pt?.nombre || "";
                    const fecha = (evt.fecha || "").slice(0, 10);
                    const inicio = (pt.horaIni || "06:00").slice(0, 5);
                    const fin = (pt.horaFin || "12:00").slice(0, 5);
                    const rutaPreferida = (pt.route_id && pt.route_name) ? pt.route_name : (evt.ruta || "Todos");
                    const photogs = evt.photographer_id ? String(evt.photographer_id) : "";

                    const url = new URL(window.location.origin + "/app/buscar");
                    url.searchParams.set("evento", String(evt.id));
                    url.searchParams.set("hotspot", String(pt.id));
                    url.searchParams.set("punto", puntoNombre);
                    if (fecha) url.searchParams.set("fecha", fecha);
                    if (inicio) url.searchParams.set("inicio", inicio);
                    if (fin) url.searchParams.set("fin", fin);
                    if (rutaPreferida) url.searchParams.set("ruta", rutaPreferida);
                    if (photogs) url.searchParams.set("photogs", photogs);
                    // Forzar filtros:
                    url.searchParams.set("conf", "0");
                    url.searchParams.set("cmoto", "");
                    url.searchParams.set("cchaq", "");
                    url.searchParams.set("ccasco", "");
                    nav(url.pathname + url.search);
                    }}
                    >
                  BUSCAR EN ESTE PUNTO
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
