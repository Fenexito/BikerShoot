import React, { useEffect, useRef, useState, useMemo } from "react";
import DefaultAvatar from "../../assets/profile/default-avatar.png";
import { supabase } from "../../lib/supabaseClient";
// ⬇️ Ajustá este import a la ruta real de tu componente
import PhotoLightbox from "../../components/PhotoLightbox.jsx";

// ⚙️ Pone tu REF real del proyecto en estas constantes
const SIGNED_AVATAR_FN = "https://xpxrrlsvnhpspmcpzzvv.supabase.co/functions/v1/signed-avatar-upload";
const SIGNED_PORTFOLIO_FN = "https://xpxrrlsvnhpspmcpzzvv.supabase.co/functions/v1/signed-portfolio-upload";

const MAX_GALERIA = 4;

 // Calcula el offset del header flotante (sticky) para anclar el sub-encabezado del perfil
 function useFloatingHeaderOffset(defaultPx = 88) {
   const [offset, setOffset] = React.useState(defaultPx);
   React.useEffect(() => {
     function calc() {
       const el =
         document.querySelector("[data-app-header]") ||
         document.querySelector("header");
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


export default function BikerProfile() {
  const headerOffset = useFloatingHeaderOffset(); // 👈 offset dinámico del header
   const stickyRef = useRef(null);
   const [stickyH, setStickyH] = useState(112); // altura estimada
   useEffect(() => {
     const measure = () => setStickyH(stickyRef.current?.offsetHeight || 112);
     measure();
     window.addEventListener("resize", measure);
     return () => window.removeEventListener("resize", measure);
   }, []);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);

  const fileRefAvatar = useRef(null);
  const fileRefGallery = useRef(null);

  const [data, setData] = useState({
    username: "",
    nombre: "",
    correo: "",
    telefono: "",
    ubicacion: "",
    facebook: "",
    instagram: "",
    moto: { marca: "", modelo: "", anio: "" }, // 👈 SIN cilindraje
    // Info adicional para IA
    moto_detalle: {
      color_moto: "",
      casco_marca: "",
      casco_color: "",
      traje_marca: "",
      traje_color: "",
      botas_marca: "",
      botas_color: "",
      guantes_marca: "",
      guantes_color: "",
    },
    avatar_url: "",
    galeria: [], // [{url, path}] | [string]
  });

  const onField = (k) => (e) => setData((d) => ({ ...d, [k]: e.target.value }));
  const onMoto = (k) => (e) => setData((d) => ({ ...d, moto: { ...d.moto, [k]: e.target.value } }));
  const onMotoDetalle = (k) => (e) =>
    setData((d) => ({ ...d, moto_detalle: { ...d.moto_detalle, [k]: e.target.value } }));

  // ===== Lightbox =====
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);
  const lbImages = useMemo(
    () =>
      (data.galeria || []).map((it, i) => ({
        src: typeof it === "string" ? it : it?.url,
        alt: `Foto ${i + 1}`,
      })),
    [data.galeria]
  );

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
        const prof = await fetchOrCreateBiker(u);
        if (!alive) return;
        setData((d) => ({
          ...d,
          username: prof?.username || "",
          nombre: prof?.nombre || (u.user_metadata?.display_name || ""),
          correo: prof?.correo || u.email || "",
          telefono: prof?.telefono || "",
          ubicacion: prof?.ubicacion || "",
          facebook: prof?.facebook || "",
          instagram: prof?.instagram || "",
          moto: {
            marca: prof?.moto?.marca || "",
            modelo: prof?.moto?.modelo || "",
            anio: prof?.moto?.anio || "",
          },
          moto_detalle: {
            color_moto: prof?.moto_detalle?.color_moto || "",
            casco_marca: prof?.moto_detalle?.casco_marca || "",
            casco_color: prof?.moto_detalle?.casco_color || "",
            traje_marca: prof?.moto_detalle?.traje_marca || "",
            traje_color: prof?.moto_detalle?.traje_color || "",
            botas_marca: prof?.moto_detalle?.botas_marca || "",
            botas_color: prof?.moto_detalle?.botas_color || "",
            guantes_marca: prof?.moto_detalle?.guantes_marca || "",
            guantes_color: prof?.moto_detalle?.guantes_color || "",
          },
          avatar_url: prof?.avatar_url || "",
          galeria: Array.isArray(prof?.galeria) ? prof.galeria : [],
        }));
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

  async function fetchOrCreateBiker(u) {
    const { data: row, error } = await supabase
      .from("biker_profile")
      .select("*")
      .eq("user_id", u.id)
      .maybeSingle();
    if (!row && !error) {
      const payload = {
        user_id: u.id,
        username: "",
        nombre: u.user_metadata?.display_name || "",
        correo: u.email || "",
        moto: {},
        moto_detalle: {},
        galeria: [],
      };
      const { data: ins } = await supabase
        .from("biker_profile")
        .upsert(payload, { onConflict: "user_id" })
        .select()
        .maybeSingle();
      return ins || payload;
    }
    if (row && !Array.isArray(row.galeria)) row.galeria = [];
    return row;
  }

  async function guardar() {
    if (!user) return;
    try {
      setSaving(true);
      setError("");
      const payload = {
        username: data.username?.trim() || null,
        nombre: data.nombre?.trim() || null,
        correo: data.correo?.trim() || null,
        telefono: data.telefono?.trim() || null,
        ubicacion: data.ubicacion?.trim() || null,
        facebook: data.facebook?.trim() || null,
        instagram: data.instagram?.trim() || null,
        moto: {
          marca: data.moto?.marca?.trim() || "",
          modelo: data.moto?.modelo?.trim() || "",
          anio: data.moto?.anio?.trim() || "",
          // SIN cilindraje
        },
        moto_detalle: {
          color_moto: data.moto_detalle?.color_moto?.trim() || "",
          casco_marca: data.moto_detalle?.casco_marca?.trim() || "",
          casco_color: data.moto_detalle?.casco_color?.trim() || "",
          traje_marca: data.moto_detalle?.traje_marca?.trim() || "",
          traje_color: data.moto_detalle?.traje_color?.trim() || "",
          botas_marca: data.moto_detalle?.botas_marca?.trim() || "",
          botas_color: data.moto_detalle?.botas_color?.trim() || "",
          guantes_marca: data.moto_detalle?.guantes_marca?.trim() || "",
          guantes_color: data.moto_detalle?.guantes_color?.trim() || "",
        },
        avatar_url: data.avatar_url || null,
        galeria: Array.isArray(data.galeria) ? data.galeria : [],
      };
      const { error } = await supabase.from("biker_profile").update(payload).eq("user_id", user.id);
      if (error) throw error;
      setEditMode(false);
    } catch (e) {
      setError(e.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  function cancelar() {
    setEditMode(false);
  }

  // =================== AVATAR (signed upload) ===================
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
        headers: { Authorization: `Bearer ${sess.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "biker", ext }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out?.error || "No se pudo firmar subida (avatar)");
      const { path, token } = out;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .uploadToSignedUrl(path, token, file, { upsert: true, contentType: file.type || "image/jpeg" });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = pub?.publicUrl;

      const { error: updErr } = await supabase.from("biker_profile").update({ avatar_url: url }).eq("user_id", uid);
      if (updErr) throw updErr;

      setData((d) => ({ ...d, avatar_url: url }));
    } catch (e) {
      setError(e.message || "No se pudo subir el avatar");
    } finally {
      setSaving(false);
    }
  }

  // =================== GALERÍA (signed upload, máx 4) ===================
  async function onPickGallery(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    try {
      setSaving(true);
      setError("");
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess?.session?.user?.id;
      if (!uid) throw new Error("Tu sesión expiró. Volvé a iniciar sesión.");

      const current = Array.isArray(data.galeria) ? data.galeria.length : 0;
      const free = Math.max(0, MAX_GALERIA - current);
      if (free === 0) {
        setError(`Alcanzaste el máximo de ${MAX_GALERIA} fotos.`);
        return;
      }

      const toUpload = files.slice(0, free);
      const newItems = [];

      for (const file of toUpload) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const res = await fetch(SIGNED_PORTFOLIO_FN, {
          method: "POST",
          headers: { Authorization: `Bearer ${sess.session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "biker", ext }),
        });
        const out = await res.json();
        if (!res.ok) throw new Error(out?.error || "No se pudo firmar subida (galería)");
        const { path, token } = out;

        const { error: upErr } = await supabase.storage
          .from("portfolio")
          .uploadToSignedUrl(path, token, file, { upsert: true, contentType: file.type || "image/jpeg" });
        if (upErr) throw upErr;

        const { data: pub } = supabase.storage.from("portfolio").getPublicUrl(path);
        const url = pub?.publicUrl;
        newItems.push({ url, path });
      }

      const updated = [...(data.galeria || []), ...newItems];
      const { error: updErr } = await supabase.from("biker_profile").update({ galeria: updated }).eq("user_id", user.id);
      if (updErr) throw updErr;

      setData((d) => ({ ...d, galeria: updated }));
    } catch (e) {
      setError(e.message || "No se pudo subir la(s) foto(s)");
    } finally {
      setSaving(false);
      if (fileRefGallery.current) fileRefGallery.current.value = "";
    }
  }

  // (Opcional) Eliminar foto de galería
  async function removeFromGallery(idx) {
    try {
      setSaving(true);
      setError("");
      const item = data.galeria?.[idx];
      const next = data.galeria.slice();
      next.splice(idx, 1);

      if (item?.path) {
        await supabase.storage.from("portfolio").remove([item.path]).catch(() => {});
      }

      const { error: updErr } = await supabase.from("biker_profile").update({ galeria: next }).eq("user_id", user.id);
      if (updErr) throw updErr;

      setData((d) => ({ ...d, galeria: next }));
    } catch (e) {
      setError(e.message || "No se pudo eliminar la foto");
    } finally {
      setSaving(false);
    }
  }

  return (
     <main
       className="max-w-5xl mx-auto px-5 pb-8"
       // offset del header + alto real del sub-encabezado + una separadita
      style={{ paddingTop: headerOffset + stickyH + 12, paddingBottom: editMode ? 96 : undefined }}
     >
      {/* BG fijo detrás del header y del sub-encabezado */}
      <div
        className="fixed left-0 right-0 z-30 bg-white border-b border-slate-200"
        style={{ top: 0, height: headerOffset + stickyH + 12 }}
        aria-hidden
      />
      {/* ENCABEZADO STICKY (limpio; va encima del BG) */}
      <div
        ref={stickyRef}
        className="fixed left-0 right-0 z-40"
        style={{ top: headerOffset + 8 }}  // bajadita para que respire
      >
        <div className="max-w-5xl mx-auto px-5 py-2 flex items-center gap-4">
          <img
            src={data.avatar_url || DefaultAvatar}
            alt="Foto de perfil"
            className="w-28 h-28 rounded-full object-cover border-4 border-blue-600 shadow-md"
          />
          <div className="flex-1 min-w-0">
            {!editMode ? (
              <>
                <h1 className="text-2xl sm:text-3xl font-display font-extrabold truncate">
                  {data.username ? `@${data.username.replace(/^@/, "")}` : "@usuario"}
                </h1>
                <p className="text-slate-600 mt-0.5 text-sm truncate">{data.nombre || "—"}</p>
              </>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  className="border rounded-lg px-3 py-2 text-lg font-semibold w-full sm:max-w-xs"
                  value={data.username}
                  onChange={onField("username")}
                  placeholder="@usuario"
                />
                <input
                  className="border rounded-lg px-3 py-2 w-full sm:max-w-sm"
                  value={data.nombre}
                  onChange={onField("nombre")}
                  placeholder="Nombre completo"
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
                className="h-10 px-4 rounded-xl bg-slate-200 text-slate-800 font-display font-bold"
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
        <div className="mt-6 text-red-600">{error}</div>
      ) : (
        <>
          {/* Información personal */}
          <section className="mt-6 mb-8">
            <h2 className="text-xl font-semibold mb-3">Información Personal</h2>
            {editMode ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input className="border rounded-lg px-3 py-2" placeholder="Correo electrónico" value={data.correo} onChange={onField("correo")} />
                <input className="border rounded-lg px-3 py-2" placeholder="Teléfono" value={data.telefono} onChange={onField("telefono")} />
                <input className="border rounded-lg px-3 py-2" placeholder="Ubicación (Ciudad, País)" value={data.ubicacion} onChange={onField("ubicacion")} />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Correo" value={data.correo} />
                <Field label="Teléfono" value={data.telefono} />
                <Field label="Ubicación" value={data.ubicacion} />
              </div>
            )}
          </section>

          {/* Redes sociales */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">Redes Sociales</h2>
            {editMode ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input className="border rounded-lg px-3 py-2" placeholder="Facebook URL" value={data.facebook} onChange={onField("facebook")} />
                <input className="border rounded-lg px-3 py-2" placeholder="Instagram URL" value={data.instagram} onChange={onField("instagram")} />
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 text-sm">
                <a href={data.facebook || "#"} className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200" target="_blank" rel="noreferrer">
                  Ver Facebook
                </a>
                <a href={data.instagram || "#"} className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200" target="_blank" rel="noreferrer">
                  Ver Instagram
                </a>
              </div>
            )}
          </section>

          {/* Info motocicleta */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">Mi Motocicleta</h2>
            {editMode ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input className="border rounded-lg px-3 py-2" placeholder="Marca" value={data.moto.marca} onChange={onMoto("marca")} />
                  <input className="border rounded-lg px-3 py-2" placeholder="Modelo" value={data.moto.modelo} onChange={onMoto("modelo")} />
                  <input className="border rounded-lg px-3 py-2" placeholder="Año" value={data.moto.anio} onChange={onMoto("anio")} />
                </div>

                {/* Mensaje importante + info adicional */}
                <div className="mt-6 rounded-lg border-2 border-yellow-300 bg-yellow-50 p-4 text-yellow-900">
                  <p className="font-bold">⚠️ Importante</p>
                  <p className="text-sm">
                    Esta información adicional se usará <strong>únicamente</strong> para la{" "}
                    <strong>búsqueda automática con IA</strong> de tus fotos entre cientos de miles. ¡Mejora la
                    precisión de la detección!
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input className="border rounded-lg px-3 py-2" placeholder="Color de la moto" value={data.moto_detalle.color_moto} onChange={onMotoDetalle("color_moto")} />
                  <input className="border rounded-lg px-3 py-2" placeholder="Marca del casco" value={data.moto_detalle.casco_marca} onChange={onMotoDetalle("casco_marca")} />
                  <input className="border rounded-lg px-3 py-2" placeholder="Color del casco" value={data.moto_detalle.casco_color} onChange={onMotoDetalle("casco_color")} />
                  <input className="border rounded-lg px-3 py-2" placeholder="Marca del monotraje/chumpa" value={data.moto_detalle.traje_marca} onChange={onMotoDetalle("traje_marca")} />
                  <input className="border rounded-lg px-3 py-2" placeholder="Color del monotraje/chumpa" value={data.moto_detalle.traje_color} onChange={onMotoDetalle("traje_color")} />
                  <input className="border rounded-lg px-3 py-2" placeholder="Marca de botas" value={data.moto_detalle.botas_marca} onChange={onMotoDetalle("botas_marca")} />
                  <input className="border rounded-lg px-3 py-2" placeholder="Color de botas" value={data.moto_detalle.botas_color} onChange={onMotoDetalle("botas_color")} />
                  <input className="border rounded-lg px-3 py-2" placeholder="Marca de guantes" value={data.moto_detalle.guantes_marca} onChange={onMotoDetalle("guantes_marca")} />
                  <input className="border rounded-lg px-3 py-2" placeholder="Color de guantes" value={data.moto_detalle.guantes_color} onChange={onMotoDetalle("guantes_color")} />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Marca" value={data.moto.marca} />
                  <Field label="Modelo" value={data.moto.modelo} />
                  <Field label="Año" value={data.moto.anio} />
                </div>
                {/* Separador */}
                <div className="my-6 h-px bg-slate-200" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Color de la moto" value={data.moto_detalle.color_moto} />
                  <Field label="Marca del casco" value={data.moto_detalle.casco_marca} />
                  <Field label="Color del casco" value={data.moto_detalle.casco_color} />
                  <Field label="Marca del monotraje/chumpa" value={data.moto_detalle.traje_marca} />
                  <Field label="Color del monotraje/chumpa" value={data.moto_detalle.traje_color} />
                  <Field label="Marca de botas" value={data.moto_detalle.botas_marca} />
                  <Field label="Color de botas" value={data.moto_detalle.botas_color} />
                  <Field label="Marca de guantes" value={data.moto_detalle.guantes_marca} />
                  <Field label="Color de guantes" value={data.moto_detalle.guantes_color} />
                </div>
              </>
            )}
          </section>

          {/* Galería */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">
                Mis Fotos ({data.galeria.length}/{MAX_GALERIA})
              </h2>
              {editMode && (
                <button
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white font-display text-sm disabled:opacity-50"
                  type="button"
                  onClick={() => fileRefGallery.current?.click()}
                  disabled={(data.galeria?.length || 0) >= MAX_GALERIA}
                >
                  Subir fotos
                </button>
              )}
              <input ref={fileRefGallery} type="file" accept="image/*" multiple className="hidden" onChange={onPickGallery} />
            </div>

            {data.galeria.length === 0 && <div className="text-slate-500">Aún no tenés fotos.</div>}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.galeria.map((it, i) => {
                const url = typeof it === "string" ? it : it?.url;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setLbIndex(i);
                      setLbOpen(true);
                    }}
                    className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Ver grande"
                  >
                    <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                    {editMode && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromGallery(i);
                        }}
                        className="absolute top-2 right-2 w-8 h-8 grid place-items-center rounded-full bg-black/60 text-white"
                        title="Eliminar"
                      >
                        ✕
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* Barra sticky de acciones (edición) */}
      {editMode && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-end gap-2">
            <button
              className="px-4 h-11 rounded-xl bg-blue-600 text-white font-display font-bold disabled:opacity-50"
              onClick={guardar}
              type="button"
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              className="px-4 h-11 rounded-xl bg-slate-200 text-slate-800 font-display font-bold"
              onClick={cancelar}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* LIGHTBOX (sin info adicional) */}
      {lbOpen && lbImages.length > 0 && (
        <PhotoLightbox
          images={lbImages}
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

function Field({ label, value }) {
  return (
    <div className="border rounded-lg px-3 py-2 bg-slate-50">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-slate-800">{value || "—"}</div>
    </div>
  );
}
