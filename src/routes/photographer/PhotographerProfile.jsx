import React, { useEffect, useMemo, useRef, useState } from "react";
import DefaultAvatar from "../../assets/profile/default-avatar.png";
import { supabase } from "../../lib/supabaseClient";
import PhotoLightbox from "../../components/PhotoLightbox.jsx";
import MapHotspots from "../../components/MapHotspots";
// ⬇️ rutas maestras desde Supabase
const GT_CENTER = { lat: 14.62, lon: -90.52 };

const SIGNED_AVATAR_FN = "https://xpxrrlsvnhpspmcpzzvv.supabase.co/functions/v1/signed-avatar-upload";
const SIGNED_PORTFOLIO_FN = "https://xpxrrlsvnhpspmcpzzvv.supabase.co/functions/v1/signed-portfolio-upload";

const AVATARS_BUCKET = "avatars";
const PORTFOLIO_BUCKET = "portfolio";
const PORTFOLIO_LIMIT = 20;

const RUTAS = [
  "Ruta Interamericana",
  "RN-14",
  "Carretera al Salvador",
  "Carretera al Atlántico",
  "RN-10 (Cañas)",
];

// ===== Helpers =====
function templatePreciosBase3() {
  return [
    { nombre: "1 foto", precio: "" },
    { nombre: "2 fotos", precio: "" },
    { nombre: "3 fotos", precio: "" },
  ];
}
function nextTierName(len) {
  const map = ["1 foto", "2 fotos", "3 fotos", "4 fotos", "5 fotos", "6 fotos", "Más de 6 fotos"];
  return map[len] || "Más de 6 fotos";
}
function canAddTier(len) {
  return len < 7;
}
function normalizePortafolio(pf) {
  if (!Array.isArray(pf)) return [];
  return pf.map((it) => (typeof it === "string" ? { url: it, path: null } : it)).filter(Boolean);
}

// Time helpers (4:00–14:00)
const MIN_STEP = 4 * 4;
const MAX_STEP = 14 * 4;
function clampStep(s) {
  return Math.max(MIN_STEP, Math.min(MAX_STEP, Number(s) || MIN_STEP));
}
function timeToStep(t = "06:00") {
  const [h, m] = t.split(":").map((n) => parseInt(n || "0", 10));
  return clampStep(h * 4 + Math.round((m || 0) / 15));
}
function stepToTime24(s) {
  const clamped = clampStep(s);
  const h = Math.floor(clamped / 4);
  const m = (clamped % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function to12h(time24) {
  const [h, m] = time24.split(":").map((n) => parseInt(n, 10));
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// 🔧 Header flotante offset
function useFloatingHeaderOffset(defaultPx = 88) {
  const [offset, setOffset] = React.useState(defaultPx);
  React.useEffect(() => {
    function calc() {
      const el = document.querySelector("[data-app-header]") || document.querySelector("header");
      if (!el) return setOffset(0);
      const rect = el.getBoundingClientRect();
      setOffset(Math.max(0, rect.bottom));
    }
    calc();
    window.addEventListener("resize", calc);
    window.addEventListener("scroll", calc, { passive: true });
    return () => {
      window.removeEventListener("resize", calc);
      window.removeEventListener("scroll", calc);
    };
  }, []);
  return offset;
}

export default function PhotographerProfile() {
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);

  const headerOffset = useFloatingHeaderOffset();
  const stickyRef = useRef(null);
  const [stickyH, setStickyH] = useState(112);
  const STICKY_GAP = 4;

  useEffect(() => {
    const measure = () => setStickyH(stickyRef.current?.offsetHeight || 112);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const fileRefAvatar = useRef(null);
  const fileRefPortfolio = useRef(null);

  const [data, setData] = useState({
    username: "",
    estudio: "",
    telefono: "",
    correo: "",
    website: "",
    facebook: "",
    instagram: "",
    avatar_url: "",
    portafolio: [],
    precios: templatePreciosBase3(),
    cuentas: [],
  });

  const [puntos, setPuntos] = useState([]);
  const [mapEdit, setMapEdit] = useState(false);
  const [routeOverlays, setRouteOverlays] = useState([]); // rutas maestras (GeoJSON)

  // Lightbox
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);
  const lbItems = (data.portafolio || []).map((it, i) => ({ src: it.url, alt: `Foto ${i + 1}` }));

  // Handlers
  const onField = (k) => (e) => setData((d) => ({ ...d, [k]: e.target.value }));
  const onPrecioNombre = (i) => (e) =>
    setData((d) => {
      const arr = [...d.precios];
      arr[i] = { ...arr[i], nombre: e.target.value };
      return { ...d, precios: arr };
    });
  const onPrecioValor = (i) => (e) =>
    setData((d) => {
      const arr = [...d.precios];
      arr[i] = { ...arr[i], precio: e.target.value };
      return { ...d, precios: arr };
    });
  function addTier() {
    setData((d) => {
      const len = d.precios.length;
      if (!canAddTier(len)) return d;
      const nombre = nextTierName(len);
      return { ...d, precios: [...d.precios, { nombre, precio: "" }] };
    });
  }
  function remTier(i) {
    setData((d) => {
      const arr = [...d.precios];
      if (arr.length <= 3) return d;
      arr.splice(i, 1);
      return { ...d, precios: arr };
    });
  }

  // Cargar perfil
  useEffect(() => {
    let alive = true;
    async function init() {
      try {
        setLoading(true);
        const { data: ures } = await supabase.auth.getUser();
        const u = ures?.user;
        if (!u) {
          setError("Debes iniciar sesión.");
          setLoading(false);
          return;
        }
        if (!alive) return;
        setUser(u);

        const prof = await fetchOrCreatePhotographer(u);
        if (!alive) return;

        const cuentas = Array.isArray(prof?.pagos?.cuentas) ? prof.pagos.cuentas : [];

        setData((d) => ({
          ...d,
          username: prof?.username || "",
          estudio: prof?.estudio || (u.user_metadata?.display_name || ""),
          telefono: prof?.telefono || "",
          correo: prof?.correo || u.email || "",
          website: prof?.website || "",
          facebook: prof?.facebook || "",
          instagram: prof?.instagram || "",
          avatar_url: prof?.avatar_url || "",
          portafolio: normalizePortafolio(prof?.portafolio),
          precios: Array.isArray(prof?.precios) && prof.precios.length ? prof.precios : d.precios,
          cuentas,
        }));
        setPuntos(Array.isArray(prof?.puntos) ? prof.puntos : []);
        // cargar rutas maestras (activas)
        try {
          const { data: routes, error: rErr } = await supabase
            .from("photo_routes")
            .select("*")
            .eq("is_active", true);
          if (rErr) throw rErr;
          if (alive) setRouteOverlays(routes || []);
        } catch (e) {
          console.warn("No se pudieron cargar las rutas maestras:", e.message);
        }
      } catch (e) {
        setError(e.message || "Error cargando perfil");
      } finally {
        if (alive) setLoading(false);
      }
    }
    init();
    return () => {
      alive = false;
    };
  }, []);

  async function fetchOrCreatePhotographer(u) {
    const { data: row, error } = await supabase
      .from("photographer_profile")
      .select("*")
      .eq("user_id", u.id)
      .maybeSingle();
    if (!row && !error) {
      const payload = {
        user_id: u.id,
        username: "",
        estudio: u.user_metadata?.display_name || "",
        correo: u.email || "",
        portafolio: [],
        precios: templatePreciosBase3(),
        pagos: { cuentas: [] },
        puntos: [],
      };
      const { data: ins } = await supabase
        .from("photographer_profile")
        .upsert(payload, { onConflict: "user_id" })
        .select()
        .maybeSingle();
      return ins || payload;
    }
    return row;
  }

  async function guardar() {
    if (!user) return;
    try {
      setSaving(true);
      setError("");
      const payload = {
        username: data.username?.trim() || null,
        estudio: data.estudio?.trim() || null,
        telefono: data.telefono?.trim() || null,
        correo: data.correo?.trim() || null,
        website: data.website?.trim() || null,
        facebook: data.facebook?.trim() || null,
        instagram: data.instagram?.trim() || null,
        avatar_url: data.avatar_url || null,
        portafolio: Array.isArray(data.portafolio) ? data.portafolio : [],
        precios: Array.isArray(data.precios) ? data.precios : [],
        pagos: { cuentas: Array.isArray(data.cuentas) ? data.cuentas : [] },
        puntos: Array.isArray(puntos) ? puntos : [],
      };
      const { error } = await supabase.from("photographer_profile").update(payload).eq("user_id", user.id);
      if (error) throw error;
      setEditMode(false);
      setMapEdit(false);
    } catch (e) {
      setError(e.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  function cancelar() {
    setEditMode(false);
    setMapEdit(false);
  }

  // Avatar upload
  async function onPickAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setSaving(true);
      setError("");

      const { data: sess } = await supabase.auth.getSession();
      const uid = sess?.session?.user?.id;
      if (!uid) throw new Error("Tu sesión expiró. Volvé a iniciar sesión.");

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const res = await fetch(SIGNED_AVATAR_FN, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sess.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ kind: "studio", ext }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out?.error || "No se pudo firmar subida");
      const { path, token } = out;

      const { error: upErr } = await supabase.storage
        .from(AVATARS_BUCKET)
        .uploadToSignedUrl(path, token, file, { upsert: true, contentType: file.type || "image/jpeg" });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
      const url = pub?.publicUrl;

      const { error: updErr } = await supabase
        .from("photographer_profile")
        .update({ avatar_url: url })
        .eq("user_id", uid);
      if (updErr) throw updErr;

      setData((d) => ({ ...d, avatar_url: url }));
    } catch (e) {
      setError(e.message || "No se pudo subir el avatar");
    } finally {
      setSaving(false);
    }
  }

  // Portfolio upload
  function pickPortfolio() {
    fileRefPortfolio.current?.click();
  }

  async function onPickPortfolio(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    try {
      setSaving(true);
      setError("");

      const { data: sess } = await supabase.auth.getSession();
      const uid = sess?.session?.user?.id;
      if (!uid) throw new Error("Tu sesión expiró. Volvé a iniciar sesión.");

      const current = Array.isArray(data.portafolio) ? data.portafolio.length : 0;
      const slots = Math.max(0, PORTFOLIO_LIMIT - current);
      if (slots <= 0) {
        setError(`Ya llegaste al límite de ${PORTFOLIO_LIMIT} fotos.`);
        return;
      }

      const queue = files.slice(0, slots);
      const added = [];

      for (const file of queue) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const res = await fetch(SIGNED_PORTFOLIO_FN, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sess.session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ kind: "studio", ext }),
        });
        const out = await res.json();
        if (!res.ok) throw new Error(out?.error || "No se pudo firmar subida");
        const { path, token } = out;

        const { error: upErr } = await supabase.storage
          .from(PORTFOLIO_BUCKET)
          .uploadToSignedUrl(path, token, file, {
            upsert: true,
            contentType: file.type || "image/jpeg",
          });
        if (upErr) throw upErr;

        const { data: pub } = supabase.storage.from(PORTFOLIO_BUCKET).getPublicUrl(path);
        const url = pub?.publicUrl;
        added.push({ url, path });
      }

      const newList = [...(data.portafolio || []), ...added];

      const { error: updErr } = await supabase
        .from("photographer_profile")
        .update({ portafolio: newList })
        .eq("user_id", uid);
      if (updErr) throw updErr;

      setData((d) => ({ ...d, portafolio: newList }));
    } catch (e) {
      setError(e.message || "No se pudo subir al portafolio");
    } finally {
      setSaving(false);
      if (fileRefPortfolio.current) fileRefPortfolio.current.value = "";
    }
  }

  // Puntos
  // Centro GT por defecto (si no hay lat/lon aún)
  const GT_CENTER = { lat: 14.62, lon: -90.52 };
  function addPoint() {
    const id = "pt" + Math.random().toString(36).slice(2, 7);
    const nuevo = {
      id,
      nombre: "Nuevo Punto",
      ruta: RUTAS[0],
      lat: GT_CENTER.lat,
      lon: GT_CENTER.lon,
      horarios: [{ dia: "Domingo", inicio: "06:00", fin: "08:00" }],
    };
    setPuntos((prev) => [...prev, nuevo]);
  }
  function removePoint(id) {
    setPuntos((prev) => prev.filter((p) => p.id !== id));
  }
  function updatePointField(id, key, value) {
    setPuntos((prev) => prev.map((p) => (p.id === id ? { ...p, [key]: value } : p)));
  }
  function updateHorario(id, idx, key, value) {
    setPuntos((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const arr = [...p.horarios];
        arr[idx] = { ...arr[idx], [key]: value };
        return { ...p, horarios: arr };
      })
    );
  }
  function addHorario(id) {
    setPuntos((prev) =>
      prev.map((p) =>
        p.id !== id ? p : { ...p, horarios: [...p.horarios, { dia: "Domingo", inicio: "06:00", fin: "08:00" }] }
      )
    );
  }
  function removeHorario(id, idx) {
    setPuntos((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const arr = p.horarios.slice();
        arr.splice(idx, 1);
        return { ...p, horarios: arr };
      })
    );
  }

  // Render
  return (
    <main
      className="max-w-6xl mx-auto px-5 pb-10 text-slate-100"
      style={{ paddingTop: headerOffset + stickyH + STICKY_GAP, paddingBottom: editMode ? 96 : undefined }}
    >
      {/* BG detrás del header y sub-encabezado */}
      <div
        className="fixed left-0 right-0 z-30 bg-studio-panel border-b border-white/10"
        style={{ top: 0, height: headerOffset + stickyH + STICKY_GAP }}
        aria-hidden
      />

      {/* Sticky header perfil */}
      <div ref={stickyRef} className="fixed left-0 right-0 z-40" style={{ top: headerOffset + 8 }}>
        <div className="max-w-6xl mx-auto px-5 py-2 flex items-center gap-4">
          <img
            src={data.avatar_url || DefaultAvatar}
            alt="Foto de perfil"
            className="w-28 h-28 rounded-full object-cover border-4 border-blue-400 shadow-md"
          />
          <div className="flex-1 min-w-0">
            {!editMode ? (
              <>
                <h1 className="text-2xl sm:text-3xl font-display font-extrabold truncate">
                  {data.username ? `@${data.username.replace(/^@/, "")}` : "@usuario"}
                </h1>
                <p className="text-white/90 mt-0.5 text-sm truncate">{data.estudio || "—"}</p>
              </>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  className="border border-white/15 rounded-lg px-3 py-2 bg-white/5 text-white placeholder-white/60 text-lg font-semibold w-full sm:max-w-xs"
                  value={data.username}
                  onChange={onField("username")}
                  placeholder="@usuario"
                />
                <input
                  className="border border-white/15 rounded-lg px-3 py-2 bg-white/5 text-white placeholder-white/60 w-full sm:max-w-sm"
                  value={data.estudio}
                  onChange={onField("estudio")}
                  placeholder="Nombre del estudio"
                />
              </div>
            )}
          </div>

          {!editMode ? (
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="h-10 px-4 rounded-xl bg-blue-600 text-white font-display font-bold shrink-0"
            >
              Editar
            </button>
          ) : (
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={guardar}
                className="h-10 px-4 rounded-xl bg-blue-600 text-white font-display font-bold disabled:opacity-50"
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button
                type="button"
                onClick={cancelar}
                className="h-10 px-4 rounded-xl bg-white/10 text-white border border-white/15 font-display font-bold"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="mt-6">Cargando...</div>
      ) : error ? (
        <div className="mt-6 text-red-400">{error}</div>
      ) : (
        <>
          {/* Contacto y redes */}
          <section className="mt-2 mb-8">
            <h2 className="text-xl font-semibold mb-3">Contacto</h2>
            {editMode ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input className="border border-white/15 rounded-lg px-3 py-2 bg-white/5 text-white placeholder-white/60" placeholder="Teléfono" value={data.telefono} onChange={onField("telefono")} />
                  <input className="border border-white/15 rounded-lg px-3 py-2 bg-white/5 text-white placeholder-white/60" placeholder="Correo electrónico" value={data.correo} onChange={onField("correo")} />
                  <input className="border border-white/15 rounded-lg px-3 py-2 bg-white/5 text-white placeholder-white/60" placeholder="Sitio web (opcional)" value={data.website} onChange={onField("website")} />
                </div>
                <h3 className="text-lg font-semibold mt-5 mb-2">Redes Sociales</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input className="border border-white/15 rounded-lg px-3 py-2 bg-white/5 text-white placeholder-white/60" placeholder="Facebook URL" value={data.facebook} onChange={onField("facebook")} />
                  <input className="border border-white/15 rounded-lg px-3 py-2 bg-white/5 text-white placeholder-white/60" placeholder="Instagram URL" value={data.instagram} onChange={onField("instagram")} />
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FieldDark label="Teléfono" value={data.telefono} />
                <FieldDark label="Correo" value={data.correo} />
                <FieldDark label="Sitio web" value={data.website || "—"} />
                <FieldDark label="Facebook" value={data.facebook} isLink />
                <FieldDark label="Instagram" value={data.instagram} isLink />
              </div>
            )}
          </section>

          {/* Portafolio – Columnas verticales animadas */}
          <section className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">Portafolio</h2>
              <div className="text-sm text-white/70">
                {data.portafolio?.length || 0} / {PORTFOLIO_LIMIT}
              </div>
            </div>

            <div className="mb-3 flex items-center gap-2">
              {editMode && (
                <>
                  <button className="px-3 py-2 rounded-lg bg-blue-600 text-white font-display text-sm" type="button" onClick={() => fileRefPortfolio.current?.click()}>
                    Subir fotos
                  </button>
                  <input ref={fileRefPortfolio} type="file" accept="image/*" multiple className="hidden" onChange={onPickPortfolio} />
                </>
              )}
            </div>

            {data.portafolio?.length ? (
              <ColumnMarqueeGallery
                items={data.portafolio}
                onOpen={(idx) => {
                  setLbIndex(idx);
                  setLbOpen(true);
                }}
              />
            ) : (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-slate-300">
                Aún no tenés fotos en tu portafolio.
              </div>
            )}
          </section>

          {/* Precios */}
          <section className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">Precios</h2>
              {editMode && (
                <div className="flex items-center gap-2">
                  <button className="h-9 px-3 rounded-lg bg-blue-600 text-white font-display font-bold disabled:opacity-50" onClick={addTier} type="button" disabled={!canAddTier(data.precios.length)} title="Agregar tramo">
                    Agregar tramo
                  </button>
                  <span className="text-xs text-white/60">(mínimo 3)</span>
                </div>
              )}
            </div>

            {editMode ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.precios.map((p, i) => (
                  <div key={i} className="rounded-xl border border-white/10 p-4 bg-white/5 relative">
                    {data.precios.length > 3 && (
                      <button className="absolute top-2 right-2 w-7 h-7 grid place-items-center rounded-full bg-red-600 text-white" type="button" onClick={() => remTier(i)} title="Eliminar este tramo">
                        ✕
                      </button>
                    )}
                    <input className="w-full mb-2 border border-white/10 rounded-lg px-3 py-2 bg-transparent text-white placeholder-white/60" value={p.nombre} onChange={onPrecioNombre(i)} />
                    <input className="w-full border border-white/10 rounded-lg px-3 py-2 bg-transparent text-white placeholder-white/60" value={p.precio} onChange={onPrecioValor(i)} placeholder="Q0.00" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.precios.slice(0, Math.max(3, data.precios.length)).map((p, i) => (
                  <div key={i} className="rounded-xl border border-white/10 p-4 bg-white/5">
                    <h4 className="font-display font-bold mb-1">{p.nombre}</h4>
                    <p className="text-2xl font-display font-bold">{p.precio || "—"}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Puntos + Mini mapa */}
          <section className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">Puntos de fotografía</h2>
              {editMode && (
                <div className="flex items-center gap-2">
                  <button
                    className={
                      "h-9 px-3 rounded-lg font-display font-bold border " +
                      (mapEdit ? "bg-blue-600 text-white border-white/10" : "bg-white/5 text-white border-white/15")
                    }
                    type="button"
                    onClick={() => setMapEdit((v) => !v)}
                  >
                    {mapEdit ? "Salir del editor de mapa" : "Entrar al editor de mapa"}
                  </button>
                  <button className="h-9 px-3 rounded-lg bg-blue-600 text-white font-display font-bold" type="button" onClick={addPoint}>
                    Agregar punto
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {puntos.length === 0 && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-slate-300">Aún no tenés puntos. Agregá uno para empezar.</div>
              )}

              {puntos.map((p) => (
                <div key={p.id} className="relative rounded-xl border border-white/10 p-4 bg-white/5">
                  {editMode && (
                    <button className="absolute top-2 right-2 w-7 h-7 grid place-items-center rounded-full bg-red-600 text-white" onClick={() => removePoint(p.id)} type="button" title="Eliminar punto">
                      ✕
                    </button>
                  )}

                  {editMode ? (
                    <>
                      <input className="w-full border border-white/15 rounded-lg px-3 py-2 bg-transparent text-white placeholder-white/60 mb-2" value={p.nombre} onChange={(e) => updatePointField(p.id, "nombre", e.target.value)} placeholder="Nombre del punto" />
                      <select className="w-full border border-white/15 rounded-lg px-3 py-2 bg-transparent text-white mb-2" value={p.ruta || RUTAS[0]} onChange={(e) => updatePointField(p.id, "ruta", e.target.value)}>
                        {RUTAS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>

                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <div className="text-xs text-white/60">Lat</div>
                          <input
                            className="w-full border border-white/15 rounded-lg px-2 py-1 bg-transparent text-white"
                            value={p.lat ?? ""}
                            onChange={(e) => updatePointField(p.id, "lat", parseFloat(e.target.value))}
                            placeholder="14.62"
                          />
                        </div>
                        <div>
                          <div className="text-xs text-white/60">Lon</div>
                          <input
                            className="w-full border border-white/15 rounded-lg px-2 py-1 bg-transparent text-white"
                            value={p.lon ?? ""}
                            onChange={(e) => updatePointField(p.id, "lon", parseFloat(e.target.value))}
                            placeholder="-90.52"
                          />
                        </div>
                      </div>

                      {(p.horarios || []).map((h, idx) => {
                        const start = clampStep(timeToStep(h.inicio));
                        const end = clampStep(timeToStep(h.fin));
                        const a = Math.min(start, end);
                        const b = Math.max(start, end);
                        return (
                          <div key={idx} className="mb-2 rounded-lg border border-white/10 p-3 bg-white/5">
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-2">
                              <select
                                className="border border-white/15 rounded-lg px-2 py-1 bg-transparent text-white"
                                value={h.dia}
                                onChange={(e) => updateHorario(p.id, idx, "dia", e.target.value)}
                              >
                                <option>Domingo</option>
                                <option>Sábado</option>
                                <option>Viernes</option>
                                <option>Otro</option>
                              </select>
                              <div className="text-xs text-white/60 text-center">·</div>
                              <div className="text-xs text-white/80 text-right font-mono">
                                {to12h(stepToTime24(a))} – {to12h(stepToTime24(b))}
                              </div>
                            </div>

                            <DualSlider
                              min={MIN_STEP}
                              max={MAX_STEP}
                              a={a}
                              b={b}
                              onChangeA={(val) => updateHorario(p.id, idx, "inicio", stepToTime24(val))}
                              onChangeB={(val) => updateHorario(p.id, idx, "fin", stepToTime24(val))}
                            />

                            <div className="mt-2 flex justify-between text-[12px] text-white/60 font-mono">
                              <span>4:00 AM</span>
                              <span>2:00 PM</span>
                            </div>

                            <div className="mt-2 flex justify-end">
                              <button className="px-2 h-8 rounded-lg border border-white/15 bg-white/10 text-white" onClick={() => removeHorario(p.id, idx)} type="button" title="Eliminar horario">
                                Eliminar horario
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      <button className="h-8 px-3 rounded-lg bg-white/10 text-white border border-white/15" onClick={() => addHorario(p.id)} type="button">
                        Agregar horario
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="font-display font-bold">{p.nombre}</div>
                      <div className="text-slate-300 text-sm">{p.ruta || "—"}</div>
                      <div className="text-slate-400 text-xs mt-1">Posición: ({p.lat ?? "—"} , {p.lon ?? "—"})</div>
                      <div className="mt-2 text-sm">
                        {p.horarios?.map((h, idx) => (
                          <div key={idx} className="text-slate-300">
                            {h.dia}: {to12h(h.inicio)} – {to12h(h.fin)}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Mapa real (OpenStreetMap/Leaflet) con todos los puntos + rutas maestras */}
            {(() => {
              // Normaliza: si no hay lat/lon, usa centro GT para arrastrar
              const mapPts = (puntos || []).map((pt) => ({
                ...pt,
                lat: Number.isFinite(pt?.lat) ? pt.lat : GT_CENTER.lat,
                lon: Number.isFinite(pt?.lon) ? pt.lon : GT_CENTER.lon,
              }));
              // Solo mostrar rutas relacionadas a los puntos del fotógrafo:
              const visibleNames = Array.from(new Set(mapPts.map((x) => x.ruta).filter(Boolean)));
              return (
                <div className="mt-5">
                  <MapHotspots
                    points={mapPts}
                    mode={editMode && mapEdit ? "edit" : "view"}
                    height={340}
                    tile={import.meta.env.VITE_MAPTILER_KEY ? "mt_streets" : "osm"}
                    maptilerKey={import.meta.env.VITE_MAPTILER_KEY}
                    routeOverlays={routeOverlays}
                    visibleRouteNames={visibleNames}
                    fitStrategy="routes-or-points"
                    filterRouteNames
                    fitToMarkers
                    fitPaddingTop={160}
                    markerPx={22}                 // pines más grandes
                    showTooltips={true}           // overlay visible siempre
                    onChange={editMode && mapEdit ? (arr) => setPuntos(arr) : undefined}
                  />
                  {editMode && mapEdit && (
                    <p className="mt-2 text-xs text-white/70">
                      Tip: En modo <b>Dibujar ruta</b> podés clickear para trazar una línea. Los puntos se arrastran.
                    </p>
                  )}
                </div>
              );
            })()}
          </section>
        </>
      )}

      {editMode && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-studio-panel/90 backdrop-blur supports-[backdrop-filter]:bg-studio-panel/70">
          <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-end gap-2">
            <button className="px-4 h-11 rounded-xl bg-blue-600 text-white font-display font-bold disabled:opacity-50" onClick={guardar} type="button" disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
            <button className="px-4 h-11 rounded-xl bg-white/10 text-white font-display font-bold border border-white/15" onClick={cancelar} type="button">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {lbOpen && lbItems.length > 0 && (
        <PhotoLightbox
          images={lbItems}
          index={lbIndex}
          onIndexChange={setLbIndex}
          onClose={() => setLbOpen(false)}
          showThumbnails={false}
          captionPosition={null}
          arrowBlue
        />
      )}
    </main>
  );
}

function FieldDark({ label, value, isLink }) {
  const content = !value || value === "—" ? "—" : value;
  return (
    <div className="rounded-lg px-3 py-2 bg-white/5 border border-white/10">
      <div className="text-xs text-white/60">{label}</div>
      <div className="text-white">
        {isLink ? (
          <a className="underline underline-offset-2" href={content} target="_blank" rel="noreferrer">
            {content}
          </a>
        ) : (
          content
        )}
      </div>
    </div>
  );
}

/* ======= Galería: columnas con carrusel vertical infinito
   → FOTO COMPLETA (sin límite de alto en tiles) ======= */
function ColumnMarqueeGallery({
  items,
  onOpen,
  columnHeightSm = 560, // alto del viewport por columna (solo esto es fijo)
  columnHeightMd = 760,
}) {
  const [cols, setCols] = React.useState(3);

  React.useEffect(() => {
    const calc = () => setCols(window.innerWidth >= 1024 ? 4 : window.innerWidth >= 768 ? 3 : 2);
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  const columns = React.useMemo(() => {
    const c = Math.max(1, Math.min(4, cols));
    const arr = Array.from({ length: c }, () => []);
    (items || []).forEach((it, i) => arr[i % c].push({ ...it, _idx: i }));
    return arr;
  }, [items, cols]);

  return (
    <div className="group relative rounded-2xl overflow-hidden border border-white/10 bg-white/5 p-3">
      <style>{`
        @keyframes scrollY { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }
        .marquee-col { animation: scrollY var(--dur, 36s) linear infinite; will-change: transform; }
        .marquee-col.reverse { animation-direction: reverse; }
        .group:hover .marquee-col { animation-play-state: paused; }
        /* ⚠️ Sin límites: que ninguna regla global ponga max-height a imgs */
        .marquee-item img { width:100%; height:auto; max-height:none; object-fit:contain; display:block; }
      `}</style>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(4, cols))}, minmax(0,1fr))` }}
      >
        {columns.map((col, i) => {
          const dur = 28 + i * 6;
          const reverse = i % 2 === 1;
          const looped = [...col, ...col]; // loop perfecto
          return (
            <div
              key={i}
              className="relative rounded-xl overflow-hidden"
              style={{ height: cols >= 3 ? columnHeightMd : columnHeightSm }}
            >
              {/* máscara para uniones */}
              <div
                className="pointer-events-none absolute inset-0 z-10"
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(9,10,15,0.85), transparent 10%, transparent 90%, rgba(9,10,15,0.85))",
                }}
              />

              <div
                className={`absolute inset-0 marquee-col ${reverse ? "reverse" : ""}`}
                style={{ ["--dur"]: `${dur}s` }}
              >
                {/* Contenido real de la columna (una copia) */}
                <div className="flex flex-col gap-3">
                  {col.map((it, k) => (
                    <div key={k} className="marquee-item">
                      <button
                        type="button"
                        onClick={() => onOpen?.(it._idx)}
                        className="w-full text-left rounded-xl bg-black/30 border border-white/10"
                        title="Ver grande"
                        style={{ padding: 0 }}
                      >
                        <img src={it.url} alt="" loading="lazy" />
                      </button>
                    </div>
                  ))}
                </div>
                {/* Segunda copia para loop infinito (sin NINGÚN alto fijo) */}
                <div className="flex flex-col gap-3 mt-3">
                  {col.map((it, k) => (
                    <div key={`dup-${k}`} className="marquee-item">
                      <button
                        type="button"
                        onClick={() => onOpen?.(it._idx)}
                        className="w-full text-left rounded-xl bg-black/30 border border-white/10"
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

/* ======= Dual Slider (inicio/fin) ======= */
function DualSlider({ min, max, a, b, onChangeA, onChangeB }) {
  const ref = React.useRef(null);
  const dragging = React.useRef(null);
  const clamp = (v) => Math.max(min, Math.min(max, v));
  const toPct = (v) => ((v - min) / (max - min)) * 100;

  const onMove = React.useCallback(
    (ev) => {
      if (!dragging.current || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const raw = min + Math.round(ratio * (max - min));
      const val = clamp(raw);
      if (dragging.current === "a") {
        onChangeA(Math.min(val, b - 1));
      } else {
        onChangeB(Math.max(val, a + 1));
      }
    },
    [a, b, min, max, onChangeA, onChangeB]
  );

  const stop = React.useCallback(() => {
    dragging.current = null;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", stop);
  }, [onMove]);

  const startDrag = (which) => (ev) => {
    dragging.current = which;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", stop);
    ev.preventDefault();
  };

  return (
    <div ref={ref} className="relative h-8 select-none">
      <div className="absolute inset-0 rounded-full bg-white/10" />
      <div
        className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full bg-blue-500"
        style={{ left: `${toPct(a)}%`, width: `${toPct(b) - toPct(a)}%` }}
      />
      <button
        type="button"
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full border border-white/50 bg-white shadow"
        style={{ left: `${toPct(a)}%` }}
        onMouseDown={startDrag("a")}
        aria-label="Hora inicio"
        title="Mover hora de inicio"
      />
      <button
        type="button"
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full border border-white/50 bg-white shadow"
        style={{ left: `${toPct(b)}%` }}
        onMouseDown={startDrag("b")}
        aria-label="Hora fin"
        title="Mover hora final"
      />
    </div>
  );
}
