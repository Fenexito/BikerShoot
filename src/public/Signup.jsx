import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import GoogleLogo from "../assets/icons/google.png";
import FacebookLogo from "../assets/icons/facebook.png";
import InstagramLogo from "../assets/icons/instagram.png";
import { supabase } from "../lib/supabaseClient";

export default function Signup() {
  const nav = useNavigate();
  const [name, setName] = useState("");
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
      options: { data: { roles: ["biker"], display_name: name } },
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
    // Si desactivaste confirmación por correo, podés redirigir directo:
    // nav("/app");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-white">
      <div className="w-full max-w-[460px] bg-white shadow rounded-2xl p-6">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded" />
          <h1 className="text-3xl font-bold font-display capitalize">Crea tu Cuenta</h1>
          <div className="text-slate-600 text-sm">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="text-blue-600 font-semibold">
              Inicia sesión
            </Link>
          </div>
        </div>

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <input
            className="w-full h-11 rounded-lg border border-slate-200 px-3"
            placeholder="Nombre"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
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

        {msg && <p className="mt-3 text-sm text-slate-700">{msg}</p>}

        <div className="mt-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs text-slate-500">o continúa con</span>
          <div className="h-px flex-1 bg-slate-200" />
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
