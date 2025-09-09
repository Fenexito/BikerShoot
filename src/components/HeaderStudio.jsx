import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function HeaderStudio() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch {}
    try {
      localStorage.removeItem("intendedRole");
      localStorage.removeItem("lastRole");
    } catch {}
    nav("/", { replace: true });
  }

  return (
    <header className="sticky top-4 z-50 px-4">
      <div className="bg-studio-panel text-white rounded-2xl shadow-lg border border-white/10">
        <div className="container-max flex h-[72px] items-center gap-4 px-5">
          <Link to="/studio" className="flex items-center gap-2 font-extrabold">
            <span className="w-8 h-8 rounded bg-blue-500 inline-block" /> MotoShots • Studio
          </Link>

          <nav className={"ml-auto lg:ml-0 lg:flex-1 " + (open ? "block" : "hidden") + " lg:block"}>
            <ul className="flex flex-col lg:flex-row lg:justify-center gap-2 lg:gap-7 font-semibold">
              <li><Link to="/studio" className="px-2 py-2 rounded-lg text-slate-200/90 hover:text-white">Inicio</Link></li>
              <li><Link to="/studio/eventos" className="px-2 py-2 rounded-lg text-slate-200/90 hover:text-white">Eventos</Link></li>
              <li><Link to="/studio/pedidos" className="px-2 py-2 rounded-lg text-slate-200/90 hover:text-white">Pedidos</Link></li>
              <li><Link to="/studio/estadisticas" className="px-2 py-2 rounded-lg text-slate-200/90 hover:text-white">Estadísticas</Link></li>
              <li><Link to="/studio/perfil" className="px-2 py-2 rounded-lg text-slate-200/90 hover:text-white">Perfil</Link></li>
            </ul>
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <button onClick={handleLogout} className="px-4 py-2 rounded-xl border border-white/20 text-white hover:bg-white/5">
              Cerrar sesión
            </button>
          </div>

          <button
            aria-label="Menu"
            onClick={() => setOpen(!open)}
            className="lg:hidden w-10 h-10 rounded-lg border border-white/20 bg-white/5 text-white"
          >
            ≡
          </button>
        </div>
      </div>
    </header>
  );
}
