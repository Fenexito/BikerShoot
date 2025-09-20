// src/components/HeaderUser.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useCart } from "../state/CartContext.jsx";
import AdminAccessLink from "./AdminAccessLink.jsx";

export default function HeaderUser() {
  const [open, setOpen] = useState(false);
  const [hideOnScroll, setHideOnScroll] = useState(false);

  const nav = useNavigate();
  const location = useLocation();
  const { count, setOpen: openCart, clear } = useCart();

  const isSearchRoute = location.pathname.startsWith("/app/buscar");

  // Ir al inicio con animación rápida (smooth) y fallback
  const goTop = () => {
    // Respeta accesibilidad
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo(0, 0);
      return;
    }
    // Soporte nativo
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    } catch (_) {
      // Algunos navegadores viejitos no soportan smooth
    }
    // Fallback manual (easeOutCubic ~350ms)
    const start = window.scrollY || window.pageYOffset || 0;
    const duration = 350;
    const startTime = performance.now();
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const step = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const y = Math.round(start * (1 - easeOutCubic(t)));
      window.scrollTo(0, y);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  useEffect(() => {
    if (!isSearchRoute) {
      setHideOnScroll(false);
      return;
    }
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      // Ocultar al pasar cierto umbral scrolleando hacia abajo…
     if (y > 120) {
       setHideOnScroll(true);
     }
     // …y mostrar ÚNICAMENTE cuando volvés al inicio (top).
     else if (y <= 10) {
       setHideOnScroll(false);
     }
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isSearchRoute]);

  async function handleLogout() {
    try { await supabase.auth.signOut(); } catch {}
    try { localStorage.removeItem("intendedRole"); localStorage.removeItem("lastRole"); } catch {}
    try { clear?.(); } catch {}
    nav("/?logout=1", { replace: true });
  }

  return (
    <>
    <header
      className={
        "sticky top-4 z-50 px-4 transition-transform duration-300 " +
        (hideOnScroll ? "-translate-y-[120%]" : "")
      }
    >
      <div className="bg-white text-slate-900 rounded-2xl shadow-lg">
        <div className="container-max flex h-[72px] items-center gap-4 px-5">
          <Link to="/app" className="flex items-center gap-2 font-extrabold">
            <span className="w-8 h-8 rounded bg-blue-600 inline-block" /> MotoShots
          </Link>

          <div
            className={`ml-auto lg:ml-0 lg:flex-1 ${
              open ? "absolute top-full left-0 w-full bg-white" : "hidden"
            } lg:static lg:block lg:w-auto lg:bg-transparent`}
          >
            <nav>
              <ul className="flex flex-col lg:flex-row lg:justify-center gap-2 lg:gap-7 font-semibold">
                <li>
                  <Link
                    to="/app"
                    className="px-2 py-2 rounded-lg text-slate-800/80 hover:text-slate-900"
                  >
                    Inicio
                  </Link>
                </li>
                <li>
                  <Link
                    to="/app/historial"
                    className="px-2 py-2 rounded-lg text-slate-800/80 hover:text-slate-900"
                  >
                    Historial
                  </Link>
                </li>
                <li>
                  <Link
                    to="/app/buscar/configurar"
                    className="px-2 py-2 rounded-lg text-slate-800/80 hover:text-slate-900"
                  >
                    Buscar
                  </Link>
                </li>
                <li>
                  <Link
                    to="/app/fotografos"
                    className="px-2 py-2 rounded-lg text-slate-800/80 hover:text-slate-900"
                  >
                    Fotógrafos
                  </Link>
                </li>
                <li>
                  <Link
                    to="/app/perfil"
                    className="px-2 py-2 rounded-lg text-slate-800/80 hover:text-slate-900"
                  >
                    Perfil
                  </Link>
                </li>
                <li className="lg:hidden">
                  <AdminAccessLink />
                </li>
              </ul>
            </nav>
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <AdminAccessLink />
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl border border-slate-200 font-bold bg-white"
            >
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
            className="lg:hidden grid place-items-center w-10 h-10 rounded-lg border border-slate-200 bg-white"
          >
            ≡
          </button>
        </div>
      </div>
    </header>
    {/* Botón flotante "INICIO" (solo en buscar y cuando el header esté oculto) */}
    {isSearchRoute && hideOnScroll && (
      <button
        onClick={goTop}
        title="Ir al inicio"
        className="
          fixed bottom-4 right-4 z-[60]
          inline-flex items-center gap-2
          rounded-full px-4 py-2
          bg-blue-600 text-white font-bold shadow-lg
          hover:bg-blue-700 active:scale-95
          transition
        "
        // Un pelito de padding para evitar chocar con la barra de gestos en móviles
        style={{ paddingBottom: `calc(0.5rem + env(safe-area-inset-bottom, 0px))` }}
      >
        <span className="text-sm tracking-wide">INICIO</span>
        {/* Flecha hacia arriba */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
             className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <path d="M12 4l-7 7h4v7h6v-7h4l-7-7z" />
        </svg>
      </button>
    )}
    </>
  );
}
