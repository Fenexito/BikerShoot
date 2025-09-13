import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import GoogleLogo from "../assets/icons/google.png";
import FacebookLogo from "../assets/icons/facebook.png";
import InstagramLogo from "../assets/icons/instagram.png";
import { supabase } from "../lib/supabaseClient";

/* ===== Utils / Roles ===== */
function getRoles(user) {
  const md = user?.user_metadata || {};
  if (Array.isArray(md.roles)) return md.roles;
  if (md.role) return [md.role];
  return [];
}
const uniq = (arr) => Array.from(new Set(arr));

export default function LoginPhotographer() {
  const nav = useNavigate();
  const loc = useLocation();

  // Fases: revisando | forzar_setear_password | login normal
  const [phase, setPhase] = useState("checking");
  const [msg, setMsg] = useState("");

  // Login normal
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Forzar contraseña (vía magic link)
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");

  const [loading, setLoading] = useState(false);
  const [needsRole, setNeedsRole] = useState(false);

  // Marcar intención de rol
  useEffect(() => {
    try { localStorage.setItem("intendedRole", "photographer"); } catch {}
  }, []);

  // Detectar magic link (tokens en el hash) o sesiones previas
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setMsg("");

        // 1) ¿Viene desde magic link? (#access_token & #refresh_token)
        const hash = window.location.hash || "";
        const params = new URLSearchParams(hash.replace(/^#/, ""));
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");

        if (access_token && refresh_token) {
          // Guardar sesión temporal SOLO para permitir cambiar contraseña
          const { error: sessErr } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (sessErr) throw sessErr;

          // Limpiar el hash (ocultar tokens de la URL)
          window.history.replaceState({}, document.title, window.location.pathname);

          if (!alive) return;
          setPhase("force_set_password");
          setMsg("¡Bienvenido! Creá tu contraseña para finalizar tu acceso.");
          return;
        }

        // 2) Si no hay tokens, ver si existe sesión
        const { data } = await supabase.auth.getSession();
        const sess = data?.session;

        if (!sess) {
          if (!alive) return;
          setPhase("login_form");
          return;
        }

        const roles = getRoles(sess.user);

        if (roles.includes("fotografo")) {
          // Ya es fotógrafo → directo al Studio
          if (!alive) return;
          nav("/studio", { replace: true });
          return;
        }

        // Había sesión (p.ej. biker/admin) → cerrar para que pueda loguearse como fotógrafo
        await supabase.auth.signOut().catch(() => {});
        if (!alive) return;
        setMsg("Cerramos tu sesión anterior para que ingresés como Fotógrafo.");
        setPhase("login_form");
      } catch (e) {
        setMsg(e.message || "No se pudo validar tu acceso.");
        setPhase("login_form");
      }
    })();
    return () => { alive = false; };
  }, [nav, loc.key]);

  /* ===== Acciones ===== */

  // Login normal (correo + contraseña)
  async function onSubmitLogin(e) {
    e.preventDefault();
    setMsg("");
    setNeedsRole(false);
    setLoading(true);
    try {
      // Evitar sesión pegada
      await supabase.auth.signOut().catch(() => {});
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const user = data?.user || (await supabase.auth.getUser()).data?.user;
      const roles = getRoles(user);
      if (roles.includes("fotografo")) {
        const url = new URL("/studio", window.location.origin);
        url.searchParams.set("login", "1");
        nav(url.pathname + url.search, { replace: true });
        return;
      }
      setNeedsRole(true);
      setMsg("Esta cuenta no tiene perfil de Fotógrafo.");
    } catch (e) {
      setMsg(e.message || "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  // Activar rol fotógrafo (si entró con otra cuenta)
  async function activatePhotographerRole() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Iniciá sesión primero.");
      const roles = getRoles(user);
      const newRoles = uniq([...(roles || []), "fotografo"]);
      const { error } = await supabase.auth.updateUser({ data: { roles: newRoles } });
      if (error) throw error;
      setMsg("Perfil de Fotógrafo activado. Entrando...");
      const url = new URL("/studio", window.location.origin);
      url.searchParams.set("login", "1");
      nav(url.pathname + url.search, { replace: true });
    } catch (e) {
      setMsg(e.message || "No se pudo activar el perfil de Fotógrafo");
    } finally {
      setLoading(false);
    }
  }

  // Guardar contraseña obligatoria (primera vez vía magic link)
  async function onSubmitForcePassword(e) {
    e.preventDefault();
    setMsg("");
    if (!newPw || newPw.length < 8) {
      setMsg("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPw !== newPw2) {
      setMsg("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión inválida. Pedí un nuevo enlace.");

      // Asegurar rol fotografo
      const roles = getRoles(user);
      const newRoles = uniq([...(roles || []), "fotografo"]);

      // Setear password y roles
      const { error: updErr } = await supabase.auth.updateUser({
        password: newPw,
        data: { roles: newRoles },
      });
      if (updErr) throw updErr;

      // Cerrar sesión para que el magic link NO deje sesión abierta
      await supabase.auth.signOut().catch(() => {});

      // Volver al login con aviso para que ya entre con su nueva contraseña
      const url = new URL("/login-fotografo", window.location.origin);
      url.searchParams.set("pwd_set", "1");
      nav(url.pathname + "?" + url.searchParams.toString(), { replace: true });
    } catch (e) {
      setMsg(e.message || "No se pudo guardar la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  // Aviso cuando viene de haber seteado la password
  const pwdSetOk = useMemo(() => {
    const sp = new URLSearchParams(loc.search);
    return sp.get("pwd_set") === "1";
  }, [loc.search]);

  /* ===== UI ===== */
  if (phase === "checking") {
    return (
      <main className="min-h-screen grid place-items-center bg-black text-slate-100">
        <div className="max-w-md w-full p-6 rounded-2xl border border-white/10 bg-neutral-900">
          <h1 className="text-xl font-bold">Revisando acceso…</h1>
          {msg && <p className="text-slate-300 mt-2">{msg}</p>}
        </div>
      </main>
    );
  }

  if (phase === "force_set_password") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-black text-slate-100 relative">
        <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-1.5 bg-white/10 text-slate-100 shadow hover:bg-white/15"
            title="Volver al inicio"
          >
            <span className="text-lg leading-none">←</span>
            <span className="font-semibold">Volver al inicio</span>
          </Link>
        </div>

        <div className="w-full max-w-[460px] rounded-2xl shadow-lg p-6 bg-studio-panel border border-white/10">
          <h1 className="text-2xl font-black font-display text-center">Crea tu contraseña</h1>
          <p className="text-slate-300 text-sm text-center mt-1">
            Este paso es obligatorio la primera vez. Luego ingresás con tu correo y contraseña.
          </p>
          {msg && <div className="mt-3 text-sm text-yellow-300 text-center">{msg}</div>}

          <form className="mt-5 space-y-3" onSubmit={onSubmitForcePassword}>
            <input
              type="password"
              className="w-full h-11 rounded-lg border border-white/15 bg-white/5 text-white px-3 placeholder-white/60"
              placeholder="Nueva contraseña (mín. 8)"
              autoComplete="new-password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
            />
            <input
              type="password"
              className="w-full h-11 rounded-lg border border-white/15 bg-white/5 text-white px-3 placeholder-white/60"
              placeholder="Confirmar contraseña"
              autoComplete="new-password"
              value={newPw2}
              onChange={(e) => setNewPw2(e.target.value)}
              required
            />
            <button
              className="w-full h-11 rounded-xl bg-blue-600 text-white font-bold font-display disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Guardando..." : "Guardar contraseña"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // phase === 'login_form'
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-black text-slate-100 relative">
      {/* Ir al inicio – arriba-izquierda (oscuro) */}
      <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-1.5 bg-white/10 text-slate-100 shadow hover:bg-white/15"
          title="Volver al inicio"
        >
          <span className="text-lg leading-none">←</span>
          <span className="font-semibold">Volver al inicio</span>
        </Link>
      </div>

      <div className="w-full max-w-[460px] rounded-2xl shadow-lg p-6 bg-studio-panel border border-white/10">
        <div className="text-center">
          <h1 className="text-2xl font-black font-display">Bienvenido al Studio</h1>
          <div className="text-slate-300 text-sm">
            ¿No tenés cuenta?{" "}
            <Link to="/signup-fotografo" className="text-blue-400 font-semibold">Crear cuenta fotógrafo</Link>
          </div>

          {pwdSetOk && (
            <div className="mt-3 text-sm text-emerald-300">
              Contraseña creada. Ingresá con tu correo y nueva contraseña.
            </div>
          )}
          {msg && <div className="mt-2 text-sm text-yellow-300">{msg}</div>}
          {needsRole && (
            <div className="mt-2">
              <button
                type="button"
                className="h-10 px-4 rounded-lg bg-blue-600 text-white font-bold"
                onClick={activatePhotographerRole}
                disabled={loading}
              >
                Activar perfil Fotógrafo
              </button>
            </div>
          )}
        </div>

        <form className="mt-5 space-y-3" onSubmit={onSubmitLogin}>
          <input
            className="w-full h-11 rounded-lg border border-white/15 bg-white/5 text-white px-3 placeholder-white/60"
            placeholder="Correo"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full h-11 rounded-lg border border-white/15 bg-white/5 text-white px-3 placeholder-white/60"
            placeholder="Contraseña"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            className="w-full h-11 rounded-xl bg-blue-600 text-white font-bold font-display disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>

        <div className="mt-5 grid grid-cols-1 gap-2">
          <button type="button" className="h-11 rounded-lg border border-white/15 bg-white/5 text-white font-semibold flex items-center justify-center gap-2 font-display" onClick={() => alert("OAuth próximamente")}>
            <img src={GoogleLogo} alt="Google" className="w-5 h-5" /> Iniciar con Google
          </button>
          <button type="button" className="h-11 rounded-lg border border-white/15 bg-white/5 text-white font-semibold flex items-center justify-center gap-2 font-display" onClick={() => alert("OAuth próximamente")}>
            <img src={FacebookLogo} alt="Facebook" className="w-5 h-5" /> Iniciar con Facebook
          </button>
          <button type="button" className="h-11 rounded-lg border border-white/15 bg-white/5 text-white font-semibold flex items-center justify-center gap-2 font-display" onClick={() => alert("OAuth próximamente")}>
            <img src={InstagramLogo} alt="Instagram" className="w-5 h-5" /> Iniciar con Instagram
          </button>
        </div>
      </div>
    </main>
  );
}
