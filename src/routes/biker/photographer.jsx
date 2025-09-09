import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import PhotoLightbox from "../../components/PhotoLightbox";
import MapHotspots from "../../components/MapHotspots";

/* ========== Iconos ========== */
function FacebookIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M22 12.06C22 6.48 17.52 2 11.94 2S2 6.48 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.41c0-2.5 1.49-3.88 3.77-3.88 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.91h-2.34v7.03C18.34 21.24 22 17.08 22 12.06z" />
    </svg>
  );
}
function InstagramIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 2.2c3.2 0 3.584.012 4.85.07 1.17.054 1.97.24 2.67.51.72.28 1.33.66 1.92 1.25.59.59.97 1.2 1.25 1.92.27.7.46 1.5.51 2.67.06 1.27.07 1.65.07 4.85s-.012 3.584-.07 4.85c-.054 1.17-.24 1.97-.51 2.67a5.1 5.1 0 0 1-1.25 1.92 5.1 5.1 0 0 1-1.92 1.25c-.7.27-1.5.46-2.67.51-1.27.06-1.65.07-4.85.07s-3.53-.012-4.77-.07c-1.03-.047-1.59-.22-1.96-.36-.49-.19-.84-.42-1.2-.78-.36-.36-.59-.71-.78-1.2-.14-.37-.31-.93-.36-1.96-.06-1.24-.07-1.61-.07-4.77s.012-3.53.07-4.77c.047-1.03.22-1.59.36-1.96.19-.49.42-.84.78-1.2.36-.36.71-.59 1.2-.78.37-.14.93-.31 1.96-.36 1.24-.06 1.61-.07 4.77-.07Zm0 1.8c-3.16 0-3.53.012-4.77.07-1.03.047-1.59.22-1.96.36-.49.19-.84.42-1.2.78-.36.36-.59.71-.78 1.2-.14.37-.31.93-.36 1.96-.06 1.24-.07 1.61-.07 4.77s.012 3.53.07 4.77c.047 1.03.22 1.59.36 1.96.19.49.42.84.78 1.2.36.36.71.59 1.2.78.37.14.93.31 1.96.36 1.24.06 1.61.07 4.77.07s3.53-.012 4.77-.07c1.03-.047 1.59-.22 1.96-.36.49-.19.84-.42 1.2-.78.36-.36.59-.71.78-1.2.14-.37.31-.93.36-1.96.06-1.24.07-1.61.07-4.77s-.012-3.53-.07-4.77c-.047-1.03-.22-1.59-.36-1.96-.19-.49-.42-.84-.78-1.2-.36-.36-.71-.59-1.2-.78-.37-.14-.93-.31-1.96-.36-1.24-.06-1.61-.07-4.77-.07Zm0 3.6a6.8 6.8 0 1 1 0 13.6 6.8 6.8 0 0 1 0-13.6Zm0 1.8a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm6.9-2a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
    </svg>
  );
}

/* ============================
   Utils
   ============================ */
function formatQ(val) {
  if (val === null || val === undefined) return "—";
  const n = Number(String(val).replace(/[^\d.]/g, ""));
  if (!isFinite(n)) return "—";
  return `Q${Number.isInteger(n) ? n : n.toFixed(2)}`;
}
function toTime12(hhmm) {
  if (!hhmm) return "—";
  const [h, m] = String(hhmm).split(":").map((x) => parseInt(x || "0", 10));
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  let hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${mins} ${ampm}`;
}
function buildWhatsAppLink(phoneRaw, estudio, username) {
  if (!phoneRaw) return null;
  const digits = String(phoneRaw).replace(/\D/g, "");
  const gua = digits.startsWith("502") ? digits : `502${digits}`;
  const msg = `¡Hola ${estudio || (username ? '@' + username : 'fotógrafo/a')}! Te escribo desde MotoShots. Me interesa tu trabajo y quisiera más info 😊`;
  return `https://wa.me/${gua}?text=${encodeURIComponent(msg)}`;
}
function normalizeProfileUrl(url, platform) {
  if (!url) return null;
  let u = String(url).trim();
  if (!/^https?:\/\//i.test(u)) {
    if (platform === "facebook") u = `https://www.facebook.com/${u.replace(/^@/, "")}`;
    else if (platform === "instagram") u = `https://www.instagram.com/${u.replace(/^@/, "")}`;
    else u = `https://${u}`;
  }
  return u;
}
function formatFechaISO(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
}

export default function BikerPhotographerDetail() {
  const { id } = useParams(); // /app/fotografos/:id
  const nav = useNavigate();

  const [p, setP] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");

  // Lightbox del portafolio (lo que ya tenías)
  const [lbOpen, setLbOpen] = React.useState(false);
  const [lbIndex, setLbIndex] = React.useState(0);

  // === NUEVO: eventos publicados del fotógrafo
  const [events, setEvents] = React.useState([]);
  const [eventsLoading, setEventsLoading] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setErr("");
        setLoading(true);
        const { data, error } = await supabase
          .from("photographer_profile")
          .select("*")
          .eq("user_id", id)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          if (alive) setP(null);
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
          price_lists: Array.isArray(data.price_lists) ? data.price_lists : [],
          portafolio: toUrls(data.portafolio),
          puntos: Array.isArray(data.puntos) ? data.puntos : [],
        };
        if (alive) setP(mapped);
      } catch (e) {
        if (alive) setErr(e.message || "No se pudo cargar el perfil");
      } finally {
        if (alive) setLoading(false);
      }
    }
    if (id) load();
    return () => { alive = false; };
  }, [id]);

  // === NUEVO: cargar SOLO eventos PUBLICADOS del fotógrafo (más recientes primero)
  React.useEffect(() => {
    let alive = true;
    async function loadEvents() {
      if (!id) return;
      try {
        setEventsLoading(true);
        const { data, error } = await supabase
          .from("event")
          .select("id,nombre,fecha,ruta,cover_url,portada_url,estado")
          .eq("photographer_id", id)
          .eq("estado", "PUBLICADO")
          .order("fecha", { ascending: false });
        if (error) throw error;

        const mapped = (data || []).map((e) => ({
          id: e.id,
          nombre: e.nombre || "Evento",
          fecha: e.fecha,
          ruta: e.ruta || "—",
          // tratá de encontrar una portada usable
          portada:
            e.cover_url || e.portada_url || null,
        }));
        if (alive) setEvents(mapped);
      } catch (e) {
        // no cortamos la vista por error de eventos
        console.error("Eventos:", e);
      } finally {
        if (alive) setEventsLoading(false);
      }
    }
    loadEvents();
    return () => { alive = false; };
  }, [id]);

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-5 py-8">
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

  if (err || !p) {
    return (
      <main className="max-w-5xl mx-auto px-5 py-8">
        <p className="text-slate-500">{err ? `Error: ${err}` : "No se encontró el fotógrafo."}</p>
        <button
          className="mt-4 h-10 px-4 rounded-xl bg-blue-600 text-white font-display font-bold"
          onClick={() => nav("/app/fotografos")}
        >
          Ir al listado
        </button>
      </main>
    );
  }

  const wa = buildWhatsAppLink(p.telefono, p.estudio, p.username);
  const fbUrl = normalizeProfileUrl(p.facebook, "facebook");
  const igUrl = normalizeProfileUrl(p.instagram, "instagram");
  const lbItems = p.portafolio.map((url) => ({ url }));

  // ===== ordenar listas públicas: Domingo primero, luego el resto visibles (lo que ya tenías en esta vista) =====

  return (
    <main className="max-w-5xl mx-auto px-5 py-8">
      {/* Header (PORTADA REDUCIDA) */}
      <div className="mb-6">
        <button className="mb-4 text-sm text-blue-600 hover:underline" onClick={() => nav(-1)}>
          ← Regresar
        </button>

        <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-card bg-white">
          {/* ↓ antes era aspect-[16/9]; la reducimos a una franja */}
          <div className="h-56 sm:h-60 md:h-64 overflow-hidden">
            <img src={p.portada} alt={p.estudio} className="w-full h-full object-cover" />
          </div>
          <div className="p-5">
            <div className="flex items-start gap-4">
              <img
                src={p.avatar}
                alt={p.estudio}
                className="w-16 h-16 rounded-full border-4 border-white -mt-12 shadow"
              />
              <div className="flex-1">
                <h1 className="text-2xl font-display font-bold">{p.estudio}</h1>
                <div className="text-slate-500">
                  {p.username ? `@${p.username}` : "—"} · {p.ubicacion}
                </div>
              </div>
              <div className="text-right">
                <div className="text-yellow-500 font-semibold">★ {p.rating.toFixed(1)}</div>
                <div className="text-xs text-slate-400">calificación</div>
              </div>
            </div>

            {p.descripcion && <p className="mt-4 text-slate-700">{p.descripcion}</p>}

            {/* Redes a la izquierda + WhatsApp a la derecha */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                {fbUrl && (
                  <a
                    className="px-3 py-2 rounded-lg text-white text-sm inline-flex items-center gap-2 hover:brightness-95"
                    href={fbUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ backgroundColor: "#1877F2" }}
                  >
                    <FacebookIcon className="w-4 h-4" /> Facebook
                  </a>
                )}
                {igUrl && (
                  <a
                    className="px-3 py-2 rounded-lg text-white text-sm inline-flex items-center gap-2 hover:brightness-95 bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#515BD4]"
                    href={igUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <InstagramIcon className="w-4 h-4" /> Instagram
                  </a>
                )}
                {p.website && (
                  <a
                    className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm"
                    href={p.website}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Sitio web
                  </a>
                )}
              </div>

              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto h-10 px-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-display font-bold inline-flex items-center justify-center"
                  title="Contactar por WhatsApp"
                >
                  Contactar por WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* === NUEVO: Cinta horizontal de EVENTOS PUBLICADOS (más recientes a la izquierda) === */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-display font-bold">Eventos publicados</h2>
          {eventsLoading && <span className="text-sm text-slate-500">Cargando…</span>}
        </div>

        {events.length === 0 ? (
          <div className="text-slate-500 text-sm">
            Este fotógrafo aún no tiene eventos publicados visibles.
          </div>
        ) : (
          <div className="relative">
            <div className="overflow-x-auto no-scrollbar">
              <div className="flex gap-4 pr-2">
                {events.map((ev) => (
                  <article
                    key={ev.id}
                    className="shrink-0 w-[280px] rounded-2xl shadow-card bg-white overflow-hidden border border-slate-100"
                  >
                    <div className="aspect-[16/9] overflow-hidden bg-slate-100">
                      {ev.portada ? (
                        <img src={ev.portada} alt={ev.nombre} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-slate-400 text-sm">
                          Sin portada
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="text-xs text-slate-500">{formatFechaISO(ev.fecha)}</div>
                      <h3 className="font-semibold leading-tight">{ev.nombre}</h3>
                      <div className="text-sm text-slate-500 truncate">Ruta: {ev.ruta || "—"}</div>

                      <button
                        className="mt-3 w-full h-10 rounded-xl bg-blue-600 text-white font-display font-bold"
                        onClick={() => nav(`/app/eventos/${ev.id}`)}
                        title="Ver evento"
                      >
                        VER EVENTO
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ===== Debajo de la cinta: resto de info/portafolio, igual que ya tenías ===== */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Columna izquierda: contacto, estilos, etc. */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <h3 className="font-semibold mb-2">Contacto</h3>
            <div className="text-sm text-slate-600">
              <div><span className="font-medium">Correo: </span>{p.correo || "—"}</div>
              <div><span className="font-medium">Teléfono: </span>{p.telefono || "—"}</div>
              <div><span className="font-medium">Ubicación: </span>{p.ubicacion || "—"}</div>
            </div>
          </div>
          {Array.isArray(p.estilos) && p.estilos.length > 0 && (
            <div className="rounded-2xl border border-slate-100 bg-white p-4">
              <h3 className="font-semibold mb-2">Estilos</h3>
              <div className="flex flex-wrap gap-2">
                {p.estilos.map((e, i) => (
                  <span key={i} className="px-2 py-1 text-xs rounded-lg bg-slate-100">{e}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Columna derecha (2 cols): Portafolio con Lightbox */}
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <h3 className="font-semibold mb-3">Portafolio</h3>
            {p.portafolio.length === 0 ? (
              <div className="text-slate-500 text-sm">Este fotógrafo aún no tiene fotos en su portafolio.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {p.portafolio.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="relative rounded-xl overflow-hidden border border-slate-100"
                    onClick={() => { setLbIndex(idx); setLbOpen(true); }}
                    title="Ver grande"
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <PhotoLightbox
        open={lbOpen}
        onClose={() => setLbOpen(false)}
        index={lbIndex}
        items={lbItems}
      />
    </main>
  );
}
