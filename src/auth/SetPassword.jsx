import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

// Lee roles desde metadata
function getRoles(user) {
  const md = user?.user_metadata || {};
  if (Array.isArray(md.roles)) return md.roles;
  if (md.role) return [md.role];
  return [];
}

export default function SetPassword() {
  const nav = useNavigate();
  const loc = useLocation();

  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const [pwd1, setPwd1] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);

  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    async function init() {
      try {
        // El magic link crea la sesión; esperamos un tick por si viene en el hash
        const { data } = await supabase.auth.getSession();
        const sess = data?.session;
        if (!alive) return;
        setHasSession(!!sess);
        setLoading(false);
      } catch {
        if (alive) {
          setHasSession(false);
          setLoading(false);
        }
      }
    }
    const t = setTimeout(init, 50);
    return () => { alive = false; clearTimeout(t); };
  }, [loc.key]);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");

    if (pwd1.length < 8) {
      setMsg("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (pwd1 !== pwd2) {
      setMsg("Las contraseñas no coinciden.");
      return;
    }

    try {
      setSaving(true);

      // 1) Actualizar contraseña del usuario autenticado (gracias al magic link)
      const { error: e1 } = await supabase.auth.updateUser({ password: pwd1 });
      if (e1) throw e1;

      // 2) Marcar en metadata que ya configuró contraseña
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      const roles = getRoles(user);

      const { error: e2 } = await supabase.auth.updateUser({ data: { password_set: true } });
      if (e2) throw e2;

      // 3) Redirigir según rol
      if (roles.includes("fotografo")) {
        nav("/studio", { replace: true });
      } else if (roles.includes("biker")) {
        nav("/app", { replace: true });
      } else {
        nav("/", { replace: true });
      }
    } catch (err) {
      setMsg(err.message || "No se pudo actualizar la contraseña");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center bg-black text-slate-100 p-6">
        <div>Cargando...</div>
      </main>
    );
  }

  if (!hasSession) {
    return (
      <main className="min-h-screen grid place-items-center bg-black text-slate-100 p-6">
        <div className="max-w-md w-full rounded-2xl p-6 border border-white/10 bg-neutral-900">
          <h1 className="text-2xl font-bold mb-2">Enlace inválido o expirado</h1>
          <p className="text-white/70 mb-4">
            Pedí un nuevo acceso al administrador o probá iniciar sesión de forma manual.
          </p>
          <a
            href="/login-fotografo"
            className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold inline-block"
          >
            Ir al login de Fotógrafo
          </a>
          <p className="text-sm text-white/60 mt-3">
            ¿Sos fotógrafo nuevo? Escribí al admin en Instagram:{" "}
            <a
              className="text-blue-400 underline"
              href="https://instagram.com/fenexito"
              target="_blank"
              rel="noreferrer"
            >
              @fenexito
            </a>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-black text-slate-100">
      <div className="w-full max-w-[460px] rounded-2xl p-6 border border-white/10 bg-neutral-900">
        <div className="flex flex-col items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-blue-400 rounded" />
          <h1 className="text-3xl font-bold font-display capitalize">Crear contraseña</h1>
          <p className="text-white/70 text-sm text-center">
            Definí tu contraseña para ingresar cuando querrás sin link.
          </p>
        </div>

        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="relative">
            <input
              type={show1 ? "text" : "password"}
              className="w-full h-11 rounded-lg border border-white/15 bg-white/5 text-white px-3 pr-11 placeholder-white/60"
              placeholder="Nueva contraseña (mín. 8 caracteres)"
              value={pwd1}
              onChange={(e) => setPwd1(e.target.value)}
              required
            />
            <button
              type="button"
              aria-label={show1 ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setShow1((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-white/80 hover:text-white"
            >
              {show1 ? "🙈" : "👁️"}
            </button>
          </div>

          <div className="relative">
            <input
              type={show2 ? "text" : "password"}
              className="w-full h-11 rounded-lg border border-white/15 bg-white/5 text-white px-3 pr-11 placeholder-white/60"
              placeholder="Confirmar contraseña"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              required
            />
            <button
              type="button"
              aria-label={show2 ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setShow2((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-white/80 hover:text-white"
            >
              {show2 ? "🙈" : "👁️"}
            </button>
          </div>

          <button
            className="w-full h-11 rounded-xl bg-blue-600 text-white font-bold font-display disabled:opacity-50"
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar y continuar"}
          </button>
        </form>

        {msg && <p className="mt-3 text-sm text-amber-300">{msg}</p>}
      </div>
    </main>
  );
}
