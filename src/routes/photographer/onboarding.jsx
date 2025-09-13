// src/routes/photographer/onboarding.jsx
import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

/* ====== Constantes visuales del Studio (matching de tu app) ====== */
// Reusa la misma lista base que usás en el Studio
const RUTAS = [
  "Ruta Interamericana",
  "RN-14",
  "Carretera al Salvador",
  "Carretera al Atlántico",
  "RN-10 (Cañas)",
];

/* ====== Helpers de Perfil (shape y estilos consistentes) ====== */
function templatePreciosBase3() {
  return [
    { nombre: "1 foto", precio: "" },
    { nombre: "2 fotos", precio: "" },
    { nombre: "3 fotos", precio: "" },
  ];
}
const makeId = () => "pl_" + Math.random().toString(36).slice(2, 9);
const isDomingoList = (nombre = "") => /domingo/i.test(nombre || "");
function newPriceList(nombre = "Fotos de Domingo") {
  return {
    id: makeId(),
    nombre,
    visible_publico: true,
    lock_public: isDomingoList(nombre),
    notas: "",
    items: templatePreciosBase3(),
  };
}

// Igual a tu PhotographerProfile: en UI usamos `cuentas` top-level
// y al guardar lo mapeamos a `pagos.cuentas`.  :contentReference[oaicite:3]{index=3}
function isProfileComplete(p) {
  if (!p) return false;
  const telOk = !!(p.telefono && p.telefono.trim().length >= 8);
  const userOk = !!(p.username && p.username.trim().length >= 3);
  // aquí esperamos `cuentas` top-level en el state de esta pantalla
  const cuentasOk = Array.isArray(p.cuentas) && p.cuentas.length >= 1;
  const puntosOk = Array.isArray(p.puntos) && p.puntos.length >= 1;
  const pl = Array.isArray(p.price_lists) ? p.price_lists : [];
  const preciosOk =
    pl.length >= 1 &&
    pl.some(
      (plx) =>
        Array.isArray(plx.items) &&
        plx.items.length >= 3 &&
        plx.items.every((it) => String(it.precio || "").trim() !== "")
    );
  return telOk && userOk && cuentasOk && puntosOk && preciosOk;
}

/* ===== Header flotante como en Perfil (para alinear bajo tu header) ===== */
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

/* =========================== Página =========================== */
export default function Onboarding() {
  const nav = useNavigate();
  const headerOffset = useFloatingHeaderOffset();
  const [stickyH, setStickyH] = React.useState(96);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [user, setUser] = React.useState(null);

  const [data, setData] = React.useState({
    username: "",
    estudio: "",
    telefono: "",
    correo: "",
    website: "",
    facebook: "",
    instagram: "",
    // UI local:
    cuentas: [],           // ← top-level (se guarda como pagos.cuentas)
    puntos: [],
    price_lists: [newPriceList("Fotos de Domingo")],
    portafolio: [],
    avatar_url: "",
  });

  const [step, setStep] = React.useState(0);
  const STEPS = ["Contacto", "Identidad", "Precios", "Puntos", "Pagos", "Final"];

  const stickyRef = React.useRef(null);
  React.useEffect(() => {
    const measure = () => setStickyH(stickyRef.current?.offsetHeight || 96);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const { data: sess } = await supabase.auth.getSession();
        const u = sess?.session?.user;
        if (!u) return nav("/login-fotografo", { replace: true });
        if (!alive) return;
        setUser(u);

        const prof = await fetchOrCreatePhotographer(u);
        if (!alive) return;

        // Mapear shape del perfil a nuestro state visual
        const cuentas = Array.isArray(prof?.pagos?.cuentas) ? prof.pagos.cuentas : [];
        const price_lists =
          Array.isArray(prof?.price_lists) && prof.price_lists.length
            ? prof.price_lists
            : [newPriceList("Fotos de Domingo")];

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
          portafolio: Array.isArray(prof?.portafolio) ? prof.portafolio : [],
          price_lists: price_lists.map((pl) => ({
            ...pl,
            visible_publico: isDomingoList(pl.nombre) ? true : !!pl.visible_publico,
            lock_public: isDomingoList(pl.nombre),
            items: Array.isArray(pl.items) && pl.items.length ? pl.items : templatePreciosBase3(),
          })),
          cuentas,
          puntos: Array.isArray(prof?.puntos) ? prof.puntos : [],
        }));

        if (isProfileComplete({ ...prof, cuentas })) {
          nav("/studio", { replace: true });
          return;
        }
      } catch (e) {
        setMsg(e.message || "No se pudo cargar tu información.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [nav]);

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
        price_lists: [newPriceList("Fotos de Domingo")],
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

  async function savePartial(overrides = {}) {
    if (!user) return;
    setSaving(true); setMsg("");
    try {
      const next = { ...data, ...overrides };

      const hardenedLists = (next.price_lists || []).map((pl) => ({
        ...pl,
        visible_publico: isDomingoList(pl.nombre) ? true : !!pl.visible_publico,
        lock_public: isDomingoList(pl.nombre),
        items: Array.isArray(pl.items) && pl.items.length ? pl.items : templatePreciosBase3(),
      }));

      const payload = {
        username: next.username?.trim() || null,
        estudio: next.estudio?.trim() || null,
        telefono: next.telefono?.trim() || null,
        correo: next.correo?.trim() || null,
        website: next.website?.trim() || null,
        facebook: next.facebook?.trim() || null,
        instagram: next.instagram?.trim() || null,
        avatar_url: next.avatar_url || null,
        portafolio: Array.isArray(next.portafolio) ? next.portafolio : [],
        precios: [], // legacy lo mantenés en Perfil; aquí usamos price_lists
        price_lists: hardenedLists,
        pagos: { cuentas: Array.isArray(next.cuentas) ? next.cuentas : [] },
        puntos: Array.isArray(next.puntos) ? next.puntos : [],
      };

      const { error } = await supabase
        .from("photographer_profile")
        .update(payload)
        .eq("user_id", user.id);
      if (error) throw error;

      setData(next);
    } catch (e) {
      setMsg(e.message || "No se pudo guardar.");
      throw e;
    } finally {
      setSaving(false);
    }
  }

  async function nextStep() {
    try {
      await savePartial();
      if (step < STEPS.length - 1) setStep(step + 1);
    } catch {}
  }
  async function prevStep() {
    setStep((s) => Math.max(0, s - 1));
  }
  async function finish() {
    try {
      await savePartial();
      if (!isProfileComplete(data)) {
        setMsg("Aún faltan campos obligatorios. Revisá los pasos marcados.");
        return;
      }
      nav("/studio", { replace: true });
    } catch {}
  }

  /* =========================== UI =========================== */

  // barra sticky con título + progreso (matching Studio)  :contentReference[oaicite:4]{index=4}
  const Progress = (
    <div ref={stickyRef} className="fixed left-0 right-0 z-40" style={{ top: headerOffset + 8 }}>
      <div className="max-w-6xl mx-auto px-5">
        <div className="rounded-2xl bg-studio-panel border border-white/10 px-4 py-3 flex items-center gap-3 shadow">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-display font-black truncate">Onboarding del Studio</h1>
            <p className="text-white/70 text-xs sm:text-sm truncate">
              Completá estos pasos para activar tu perfil de Fotógrafo.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={
                  "px-2 py-1 rounded-lg border text-xs " +
                  (i === step
                    ? "bg-blue-600 text-white border-white/10"
                    : "bg-white/5 text-white/80 border-white/15")
                }
                title={s}
              >
                {i + 1}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // loading
  if (loading) {
    return (
      <main className="min-h-[60vh] grid place-items-center text-slate-100">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">Preparando tu Studio…</div>
      </main>
    );
  }

  return (
    <main
      className="max-w-6xl mx-auto px-5 pb-10 text-slate-100"
      style={{ paddingTop: headerOffset + stickyH + 12 }}
    >
      {/* BG detrás del header y sub-encabezado como en Perfil */}
      <div
        className="fixed left-0 right-0 z-30 bg-studio-panel border-b border-white/10"
        style={{ top: 0, height: headerOffset + stickyH + 12 }}
        aria-hidden
      />

      {Progress}

      {msg && (
        <div className="mt-3 max-w-3xl">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 px-4 py-3 text-sm">
            {msg}
          </div>
        </div>
      )}

      {/* ===== Paso 0: Contacto ===== */}
      {step === 0 && (
        <SectionCard title="Contacto" subtitle="Tu número y correo para coordinar entregas y pagos.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Teléfono *">
              <input
                className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3 placeholder-white/60"
                value={data.telefono}
                onChange={(e) => setData((d) => ({ ...d, telefono: e.target.value }))}
                placeholder="Ej. 5555-5555"
              />
            </Field>
            <Field label="Correo">
              <input
                className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3 placeholder-white/60"
                value={data.correo}
                onChange={(e) => setData((d) => ({ ...d, correo: e.target.value }))}
                placeholder="tu@correo.com"
              />
            </Field>
          </div>
          <NavRow onNext={nextStep} nextLabel="Continuar" busy={saving} />
        </SectionCard>
      )}

      {/* ===== Paso 1: Identidad ===== */}
      {step === 1 && (
        <SectionCard title="Identidad" subtitle="Definí tu usuario y el nombre de tu estudio.">
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Usuario * (mín. 3)">
              <input
                className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3 placeholder-white/60"
                value={data.username}
                onChange={(e) => setData((d) => ({ ...d, username: e.target.value }))}
                placeholder="@usuario"
              />
            </Field>
            <Field label="Nombre de Estudio">
              <input
                className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3 placeholder-white/60"
                value={data.estudio}
                onChange={(e) => setData((d) => ({ ...d, estudio: e.target.value }))}
                placeholder="Mi Estudio"
              />
            </Field>
          </div>
          <div className="grid md:grid-cols-3 gap-3 mt-3">
            <Field label="Instagram">
              <input
                className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3 placeholder-white/60"
                value={data.instagram}
                onChange={(e) => setData((d) => ({ ...d, instagram: e.target.value }))}
                placeholder="https://instagram.com/..."
              />
            </Field>
            <Field label="Facebook">
              <input
                className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3 placeholder-white/60"
                value={data.facebook}
                onChange={(e) => setData((d) => ({ ...d, facebook: e.target.value }))}
                placeholder="https://facebook.com/..."
              />
            </Field>
            <Field label="Website">
              <input
                className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3 placeholder-white/60"
                value={data.website}
                onChange={(e) => setData((d) => ({ ...d, website: e.target.value }))}
                placeholder="https://..."
              />
            </Field>
          </div>
          <NavRow onPrev={prevStep} onNext={nextStep} busy={saving} />
        </SectionCard>
      )}

      {/* ===== Paso 2: Precios ===== */}
      {step === 2 && (
        <SectionCard title="Listas de precios" subtitle="Definí al menos una lista (Domingo recomendado) con 3 tramos llenos.">
          {data.price_lists.map((pl, i) => (
            <div key={pl.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4">
              <div className="flex items-center gap-2">
                <input
                  className="h-10 px-3 rounded-lg border border-white/15 bg-white/5 text-white flex-1 placeholder-white/60"
                  value={pl.nombre}
                  onChange={(e) => {
                    const nombre = e.target.value;
                    setData((d) => {
                      const arr = [...d.price_lists];
                      arr[i] = {
                        ...arr[i],
                        nombre,
                        lock_public: isDomingoList(nombre),
                        visible_publico: isDomingoList(nombre) ? true : !!arr[i].visible_publico,
                      };
                      return { ...d, price_lists: arr };
                    });
                  }}
                  placeholder="Nombre de la lista (ej. Fotos de Domingo)"
                />
                <label className="text-xs text-white/70 inline-flex items-center gap-2 ml-2">
                  <input
                    type="checkbox"
                    disabled={pl.lock_public}
                    checked={!!pl.visible_publico}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setData((d) => {
                        const arr = [...d.price_lists];
                        arr[i] = { ...arr[i], visible_publico: pl.lock_public ? true : !!val };
                        return { ...d, price_lists: arr };
                      });
                    }}
                  />
                  Visible {pl.lock_public && <span className="opacity-70">(forzado por Domingo)</span>}
                </label>
              </div>

              <div className="grid md:grid-cols-3 gap-3 mt-3">
                {pl.items.map((it, idx) => (
                  <Field key={idx} label={it.nombre}>
                    <input
                      className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3 placeholder-white/60"
                      value={it.precio}
                      onChange={(e) => {
                        const v = e.target.value;
                        setData((d) => {
                          const lists = [...d.price_lists];
                          const items = [...lists[i].items];
                          items[idx] = { ...items[idx], precio: v };
                          lists[i] = { ...lists[i], items };
                          return { ...d, price_lists: lists };
                        });
                      }}
                      placeholder="Q..."
                    />
                  </Field>
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button
              className="h-10 px-3 rounded-lg bg-white/10 text-white border border-white/15"
              onClick={() =>
                setData((d) => ({ ...d, price_lists: [...d.price_lists, newPriceList("Nuevo tipo de evento")] }))
              }
              type="button"
            >
              Agregar lista
            </button>
            <NavRow onPrev={prevStep} onNext={nextStep} busy={saving} />
          </div>
        </SectionCard>
      )}

      {/* ===== Paso 3: Puntos ===== */}
      {step === 3 && (
        <SectionCard title="Puntos de cobertura" subtitle="Agregá al menos un punto con ruta y horario.">
          <div className="flex justify-between items-center">
            <div className="text-sm text-white/70">Tus ubicaciones para tomar fotos.</div>
            <button
              className="h-9 px-3 rounded-lg bg-blue-600 text-white font-display font-bold"
              onClick={() => {
                const nuevo = {
                  id: "pt" + Math.random().toString(36).slice(2, 7),
                  nombre: "Nuevo Punto",
                  ruta: RUTAS[0],
                  lat: 14.62, lon: -90.52,
                  horarios: [{ dia: "Domingo", inicio: "06:00", fin: "08:00" }],
                };
                setData((d) => ({ ...d, puntos: [...(d.puntos || []), nuevo] }));
              }}
              type="button"
            >
              Agregar punto
            </button>
          </div>

          <div className="mt-3 grid gap-3">
            {(data.puntos || []).map((p, idx) => (
              <div key={p.id} className="rounded-xl border border-white/10 p-4 bg-white/5 relative">
                <button
                  className="absolute top-2 right-2 w-7 h-7 grid place-items-center rounded-full bg-red-600 text-white"
                  onClick={() =>
                    setData((d) => ({ ...d, puntos: d.puntos.filter((x) => x.id !== p.id) }))
                  }
                  type="button"
                  title="Eliminar"
                >
                  ✕
                </button>

                <div className="grid md:grid-cols-[1fr_1fr_.8fr_.8fr] gap-2">
                  <input
                    className="h-10 px-3 rounded-lg border border-white/15 bg-white/5 text-white"
                    value={p.nombre}
                    onChange={(e) => {
                      const v = e.target.value;
                      setData((d) => ({
                        ...d,
                        puntos: d.puntos.map((x) => (x.id === p.id ? { ...x, nombre: v } : x)),
                      }));
                    }}
                    placeholder="Nombre del punto"
                  />
                  <select
                    className="h-10 px-3 rounded-lg border border-white/15 bg-white/5 text-white"
                    value={p.ruta}
                    onChange={(e) => {
                      const v = e.target.value;
                      setData((d) => ({
                        ...d,
                        puntos: d.puntos.map((x) => (x.id === p.id ? { ...x, ruta: v } : x)),
                      }));
                    }}
                  >
                    {RUTAS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <input
                    className="h-10 px-3 rounded-lg border border-white/15 bg-white/5 text-white"
                    value={p.lat}
                    onChange={(e) => {
                      const v = e.target.value;
                      setData((d) => ({
                        ...d,
                        puntos: d.puntos.map((x) => (x.id === p.id ? { ...x, lat: Number(v) } : x)),
                      }));
                    }}
                    placeholder="Lat"
                  />
                  <input
                    className="h-10 px-3 rounded-lg border border-white/15 bg-white/5 text-white"
                    value={p.lon}
                    onChange={(e) => {
                      const v = e.target.value;
                      setData((d) => ({
                        ...d,
                        puntos: d.puntos.map((x) => (x.id === p.id ? { ...x, lon: Number(v) } : x)),
                      }));
                    }}
                    placeholder="Lon"
                  />
                </div>

                <div className="grid md:grid-cols-[1fr_1fr] gap-2 mt-2">
                  <input
                    className="h-10 px-3 rounded-lg border border-white/15 bg-white/5 text-white"
                    value={p.horarios?.[0]?.inicio || "06:00"}
                    onChange={(e) => {
                      const v = e.target.value;
                      setData((d) => ({
                        ...d,
                        puntos: d.puntos.map((x) =>
                          x.id === p.id
                            ? {
                                ...x,
                                horarios: [
                                  { ...x.horarios?.[0], inicio: v, fin: x.horarios?.[0]?.fin || "08:00", dia: x.horarios?.[0]?.dia || "Domingo" },
                                ],
                              }
                            : x
                        ),
                      }));
                    }}
                    placeholder="Inicio (HH:MM)"
                  />
                  <input
                    className="h-10 px-3 rounded-lg border border-white/15 bg-white/5 text-white"
                    value={p.horarios?.[0]?.fin || "08:00"}
                    onChange={(e) => {
                      const v = e.target.value;
                      setData((d) => ({
                        ...d,
                        puntos: d.puntos.map((x) =>
                          x.id === p.id
                            ? {
                                ...x,
                                horarios: [
                                  { ...x.horarios?.[0], fin: v, inicio: x.horarios?.[0]?.inicio || "06:00", dia: x.horarios?.[0]?.dia || "Domingo" },
                                ],
                              }
                            : x
                        ),
                      }));
                    }}
                    placeholder="Fin (HH:MM)"
                  />
                </div>
              </div>
            ))}
          </div>

          <NavRow onPrev={prevStep} onNext={nextStep} busy={saving} />
        </SectionCard>
      )}

      {/* ===== Paso 4: Pagos ===== */}
      {step === 4 && (
        <SectionCard title="Cobros" subtitle="Agregá al menos una cuenta para recibir tus pagos.">
          <div className="flex justify-end">
            <button
              className="h-9 px-3 rounded-lg bg-white/10 text-white border border-white/15"
              onClick={() =>
                setData((d) => ({
                  ...d,
                  cuentas: [...(d.cuentas || []), { banco: "", tipo: "Cuenta Monetaria", numero: "" }],
                }))
              }
              type="button"
            >
              Agregar cuenta
            </button>
          </div>

          <div className="mt-3 grid gap-3">
            {(data.cuentas || []).map((c, idx) => (
              <div key={idx} className="rounded-xl border border-white/10 p-3 bg-white/5 grid md:grid-cols-3 gap-2">
                <input
                  className="h-10 px-3 rounded-lg border border-white/15 bg-white/5 text-white"
                  value={c.banco}
                  onChange={(e) =>
                    setData((d) => {
                      const arr = [...(d.cuentas || [])];
                      arr[idx] = { ...arr[idx], banco: e.target.value };
                      return { ...d, cuentas: arr };
                    })
                  }
                  placeholder="Banco / Emisor"
                />
                <input
                  className="h-10 px-3 rounded-lg border border-white/15 bg-white/5 text-white"
                  value={c.tipo}
                  onChange={(e) =>
                    setData((d) => {
                      const arr = [...(d.cuentas || [])];
                      arr[idx] = { ...arr[idx], tipo: e.target.value };
                      return { ...d, cuentas: arr };
                    })
                  }
                  placeholder="Tipo (Monetaria / Ahorro / etc.)"
                />
                <input
                  className="h-10 px-3 rounded-lg border border-white/15 bg-white/5 text-white"
                  value={c.numero}
                  onChange={(e) =>
                    setData((d) => {
                      const arr = [...(d.cuentas || [])];
                      arr[idx] = { ...arr[idx], numero: e.target.value };
                      return { ...d, cuentas: arr };
                    })
                  }
                  placeholder="Número / Alias"
                />
              </div>
            ))}
          </div>

          <NavRow onPrev={prevStep} onNext={nextStep} busy={saving} />
        </SectionCard>
      )}

      {/* ===== Paso 5: Final ===== */}
      {step === 5 && (
        <SectionCard title="Todo listo" subtitle="Revisá que no te falte nada.">
          <ul className="text-sm text-slate-300 space-y-1">
            <li>Teléfono: {data.telefono || "—"}</li>
            <li>Usuario: {data.username || "—"}</li>
            <li>Listas de precios: {data.price_lists?.length || 0}</li>
            <li>Puntos: {data.puntos?.length || 0}</li>
            <li>Cuentas: {data.cuentas?.length || 0}</li>
          </ul>
          {!isProfileComplete(data) && (
            <div className="mt-3 text-amber-200 text-sm">
              Te faltan campos obligatorios. Completalos para terminar.
            </div>
          )}
          <div className="mt-4 flex justify-between">
            <button
              className="px-4 h-11 rounded-xl bg-white/10 text-white border border-white/15"
              onClick={() => setStep(0)}
            >
              Editar desde el inicio
            </button>
            <button
              className="px-4 h-11 rounded-xl bg-blue-600 text-white font-display font-bold disabled:opacity-50"
              onClick={finish}
              disabled={!isProfileComplete(data) || saving}
            >
              {saving ? "Guardando..." : "Terminar y entrar al Studio"}
            </button>
          </div>
        </SectionCard>
      )}

      {/* footer peque */}
      <div className="mt-6 text-xs text-white/50">
        <Link to="/studio/perfil" className="underline underline-offset-2">Ver mi perfil</Link>
      </div>
    </main>
  );
}

/* ======================= Subcomponentes UI ======================= */

function SectionCard({ title, subtitle, children }) {
  return (
    <section className="mt-2">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-white/70">{subtitle}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}
function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-xs text-white/70 mb-1">{label}</div>
      {children}
    </label>
  );
}
function NavRow({ onPrev, onNext, nextLabel = "Continuar", busy }) {
  return (
    <div className="mt-4 flex items-center justify-between">
      <div>
        {onPrev ? (
          <button className="h-10 px-4 rounded-xl bg-white/10 text-white border border-white/15" onClick={onPrev}>
            Atrás
          </button>
        ) : <span />}
      </div>
      <button
        className="h-10 px-4 rounded-xl bg-blue-600 text-white font-display font-bold disabled:opacity-50"
        onClick={onNext}
        disabled={busy}
      >
        {busy ? "Guardando..." : nextLabel}
      </button>
    </div>
  );
}
