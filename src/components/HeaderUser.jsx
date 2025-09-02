import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useCart } from "../state/CartContext.jsx";
import AdminAccessLink from "./AdminAccessLink.jsx";

export default function HeaderUser() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const { count, setOpen: openCart } = useCart();

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch {}
    try {
      localStorage.removeItem("intendedRole");
      localStorage.removeItem("lastRole");
    } catch {}
    nav("/login", { replace: true });
  }

  return (
    <header className="sticky top-4 z-50 px-4">
      <div className="bg-white text-slate-900 rounded-2xl shadow-lg">
        <div className="container-max flex h-[72px] items-center gap-4 px-5">
          <Link to="/app" className="flex items-center gap-2 font-extrabold">
            <span className="w-8 h-8 rounded bg-blue-600 inline-block" /> MotoShots
          </Link>

          <nav className={"ml-auto lg:ml-0 lg:flex-1 " + (open ? "block" : "hidden") + " lg:block"}>
            <ul className="flex flex-col lg:flex-row lg:justify-center gap-2 lg:gap-7 font-semibold">
              <li><Link to="/app" className="px-2 py-2 rounded-lg text-slate-800/80 hover:text-slate-900">Inicio</Link></li>
              <li><Link to="/app/historial" className="px-2 py-2 rounded-lg text-slate-800/80 hover:text-slate-900">Historial</Link></li>
              <li><Link to="/app/buscar/configurar" className="px-2 py-2 rounded-lg text-slate-800/80 hover:text-slate-900">Buscar</Link></li>
              <li><Link to="/app/fotografos" className="px-2 py-2 rounded-lg text-slate-800/80 hover:text-slate-900">Fotógrafos</Link></li>
              <li><Link to="/app/perfil" className="px-2 py-2 rounded-lg text-slate-800/80 hover:text-slate-900">Perfil</Link></li>
              <li className="lg:hidden"> <AdminAccessLink /></li>
            </ul>
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <AdminAccessLink />
            <button onClick={handleLogout} className="px-4 py-2 rounded-xl border border-slate-200 font-bold bg-white">
              Cerrar sesión
            </button>
            <button
              onClick={() => openCart(true)}
              className="relative grid place-items-center rounded-xl border border-slate-200 bg-white w-10 h-10"
              title="Carrito"
            >
              🛒
              {count > 0 && (
                <span className="absolute -top-1 -right-1 text-xs bg-blue-600 text-white rounded-full px-1.5">
                  {count}
                </span>
              )}
            </button>
          </div>

          <button
            aria-label="Menu"
            onClick={() => setOpen(!open)}
            className="lg:hidden w-10 h-10 rounded-lg border border-slate-200 bg-white"
          >
            ≡
          </button>
        </div>
      </div>
    </header>
  );
}
