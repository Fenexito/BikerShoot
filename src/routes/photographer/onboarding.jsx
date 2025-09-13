// src/routes/photographer/onboarding.jsx
import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

/** ====== Helpers (compatibles con tu PhotographerProfile.jsx) ====== */
// Rutas maestras simples (mismo catálogo base que usás en el perfil)  :contentReference[oaicite:2]{index=2}
const RUTAS = [
  "Ruta Interamericana",
  "RN-14",
  "Carretera al Salvador",
  "Carretera al Atlántico",
  "RN-10 (Cañas)",
];

// Plantilla de tramos de precios (1,2,3 fotos)  :contentReference[oaicite:3]{index=3}
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

function getRoles(user) {
  const md = user?.user_metadata || {};
  if (Array.isArray(md.roles)) return md.roles;
  return md.role ? [md.role] : [];
}

/** Perfil completo: teléfono, username >=3, al menos 1 cuenta de pago,
 *  al menos 1 punto de cobertura, al menos 1 lista de precios con valores.
 *  (Mismo shape que usás en PhotographerProfile)  :contentReference[oaicite:4]{index=4}
 */
function isProfileComplete(p) {
  if (!p) return false;
  const telOk = !!(p.telefono && p.telefono.trim().length >= 8);
  const userOk = !!(p.username && p.username.trim().length >= 3);
  const pagosOk = Array.isArray(p?.pagos?.cuentas) && p.pagos.cuentas.length >= 1;
  const puntosOk = Array.isArray(p?.puntos) && p.puntos.length >= 1;
  const pl = Array.isArray(p?.price_lists) ? p.price_lists : [];
  const preciosOk = pl.length >= 1 && pl.some(plx =>
    Array.isArray(plx.items) && plx.items.length >= 3 && plx.items.every(it => String(it.precio || "").trim() !== "")
  );
  return telOk && userOk && pagosOk && puntosOk && preciosOk;
}

export default function Onboarding() {
  const nav = useNavigate();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [user, setUser] = React.useState(null);

  // State del perfil (mismo shape que PhotographerProfile.jsx)  :contentReference[oaicite:5]{index=5}
  const [data, setData] = React.useState({
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
    price_lists: [newPriceList("Fotos de Domingo")],
    pagos: { cuentas: [] },
    puntos: [],
  });

  // Paso actual
  const [step, setStep] = React.useState(0);
  const STEPS = ["Contacto", "Identidad", "Precios", "Puntos", "Pagos", "Final"];

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const { data: sess } = await supabase.auth.getSession();
        const u = sess?.session?.user;
        if (!u) return nav("/login-fotografo", { replace: true });

        // Solo fotógrafos hacen onboarding del Studio
        const roles = getRoles(u);
        if (!roles.includes("fotografo")) {
          return nav("/login-fotografo", { replace: true });
        }
        if (!alive) return;

        setUser(u);

        // Traer perfil si ya existe, o sembrar uno mínimo  :contentReference[oaicite:6]{index=6}
        const prof = await fetchOrCreatePhotographer(u);
        if (!alive) return;

        // Prellenar
        const cuentas = Array.isArray(prof?.pagos?.cuentas) ? prof.pagos.cuentas : [];
        const price_lists = Array.isArray(prof?.price_lists) && prof.price_lists.length
          ? prof.price_lists
          : [newPriceList("Fotos de Domingo")];

        setData({
          username: prof?.username || "",
          estudio: prof?.estudio || (u.user_metadata?.display_name || ""),
          telefono: prof?.telefono || "",
          correo: prof?.correo || u.email || "",
          website: prof?.website || "",
          facebook: prof?.facebook || "",
          instagram: prof?.instagram || "",
          avatar_url: prof?.avatar_url || "",
          portafolio: Array.isArray(prof?.portafolio) ? prof.portafolio : [],
          precios: Array.isArray(prof?.precios) && prof.precios.length ? prof.precios : templatePreciosBase3(),
          price_lists,
          pagos: { cuentas },
          puntos: Array.isArray(prof?.puntos) ? prof.puntos : [],
        });

        // Si ya está completo, mandarlo al Studio
        if (isProfileComplete(prof)) {
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

      // endurecer lista Domingo visible y con 3 tramos como en el perfil  :contentReference[oaicite:7]{index=7}
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
        precios: Array.isArray(next.precios) ? next.precios : [],
        price_lists: hardenedLists,
        pagos: { cuentas: Array.isArray(next.pagos?.cuentas) ? next.pagos.cuentas : [] },
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
      // Guardar antes de avanzar
      await savePartial();
      if (step < STEPS.length - 1) setStep(step + 1);
    } catch { /* msg ya seteado */ }
  }

  async function finish() {
    try {
      await savePartial();
      if (!isProfileComplete(data)) {
        setMsg("Aún faltan campos obligatorios. Revisá los pasos.");
        return;
      }
      nav("/studio", { replace: true });
    } catch {}
  }

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center bg-black text-slate-100">
        <div className="max-w-md w-full p-6 rounded-2xl border border-white/10 bg-neutral-900">
          <h1 className="text-xl font-bold">Preparando tu Studio…</h1>
          {msg && <p className="text-slate-300 mt-2">{msg}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-slate-100">
      <div className="max-w-3xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black font-display">Onboarding Fotógrafo</h1>
          <Link to="/studio" className="text-sm underline underline-offset-2 text-white/70">Salir</Link>
        </div>
        <p className="text-slate-300 mt-1">Completá estos pasos para activar tu Studio.</p>

        <ol className="flex flex-wrap gap-2 text-xs mt-4">
          {STEPS.map((s, i) => (
            <li key={s}
                className={`px-2 py-1 rounded ${i === step ? "bg-blue-600 text-white" : "bg-white/10 text-white/80"}`}>
              {i + 1}. {s}
            </li>
          ))}
        </ol>

        {msg && <div className="mt-3 text-sm text-yellow-300">{msg}</div>}

        {/* PASO 0: Contacto */}
        {step === 0 && (
          <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Teléfono *">
                <input className="w-full h-11 rounded-lg border border-white/15 bg-white/5 text-white px-3"
                       value={data.telefono} onChange={e=>setData(d=>({...d, telefono: e.target.value}))}
                       placeholder="Ej. 5555-5555" />
              </Field>
              <Field label="Correo">
                <input className="w-full h-11 rounded-lg border border-white/15 bg-white/5 text-white px-3"
                       value={data.correo} onChange={e=>setData(d=>({...d, correo: e.target.value}))}
                       placeholder="tu@correo.com" />
              </Field>
            </div>
            <div className="mt-4 flex justify-end">
              <Btn onClick={nextStep} busy={saving}>Continuar</Btn>
            </div>
          </section>
        )}

        {/* PASO 1: Identidad */}
        {step === 1 && (
          <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Usuario * (mín. 3)">
                <input className="w-full h-11 rounded-lg border border-white/15 bg-white/5 text-white px-3"
                       value={data.username} onChange={e=>setData(d=>({...d, username: e.target.value}))}
                       placeholder="tuusuario" />
              </Field>
              <Field label="Nombre de Estudio">
                <input className="w-full h-11 rounded-lg border border-white/15 bg-white/5 text-white px-3"
                       value={data.estudio} onChange={e=>setData(d=>({...d, estudio: e.target.value}))}
                       placeholder="Mi Estudio" />
              </Field>
            </div>
            <div className="grid md:grid-cols-3 gap-3 mt-3">
              <Field label="Instagram">
                <input className="w-full h-11 rounded-lg border border-white/15 bg-white/5 text-white px-3"
                       value={data.instagram} onChange={e=>setData(d=>({...d, instagram: e.target.value}))}
                       placeholder="https://instagram.com/..." />
              </Field>
              <Field label="Facebook">
                <input className="w-full h-11 rounded-lg border border-white/15 bg-white/5 text-white px-3"
                       value={data.facebook} onChange={e=>setData(d=>({...d, facebook: e.target.value}))}
                       placeholder="https://facebook.com/..." />
              </Field>
              <Field label="Website">
                <input className="w-full h-11 rounded-lg border border-white/15 bg-white/5 text-white px-3"
                       value={data.website} onChange={e=>setData(d=>({...d, website: e.target.value}))}
                       placeholder="https://..." />
              </Field>
            </div>
            <div className="mt-4 flex justify-end">
              <Btn onClick={nextStep} busy={saving}>Continuar</Btn>
            </div>
          </section>
        )}

        {/* PASO 2: Precios (lista Domingo obligatoria con 3 tramos) */}
        {step === 2 && (
          <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            {data.price_lists.map((pl, i) => (
              <div key={pl.id} className="mb-5">
                <div className="flex items-center gap-2">
                  <input className="h-10 px-3 rounded-lg border border-white/15 bg-white/5 text-white"
                         value={pl.nombre}
                         onChange={e=>{
                           const nombre = e.target.value;
                           setData(d=>{
                             const arr = [...d.price_lists];
                             arr[i] = {...arr[i], nombre,
                               lock_public: isDomingoList(nombre),
                               visible_publico: isDomingoList(nombre) ? true : !!arr[i].visible_publico
                             };
                             return {...d, price_lists: arr};
                           });
                         }}
                         placeholder="Nombre de la lista (ej. Fotos de Domingo)"/>
                  <label className="text-xs text-white/70 inline-flex items-center gap-2 ml-2">
                    <input type="checkbox" disabled={pl.lock_public} checked={!!pl.visible_publico}
                           onChange={e=>{
                             const val = e.target.checked;
                             setData(d=>{
                               const arr = [...d.price_lists];
                               arr[i] = {...arr[i], visible_publico: pl.lock_public ? true : !!val};
                               return {...d, price_lists: arr};
                             });
                           }}/>
                    Visible al público {pl.lock_public && <span className="opacity-70">(forzado)</span>}
                  </label>
                </div>

                <div className="grid md:grid-cols-3 gap-3 mt-3">
                  {pl.items.map((it, idx) => (
                    <Field key={idx} label={it.nombre}>
                      <input className="w-full h-11 rounded-lg border border-white/15 bg-white/5 text-white px-3"
                             value={it.precio}
                             onChange={e=>{
                               const v = e.target.value;
                               setData(d=>{
                                 const lists = [...d.price_lists];
                                 const items = [...lists[i].items];
                                 items[idx] = {...items[idx], precio: v};
                                 lists[i] = {...lists[i], items};
                                 return {...d, price_lists: lists};
                               });
                             }}
                             placeholder="Q..." />
                    </Field>
                  ))}
                </div>
              </div>
            ))}
            <div className="mt-4 flex justify-end">
              <Btn onClick={nextStep} busy={saving}>Continuar</Btn>
            </div>
          </section>
        )}

        {/* PASO 3: Puntos (al menos 1) */}
        {step === 3 && (
          <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold font-display">Cobertura</h3>
              <button className="px-3 h-9 rounded-lg bg-white/10 border border-white/15"
                      onClick={()=>{
                        const nuevo = {
                          id: "pt" + Math.random().toString(36).slice(2,7),
                          nombre: "Nuevo Punto",
                          ruta: RUTAS[0],
                          lat: 14.62, lon: -90.52,
                          horarios: [{ dia: "Domingo", inicio: "06:00", fin: "08:00" }],
                        };
                        setData(d=>({...d, puntos: [...(d.puntos||[]), nuevo]}));
                      }}>
                Agregar punto
              </button>
            </div>

            <div className="mt-3 grid gap-3">
              {(data.puntos || []).map((p, idx) => (
                <div key={p.id} className="rounded-lg border border-white/10 p-3 bg-white/5">
                  <div className="grid md:grid-cols-[1fr_1fr_.8fr_.8fr] gap-2">
                    <input className="h-10 px-3 rounded-lg border border-white/15 bg-white/5 text-white"
                           value={p.nombre} onChange={e=>{
                             const v = e.target.value;
                             setData(d=>({ ...d, puntos: d.puntos.map(x=>x.id===p.id?{...x, nombre:v}:x) }));
                           }} placeholder="Nombre del punto" />
                    <select className="h-10 px-3 rounded-lg border border-white/15 bg-white/5 text-white"
                            value={p.ruta} onChange={e=>{
                              const v = e.target.value;
                              setData(d=>({ ...d, puntos: d.puntos.map(x=>x.id===p.id?{...x, ruta:v}:x) }));
                            }}>
                      {RUTAS.map(r=><option key={r} value={r}>{r}</option>)}
                    </select>
                    <input className="h-10 px-3 rounded-lg border border-white/15 bg-white/5 text-white"
                           value={p.lat} onChange={e=>{
                             const v = e.target.value;
                             setData(d=>({ ...d, puntos: d.puntos.map(x=>x.id===p.id?{...x, lat:Number(v)}:x) }));
                           }} placeholder="Lat" />
                    <input className="h-10 px-3 rounded-lg border border-white/15 bg-white/5 text-white"
                           value={p.lon} onChange={e=>{
                             const v = e.target.value;
                             setData(d=>({ ...d, puntos: d.puntos.map(x=>x.id===p.id?{...x, lon:Number(v)}:x) }));
                           }} placeholder="Lon" />
                  </div>
                  <div className="grid md:grid-cols-[1fr_1fr] gap-2 mt-2">
                    <input className="h-10 px-3 rounded-lg border border-white/15 bg-white/5 text-white"
                           value={p.horarios?.[0]?.inicio || "06:00"}
                           onChange={e=>{
                             const v = e.target.value;
                             setData(d=>({ ...d, puntos: d.puntos.map(x=>x.id===p.id?{...x, horarios:[{...x.horarios?.[0], inicio:v, fin:x.horarios?.[0]?.fin||"08:00", dia:x.horarios?.[0]?.dia||"Domingo"}]}:x) }));
                           }} placeholder="Inicio (HH:MM)" />
                    <input className="h-10 px-3 rounded-lg border border-white/15 bg-white/5 text-white"
                           value={p.horarios?.[0]?.fin || "08:00"}
                           onChange={e=>{
                             const v = e.target.value;
                             setData(d=>({ ...d, puntos: d.puntos.map(x=>x.id===p.id?{...x, horarios:[{...x.horarios?.[0], fin:v, inicio:x.horarios?.[0]?.inicio||"06:00", dia:x.horarios?.[0]?.dia||"Domingo"}]}:x) }));
                           }} placeholder="Fin (HH:MM)" />
                  </div>
                  <div className="mt-2 text-right">
                    <button className="h-9 px-3 rounded-lg border border-white/15" onClick={()=>{
                      setData(d=>({ ...d, puntos: d.puntos.filter(x=>x.id!==p.id) }));
                    }}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <Btn onClick={nextStep} busy={saving}>Continuar</Btn>
            </div>
          </section>
        )}

        {/* PASO 4: Pagos (al menos 1 cuenta) */}
        {step === 4 && (
          <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold font-display">Cuentas de cobro</h3>
              <button className="px-3 h-9 rounded-lg bg-white/10 border border-white/15"
                      onClick={()=>{
                        const nueva = { banco: "", tipo: "Cuenta Monetaria", numero: "" };
                        setData(d=>({...d, pagos: { cuentas: [...(d.pagos?.cuentas||[]), nueva] }}));
                      }}>
                Agregar cuenta
              </button>
            </div>

            <div className="mt-3 grid gap-3">
              {(data.pagos?.cuentas || []).map((c, idx) => (
                <div key={idx} className="rounded-lg border border-white/10 p-3 bg-white/5 grid md:grid-cols-3 gap-2">
                  <input className="h-10 px-3 rounded-lg border border-white/15 bg-white/5 text-white"
                         value={c.banco} onChange={e=>{
                           const v=e.target.value;
                           setData(d=>{
                             const arr=[...(d.pagos?.cuentas||[])];
                             arr[idx]={...arr[idx], banco:v}; return {...d, pagos:{cuentas:arr}};
                           });
                         }} placeholder="Banco / Emisor" />
                  <input className="h-10 px-3 rounded-lg border border-white/15 bg-white/5 text-white"
                         value={c.tipo} onChange={e=>{
                           const v=e.target.value;
                           setData(d=>{
                             const arr=[...(d.pagos?.cuentas||[])];
                             arr[idx]={...arr[idx], tipo:v}; return {...d, pagos:{cuentas:arr}};
                           });
                         }} placeholder="Tipo (Monetaria / Ahorro / Yape / etc.)" />
                  <input className="h-10 px-3 rounded-lg border border-white/15 bg-white/5 text-white"
                         value={c.numero} onChange={e=>{
                           const v=e.target.value;
                           setData(d=>{
                             const arr=[...(d.pagos?.cuentas||[])];
                             arr[idx]={...arr[idx], numero:v}; return {...d, pagos:{cuentas:arr}};
                           });
                         }} placeholder="Número / Alias" />
                  <div className="md:col-span-3 text-right">
                    <button className="h-9 px-3 rounded-lg border border-white/15"
                            onClick={()=>{
                              setData(d=>{
                                const arr=[...(d.pagos?.cuentas||[])];
                                arr.splice(idx,1); return {...d, pagos:{cuentas:arr}};
                              });
                            }}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <Btn onClick={nextStep} busy={saving}>Continuar</Btn>
            </div>
          </section>
        )}

        {/* PASO 5: Final */}
        {step === 5 && (
          <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-bold font-display">Revisión</h3>
            <ul className="text-sm text-slate-300 mt-2 space-y-1">
              <li>Teléfono: {data.telefono || "—"}</li>
              <li>Usuario: {data.username || "—"}</li>
              <li>Listas de precios: {data.price_lists?.length || 0}</li>
              <li>Puntos: {data.puntos?.length || 0}</li>
              <li>Cuentas: {data.pagos?.cuentas?.length || 0}</li>
            </ul>
            {!isProfileComplete(data) && (
              <div className="mt-3 text-yellow-300 text-sm">
                Te faltan campos obligatorios. Completalos para terminar.
              </div>
            )}
            <div className="mt-4 flex justify-between">
              <button className="px-4 h-11 rounded-xl bg-white/10 border border-white/15" onClick={()=>setStep(0)}>
                Editar desde el inicio
              </button>
              <Btn onClick={finish} busy={saving}>Terminar y entrar al Studio</Btn>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

/* ============ UI helpers ============ */
function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-xs text-white/70 mb-1">{label}</div>
      {children}
    </label>
  );
}
function Btn({ children, busy, ...rest }) {
  return (
    <button
      className="px-4 h-11 rounded-xl bg-blue-600 text-white font-display font-bold disabled:opacity-50"
      disabled={busy}
      {...rest}
    >
      {busy ? "Guardando..." : children}
    </button>
  );
}
