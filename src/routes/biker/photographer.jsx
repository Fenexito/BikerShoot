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
      <path d="M12 2.2c3.2 0 3.584.012 4.85.07 1.17.054 1.97.24 2.67.51.72.28 1.33.66 1.92 1.25.59.59.97 1.2 1.25 1.92.27.7.46 1.5.51 2.67.06 1.27.07 1.65.07 4.85s-.012 3.584-.07 4.85c-.054 1.17-.24 1.97-.51 2.67a5.1 5.1 0 0 1-1.25 1.92 5.1 5.1 0 0 1-1.92 1.25c-.7.27-1.5.46-2.67.51-1.27.06-1.65.07-4.85.07s-3.584-.012-4.85-.07c-1.17-.054-1.97-.24-2.67-.51a5.1 5.1 0 0 1-1.92-1.25 5.1 5.1 0 0 1-1.25-1.92c-.27-.7-.46-1.5-.51-2.67C2.212 15.584 2.2 15.2 2.2 12s.012-3.584.07-4.85c.054-1.17.24-1.97.51-2.67.28-.72.66-1.33 1.25-1.92.59-.59 1.2-.97 1.92-1.25.7-.27 1.5-.46 2.67-.51C8.416 2.212 8.8 2.2 12 2.2Zm0 1.8c-3.16 0-3.53.012-4.77.07-1.03.047-1.59.22-1.96.36-.49.19-.84.42-1.2.78-.36.36-.59.71-.78 1.2-.14.37-.31.93-.36 1.96-.06 1.24-.07 1.61-.07 4.77s.012 3.53.07 4.77c.047 1.03.22 1.59.36 1.96.19.49.42.84.78 1.2.36.36.71.59 1.2.78.37.14.93.31 1.96.36 1.24.06 1.61.07 4.77.07s3.53-.012 4.77-.07c1.03-.047 1.59-.22 1.96-.36.49-.19.84-.42 1.2-.78.36-.36.59-.71.78-1.2.14-.37.31-.93.36-1.96.06-1.24.07-1.61.07-4.77s-.012-3.53-.07-4.77c-.047-1.03-.22-1.59-.36-1.96-.19-.49-.42-.84-.78-1.2-.36-.36-.71-.59-1.2-.78-.37-.14-.93-.31-1.96-.36-1.24-.06-1.61-.07-4.77-.07Zm0 3.6a6.8 6.8 0 1 1 0 13.6 6.8 6.8 0 0 1 0-13.6Zm0 1.8a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm6.9-2a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
    </svg>
  );
}

/* ============================
   Galería columnas (fotos completas, alto natural)
   ============================ */
function ColumnMarqueeGallery({ items, onOpen, columnHeightSm = 560, columnHeightMd = 760 }) {
  const [cols, setCols] = React.useState(3);

  React.useEffect(() => {
    const calc = () => setCols(window.innerWidth >= 1024 ? 4 : window.innerWidth >= 768 ? 3 : 2);
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  // repartir items por columnas (módulo)
  const columns = React.useMemo(() => {
    const c = Math.max(1, Math.min(4, cols));
    const arr = Array.from({ length: c }, () => []);
    (items || []).forEach((it, i) => arr[i % c].push({ ...it, _idx: i }));
    return arr;
  }, [items, cols]);

  return (
    <div className="group relative rounded-2xl overflow-hidden border border-white/10 bg-white p-3">
      <style>{`
        @keyframes scrollY { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }
        .marquee-col { animation: scrollY var(--dur, 36s) linear infinite; will-change: transform; }
        .marquee-col.reverse { animation-direction: reverse; }
        .group:hover .marquee-col { animation-play-state: paused; }
        .marquee-item img { width:100%; height:auto; max-height:none; object-fit:contain; display:block; }
      `}</style>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(4, cols))}, minmax(0,1fr))` }}
      >
        {columns.map((col, i) => {
          const dur = 28 + i * 6;
          const reverse = i % 2 === 1;
          return (
            <div
              key={i}
              className="relative rounded-xl overflow-hidden"
              style={{ height: cols >= 3 ? columnHeightMd : columnHeightSm }}
            >
              {/* máscara arriba/abajo para suavizar loop */}
              <div
                className="pointer-events-none absolute inset-0 z-10"
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(248,249,251,1), rgba(248,249,251,0) 10%, rgba(248,249,251,0) 90%, rgba(248,249,251,1))",
                }}
              />
              <div
                className={`absolute inset-0 marquee-col ${reverse ? "reverse" : ""}`}
                style={{ ["--dur"]: `${dur}s` }}
              >
                {/* primera copia */}
                <div className="flex flex-col gap-3">
                  {col.map((it, k) => (
                    <div key={k} className="marquee-item">
                      <button
                        type="button"
                        onClick={() => onOpen?.(it._idx)}
                        className="w-full text-left rounded-xl bg-black/30 border border-black/10 overflow-hidden"
                        style={{ padding: 0 }}
                        title="Ver grande"
                      >
                        <img src={it.url} alt="" loading="lazy" />
                      </button>
                    </div>
                  ))}
                </div>
                {/* segunda copia para loop infinito */}
                <div className="flex flex-col gap-3 mt-3">
                  {col.map((it, k) => (
                    <div key={`dup-${k}`} className="marquee-item">
                      <button
                        type="button"
                        onClick={() => onOpen?.(it._idx)}
                        className="w-full text-left rounded-xl bg-black/30 border border-black/10 overflow-hidden"
                        style={{ padding: 0 }}
                        title="Ver grande"
                      >
                        <img src={it.url} alt="" loading="lazy" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
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

export default function BikerPhotographerDetail() {
  const { id } = useParams(); // /app/fotografos/:id
  const nav = useNavigate();

  const [p, setP] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");
  const [lbOpen, setLbOpen] = React.useState(false);
  const [lbIndex, setLbIndex] = React.useState(0);

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
          precios: Array.isArray(data.precios) ? data.precios : [],
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

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-5 py-8">
        <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-card bg-white">
          <div className="aspect-[16/9] bg-slate-200 animate-pulse" />
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

  return (
    <main className="max-w-5xl mx-auto px-5 py-8">
      {/* Header */}
      <div className="mb-6">
        <button className="mb-4 text-sm text-blue-600 hover:underline" onClick={() => nav(-1)}>
          ← Regresar
        </button>

        <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-card bg-white">
          <div className="aspect-[16/9] overflow-hidden">
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

            <div className="mt-5 flex flex-wrap gap-2">
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
          </div>
        </div>
      </div>

      {/* Contacto / Portafolio / Precios */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="md:col-span-2 rounded-2xl border border-slate-100 p-5 bg-white">
          <h2 className="text-lg font-semibold mb-3">Contacto</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Teléfono</dt>
              <dd className="font-medium">{p.telefono || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Correo</dt>
              <dd className="font-medium">{p.correo || "—"}</dd>
            </div>
          </dl>

          <h2 className="text-lg font-semibold mt-6 mb-3">Portafolio</h2>
          <ColumnMarqueeGallery
            items={p.portafolio.map((url) => ({ url }))}
            onOpen={(idx) => {
              setLbIndex(idx);
              setLbOpen(true);
            }}
          />
        </div>

        <aside className="md:col-span-1 rounded-2xl border border-slate-100 p-5 h-fit bg-white">
          <h3 className="text-lg font-semibold mb-3">Precios</h3>
          <ul className="space-y-2">
            {(p.precios || []).map((x, i) => (
              <li key={i} className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span>{x.nombre}</span>
                <span className="font-display font-bold">{formatQ(x.precio)}</span>
              </li>
            ))}
          </ul>

          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="mt-4 w-full h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white font-display font-bold flex items-center justify-center"
            >
              Contactar por WhatsApp
            </a>
          ) : (
            <button className="mt-4 w-full h-11 rounded-xl bg-slate-300 text-white font-display font-bold" disabled>
              Sin teléfono
            </button>
          )}
        </aside>
      </section>

      {/* Puntos de fotografía (tarjetas + mini mapa único) */}
      <section className="rounded-2xl border border-slate-100 p-5 bg-white">
        <h2 className="text-lg font-semibold mb-3">Puntos donde suele tomar fotos</h2>

        {(!p.puntos || p.puntos.length === 0) ? (
          <div className="text-slate-500">Aún no hay puntos publicados por este fotógrafo.</div>
        ) : (
          <>
            <div
              className={`grid grid-cols-1 ${p.puntos.length === 3 ? "md:grid-cols-3" : "md:grid-cols-4"} gap-4`}
            >
              {p.puntos.map((pt, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{pt.ruta || "Ruta"}</div>
                    <div className="text-xs text-slate-500">#{idx + 1}</div>
                  </div>
                  {pt.descripcion && (
                    <div className="mt-1 text-sm text-slate-600">{pt.descripcion}</div>
                  )}
                  {Array.isArray(pt.horarios) && pt.horarios.length > 0 && (
                    <div className="mt-2 text-sm">
                      <div className="text-slate-500">Horario</div>
                      <ul className="mt-1 space-y-1">
                        {pt.horarios.map((h, i) => (
                          <li key={i} className="flex items-center justify-between">
                            <span className="text-slate-700">
                              {toTime12(h.inicio)} – {toTime12(h.fin)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div><span className="text-slate-500">Lat:</span> {pt.lat ?? "—"}</div>
                    <div><span className="text-slate-500">Lon:</span> {pt.lon ?? "—"}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Mini mapa único con TODOS los puntos */}
            <div className="mt-4">
              <MapHotspots points={p.puntos} mode="view" height={300} />
            </div>
          </>
        )}
      </section>

      {/* Lightbox */}
      {lbOpen && (
        <PhotoLightbox
          isOpen={lbOpen}
          startIndex={lbIndex}
          items={lbItems}
          onClose={() => setLbOpen(false)}
        />
      )}
    </main>
  );
}
