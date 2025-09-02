import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import GoogleLogo from "../assets/icons/google.png";
import FacebookLogo from "../assets/icons/facebook.png";
import InstagramLogo from "../assets/icons/instagram.png";
import { supabase } from "../lib/supabaseClient";

// roles desde metadata
function getRoles(user) {
  const md = user?.user_metadata || {};
  if (Array.isArray(md.roles)) return md.roles;
  if (md.role) return [md.role];
  return [];
}

export default function LoginPhotographer() {
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [needsRole, setNeedsRole] = useState(false);

  // intención de rol al entrar
  useEffect(() => {
    try { localStorage.setItem("intendedRole", "photographer"); } catch {}
  }, []);

  // Si hay sesión: si tiene rol fotógrado -> /studio; si NO, cerramos sesión para evitar “auto-login” de biker
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const sess = data?.session;
      if (!sess) return;
      const roles = getRoles(sess.user);
      if (roles.includes("fotografo")) {
        if (alive) nav("/studio", { replace: true });
      } else {
        // 🔥 clave: matar la sesión previa (biker) para que puedas loguearte como fotógrafo
        await supabase.auth.signOut().catch(() => {});
        setMsg("Cerramos tu sesión anterior para que ingresés como Fotógrafo.");
      }
    })();
    return () => { alive = false; };
  }, [nav, loc.key]);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    setNeedsRole(false);
    setLoading(true);
    try {
      // 💡 evitar sesión pegada
      await supabase.auth.signOut();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const user = data?.user || (await supabase.auth.getUser()).data?.user;
      const roles = getRoles(user);
      if (roles.includes("fotografo")) {
        nav("/studio", { replace: true });
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

  async function activatePhotographerRole() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const roles = getRoles(user);
      const newRoles = Array.from(new Set([...(roles || []), "fotografo"]));
      const { error } = await supabase.auth.updateUser({ data: { roles: newRoles } });
      if (error) throw error;
      setMsg("Perfil de Fotógrafo activado. Entrando...");
      nav("/studio", { replace: true });
    } catch (e) {
      setMsg(e.message || "No se pudo activar el perfil de Fotógrafo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-black text-slate-100">
      <div className="w-full max-w-[460px] rounded-2xl shadow-lg p-6 bg-studio-panel border border-white/10">
        <div className="text-center">
          <h1 className="text-2xl font-black font-display">Bienvenido al Studio</h1>
          <div className="text-slate-300 text-sm">
            ¿No tenés cuenta?{" "}
            <Link to="/signup-fotografo" className="text-blue-400 font-semibold">Crear cuenta fotógrafo</Link>
          </div>
          {msg && <div className="mt-3 text-sm text-yellow-300">{msg}</div>}
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

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
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
