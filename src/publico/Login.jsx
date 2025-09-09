import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import GoogleLogo from "../assets/icons/google.png";
import FacebookLogo from "../assets/icons/facebook.png";
import InstagramLogo from "../assets/icons/instagram.png";
import { supabase } from "../lib/supabaseClient";

// lee roles desde metadata
function getRoles(user) {
  const md = user?.user_metadata || {};
  if (Array.isArray(md.roles)) return md.roles;
  if (md.role) return [md.role];
  return [];
}

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [needsRole, setNeedsRole] = useState(false);

  // guardar intención de rol al entrar
  useEffect(() => {
    try { localStorage.setItem("intendedRole", "biker"); } catch {}
  }, []);

  // si ya hay sesión y el user tiene rol biker -> directo a /app
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const sess = data?.session;
      if (!sess) return;
      const roles = getRoles(sess.user);
      if (roles.includes("biker") && alive) nav("/app", { replace: true });
    })();
    return () => { alive = false; };
  }, [nav, loc.key]);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    setNeedsRole(false);
    setLoading(true);
    try {
      // 💡 para evitar “sesión pegada”, cerramos la sesión antes de iniciar
      await supabase.auth.signOut();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const user = data?.user || (await supabase.auth.getUser()).data?.user;
      const roles = getRoles(user);
      if (roles.includes("biker")) {
        const url = new URL("/app", window.location.origin);
        url.searchParams.set("login", "1");
        nav(url.pathname + url.search, { replace: true });
        return;
      }
      setNeedsRole(true);
      setMsg("Esta cuenta no tiene perfil de Biker asignado.");
    } catch (e) {
      setMsg(e.message || "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  async function activateBikerRole() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const roles = getRoles(user);
      const newRoles = Array.from(new Set([...(roles || []), "biker"]));
      const { error } = await supabase.auth.updateUser({ data: { roles: newRoles } });
      if (error) throw error;
      setMsg("Perfil de Biker activado. Entrando...");
      {
        const url = new URL("/app", window.location.origin);
        url.searchParams.set("login", "1");
        nav(url.pathname + url.search, { replace: true });
      }
    } catch (e) {
      setMsg(e.message || "No se pudo activar el perfil de Biker");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 relative">
      {/* Ir al inicio – arriba-izquierda */}
      <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 bg-white text-slate-700 shadow hover:bg-slate-50"
          title="Volver al inicio"
        >
          <span className="text-lg leading-none">←</span>
          <span className="font-semibold">Volver al inicio</span>
        </Link>
      </div>
      <div className="w-full max-w-[460px] bg-white rounded-2xl shadow-lg p-6">
        <div className="text-center">
          <h1 className="text-2xl font-black font-display">Bienvenido de vuelta</h1>
          <div className="text-slate-600 text-sm">
            ¿Aún no tienes una cuenta?{" "}
            <Link to="/signup" className="text-blue-600 font-semibold">Crear cuenta</Link>
          </div>
          {msg && <div className="mt-3 text-sm text-red-600">{msg}</div>}
          {needsRole && (
            <div className="mt-2">
              <button
                type="button"
                className="h-10 px-4 rounded-lg bg-blue-600 text-white font-bold"
                onClick={activateBikerRole}
                disabled={loading}
              >
                Activar perfil Biker
              </button>
            </div>
          )}
        </div>

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <input
            className="w-full h-11 rounded-lg border border-slate-200 px-3"
            placeholder="Correo"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full h-11 rounded-lg border border-slate-200 px-3"
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
          <button type="button" className="h-11 rounded-lg border border-slate-200 bg-white font-semibold flex items-center justify-center gap-2 font-display" onClick={() => alert("OAuth próximamente")}>
            <img src={GoogleLogo} alt="Google" className="w-5 h-5" /> Iniciar con Google
          </button>
          <button type="button" className="h-11 rounded-lg border border-slate-200 bg-white font-semibold flex items-center justify-center gap-2 font-display" onClick={() => alert("OAuth próximamente")}>
            <img src={FacebookLogo} alt="Facebook" className="w-5 h-5" /> Iniciar con Facebook
          </button>
          <button type="button" className="h-11 rounded-lg border border-slate-200 bg-white font-semibold flex items-center justify-center gap-2 font-display" onClick={() => alert("OAuth próximamente")}>
            <img src={InstagramLogo} alt="Instagram" className="w-5 h-5" /> Iniciar con Instagram
          </button>
        </div>
      </div>
    </main>
  );
}
