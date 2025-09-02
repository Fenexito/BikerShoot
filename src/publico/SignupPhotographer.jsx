import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import GoogleLogo from "../assets/icons/google.png";
import FacebookLogo from "../assets/icons/facebook.png";
import InstagramLogo from "../assets/icons/instagram.png";
import { supabase } from "../lib/supabaseClient";

export default function SignupPhotographer() {
  const nav = useNavigate();
  const [studio, setStudio] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { roles: ["fotografo"], display_name: studio } },
    });
    setLoading(false);
    if (error) {
      if (String(error.message || "").toLowerCase().includes("registered")) {
        setMsg("Ese correo ya está registrado. Iniciá sesión o usá otra dirección.");
      } else {
        setMsg(error.message || "No se pudo crear la cuenta");
      }
      return;
    }
    setMsg("¡Listo! Revisá tu correo si te pide confirmación.");
    // nav("/studio");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-black text-slate-100">
      <div className="w-full max-w-[460px] rounded-2xl p-6 border border-white/10 bg-neutral-900">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 bg-blue-400 rounded" />
          <h1 className="text-3xl font-bold font-display capitalize">Crea tu Cuenta</h1>
          <div className="text-slate-400 text-sm">
            ¿Ya tienes cuenta? {" "}
            <Link to="/login-fotografo" className="text-blue-400 font-semibold">
              Inicia sesión
            </Link>
          </div>
        </div>

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <input
            className="w-full h-11 rounded-lg border border-white/15 bg-white/5 text-white px-3 placeholder-white/60"
            placeholder="Nombre / Estudio"
            type="text"
            autoComplete="organization"
            value={studio}
            onChange={(e) => setStudio(e.target.value)}
            required
          />
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            className="w-full h-11 rounded-xl bg-blue-600 text-white font-bold font-display disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Creando..." : "Crear cuenta"}
          </button>
        </form>

        {msg && <p className="mt-3 text-sm text-white/80">{msg}</p>}

        <div className="mt-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-white/60">o continúa con</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <button
            type="button"
            className="h-11 rounded-lg border border-slate-200 bg-white text-slate-800 font-semibold flex items-center justify-center gap-2 font-display"
            onClick={() => alert("OAuth próximamente")}
          >
            <img src={GoogleLogo} alt="Google" className="w-5 h-5" />
            Registrarte con Google
          </button>
          <button
            type="button"
            className="h-11 rounded-lg border border-slate-200 bg-white text-slate-800 font-semibold flex items-center justify-center gap-2 font-display"
            onClick={() => alert("OAuth próximamente")}
          >
            <img src={FacebookLogo} alt="Facebook" className="w-5 h-5" />
            Registrarte con Facebook
          </button>
          <button
            type="button"
            className="h-11 rounded-lg border border-slate-200 bg-white text-slate-800 font-semibold flex items-center justify-center gap-2 font-display"
            onClick={() => alert("OAuth próximamente")}
          >
            <img src={InstagramLogo} alt="Instagram" className="w-5 h-5" />
            Registrarte con Instagram
          </button>
        </div>
      </div>
    </main>
  );
}
