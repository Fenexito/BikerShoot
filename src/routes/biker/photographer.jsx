// src/routes/biker/photographer.jsx
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import MapHotspots from "../../components/MapHotspots";

/* Pequeños helpers */
function formatDate(d) {
  const dt = new Date(d);
  if (isNaN(dt)) return "—";
  return dt.toLocaleDateString("es-GT", { year: "numeric", month: "short", day: "2-digit" });
}
function formatHora(d) {
  const dt = new Date(d);
  if (isNaN(dt)) return "";
  return dt.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function priceFromOf(price_lists, preciosLegacy) {
  const numfy = (v) => Number(String(v ?? "").replace(/[^\d.]/g, ""));
  const fromLists = Array.isArray(price_lists)
    ? price_lists
        .filter((pl) => pl?.visible_publico)
        .flatMap((pl) => (Array.isArray(pl.items) ? pl.items : []))
        .map((it) => numfy(it?.precio))
        .filter((n) => isFinite(n))
    : [];
  if (fromLists.length) return Math.min(...fromLists);
  const fromLegacy = Array.isArray(preciosLegacy)
    ? preciosLegacy.map((x) => numfy(x?.precio)).filter((n) => isFinite(n))
    : [];
  return fromLegacy.length ? Math.min(...fromLegacy) : null;
}

export default function BikerPhotographerDetail() {
  const { id } = useParams(); // /app/fotografos/:id  → OJO: acá se usa user_id
  const nav = useNavigate();

  // Perfil
  const [p, setP] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");

  // Eventos publicados del fotógrafo
  const [events, setEvents] = React.useState([]);
  const [evLoading, setEvLoading] = React.useState(true);
  const [evErr, setEvErr] = React.useState("");

  // ⚠️ Importante: NO hay ningún estado/lightbox acá.
  // Eliminamos cualquier overlay que pudiera bloquear la UI.

  React.useEffect(() => {
    let alive = true;

    async function loadProfile() {
      try {
        setErr("");
        setLoading(true);
        // PERFIL por user_id (así está en tu código actual)
        const { data, error } = await supabase
          .from("photographer_profile")
          .select("*")
          .eq("user_id", id)
          .maybeSingle();
        if (error) throw error;

        if (!alive) return;
        if (!data) {
          setP(null);
          return;
        }

        const toUrls = (arr) =>
          (Array.isArray(arr) ? arr : [])
            .map((x) => (typeof x === "string" ? x : x?.url))
            .filter(Boolean);

        const mapped = {
          id: data.user_id,
          estudio: data.estudio || "",
          username: (data.username || "").replace(/^@/, ""),
          ubicacion: data.ubicacion || "—",
          rating: Number(data.rating || 0),
          descripcion: data.descripcion || "",
          estilos: Array.isArray(data.estilos) ? data.estilos : [],
          avatar: data.avatar_url || "",
          portada: data.cover_url || toUrls(data.portafolio)[0] || data.avatar_url || "",
          telefono: data.telefono || "",
          correo: data.correo || "",
          website: data.website || "",
          facebook: data.facebook || "",
          instagram: data.instagram || "",
          precios: Array.isArray(data.precios) ? data.precios : [],           // legacy
          price_lists: Array.isArray(data.price_lists) ? data.price_lists : [], // nuevo
          portafolio: toUrls(data.portafolio),
          puntos: Array.isArray(data.puntos)
            ? data.puntos.map((p) => ({
                ...p,
                hora_inicio: p.hora_inicio || null,
                hora_fin: p.hora_fin || null,
              }))
            : [],
          rutas: Array.isArray(data.rutas) ? data.rutas : [],
        };
        setP(mapped);
      } catch (e) {
        if (!alive) return;
        setErr(e.message || "No se pudo cargar el perfil");
      } finally {
        if (alive) setLoading(false);
      }
    }

    async function loadEvents() {
      try {
        setEvErr("");
        setEvLoading(true);

        // 🔎 Ajustá acá si tu tabla/columnas son distintas:
        // Tabla sugerida: 'events'
        // Columnas: photographer_id (user_id del fotógrafo), estado ('PUBLICADO'), fecha (date/datetime)
        const { data, error } = await supabase
          .from("events")
          .select("id, nombre, ruta, fecha, portada, estado, photographer_id")
          .eq("photographer_id", id)
          .eq("estado", "PUBLICADO")
          .order("fecha", { ascending: false });

        if (error) throw error;
        if (!alive) return;

        setEvents((data || []).map((e) => ({
          id: e.id,
          nombre: e.nombre || "Evento",
          ruta: e.ruta || "",
          fecha: e.fecha || null,
          portada: e.portada || "",
          estado: e.estado,
        })));
      } catch (e) {
        if (!alive) return;
        setEvErr(e.message || "No se pudieron cargar los eventos");
      } finally {
        if (alive) setEvLoading(false);
      }
    }

    loadProfile();
    loadEvents();
    return () => { alive = false; };
  }, [id]);

  const priceFrom = React.useMemo(
    () => priceFromOf(p?.price_lists, p?.precios),
    [p?.price_lists, p?.precios]
  );

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto p-4">
        <div className="h-40 rounded-xl bg-slate-200 animate-pulse" />
        <div className="mt-4 h-20 rounded-xl bg-slate-200 animate-pulse" />
      </main>
    );
  }

  if (err || !p) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-black mb-2">Fotógrafo</h1>
        <p className="text-red-600">{err || "No encontramos este perfil."}</p>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6">
      {/* Portada más baja */}
      <div className="relative w-full overflow-hidden rounded-2xl border bg-white">
        <div className="h-48 md:h-56 w-full overflow-hidden">
          {p.portada ? (
            <img
              src={p.portada}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-slate-200" />
          )}
        </div>

        {/* Cabecera compacta */}
        <div className="p-4 md:p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden border bg-slate-100 shrink-0">
            {p.avatar ? (
              <img src={p.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-slate-200" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-black truncate">
              {p.estudio || `@${p.username}`}
            </h1>
            <div className="text-sm text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
              {p.ubicacion && <span>📍 {p.ubicacion}</span>}
              {!!p.rutas?.length && (
                <span>🏁 Rutas: {p.rutas.slice(0, 3).join(", ")}{p.rutas.length > 3 ? "…" : ""}</span>
              )}
              {priceFrom != null && <span>💵 Desde Q{Number(priceFrom).toFixed(0)}</span>}
            </div>
          </div>
          {p.instagram && (
            <a
              href={
                /^https?:\/\//i.test(p.instagram)
                  ? p.instagram
                  : `https://www.instagram.com/${String(p.instagram).replace(/^@/, "")}`
              }
              target="_blank"
              rel="noreferrer"
              className="hidden md:inline-flex h-10 px-4 rounded-xl border bg-white hover:bg-slate-50"
            >
              Instagram
            </a>
          )}
        </div>
      </div>

      {/* Cinta de eventos publicados */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg md:text-xl font-black">Eventos publicados</h2>
          {evLoading && <span className="text-sm text-slate-500">Cargando…</span>}
        </div>

        {!evLoading && evErr && (
          <div className="mt-2 text-sm text-red-600">{evErr}</div>
        )}

        {!evLoading && !evErr && events.length === 0 && (
          <div className="mt-2 text-sm text-slate-500">
            Este fotógrafo no tiene eventos publicados visibles.
          </div>
        )}

        {events.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <div className="flex gap-3 min-w-full">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="w-[280px] shrink-0 rounded-xl border bg-white hover:shadow-md transition-shadow"
                >
                  <div className="h-40 w-full overflow-hidden rounded-t-xl bg-slate-200">
                    {ev.portada ? (
                      <img
                        src={ev.portada}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-100" />
                    )}
                  </div>
                  <div className="p-3">
                    <div className="text-xs text-slate-500">
                      {formatDate(ev.fecha)} {formatHora(ev.fecha)}
                    </div>
                    <div className="font-bold leading-tight truncate">{ev.nombre}</div>
                    {ev.ruta && (
                      <div className="text-sm text-slate-600 truncate">🏁 {ev.ruta}</div>
                    )}

                    <button
                      className="mt-3 w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                      onClick={() => nav(`/app/buscar?evento=${encodeURIComponent(ev.id)}`)}
                      title="Ver evento"
                    >
                      VER EVENTO
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Resto del perfil tal cual (descripción, portafolio, mapa, etc.) */}
      <section className="mt-8 grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-2xl border bg-white p-4">
            <h3 className="font-bold mb-1">Sobre mí</h3>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {p.descripcion || "Este fotógrafo aún no agregó una descripción."}
            </p>
          </div>

          {/* Portafolio en mosaico simple (sin lightbox automático) */}
          {Array.isArray(p.portafolio) && p.portafolio.length > 0 && (
            <div className="rounded-2xl border bg-white p-4">
              <h3 className="font-bold mb-3">Portafolio</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {p.portafolio.slice(0, 12).map((url, i) => (
                  <div key={i} className="aspect-[4/3] rounded-lg overflow-hidden bg-slate-100">
                    <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
              {p.portafolio.length > 12 && (
                <div className="mt-2 text-sm text-slate-500">
                  +{p.portafolio.length - 12} fotos más
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel lateral: datos rápidos y mapa */}
        <aside className="space-y-4">
          <div className="rounded-2xl border bg-white p-4">
            <h3 className="font-bold mb-2">Contacto</h3>
            <div className="space-y-1 text-sm">
              {p.telefono && <div>📱 {p.telefono}</div>}
              {p.correo && <div>✉️ {p.correo}</div>}
              {p.website && (
                <a className="text-blue-600" href={/^https?:\/\//i.test(p.website) ? p.website : `https://${p.website}`} target="_blank" rel="noreferrer">
                  🌐 Sitio web
                </a>
              )}
              {p.instagram && (
                <a
                  className="block text-blue-600"
                  href={
                    /^https?:\/\//i.test(p.instagram)
                      ? p.instagram
                      : `https://www.instagram.com/${String(p.instagram).replace(/^@/, "")}`
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  📸 Instagram
                </a>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-2">
            <MapHotspots puntos={p.puntos || []} />
          </div>
        </aside>
      </section>
    </main>
  );
}
