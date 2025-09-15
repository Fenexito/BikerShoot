// src/components/HeaderUser.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useCart } from "../state/CartContext.jsx";
import AdminAccessLink from "./AdminAccessLink.jsx";

/**
 * Header pegajoso que:
 * - Se oculta al hacer scroll hacia abajo en /app/buscar
 * - Se mantiene oculto si el Lightbox está abierto (body[data-lightbox="1"])
 * - No se monta sobre la grilla al cerrar el lightbox (transición suave)
 */
export default function HeaderUser() {
  const [open, setOpen] = useState(false);
  const [hideOnScroll, setHideOnScroll] = useState(false);

  const nav = useNavigate();
  const location = useLocation();
  const { count, setOpen: openCart } = useCart();

  const isSearchRoute = location.pathname.startsWith("/app/buscar");

  // Ocultar/mostrar por scroll (solo en buscador)
  useEffect(() => {
    if (!isSearchRoute) {
      setHideOnScroll(false);
      return;
    }
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const goingDown = y > last + 6;
      const goingUp = y < last - 6;
      if (goingDown && y > 120) setHideOnScroll(true);
      else if (goingUp || y <= 10) setHideOnScroll(false);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isSearchRoute]);

  // Ocultar si el Lightbox está abierto (lo marcará PhotoLightbox con data-lightbox="1")
  const [lightboxOpen, setLightboxOpen] = useState(false);
  useEffect(() => {
    const check = () => setLightboxOpen(document.body.getAttribute("data-lightbox") === "1");
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-lightbox"] });
    return () => observer.disconnect();
  }, []);

  const hidden = (isSearchRoute && hideOnScroll) || lightboxOpen;

  return (
    <header
      className={
        "sticky top-0 z-50 transition-transform duration-300 " +
        (hidden ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100")
      }
      aria-hidden={hidden ? "true" : "false"}
    >
      <div className="w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/75">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
          {/* Izquierda: Logo + Inicio */}
          <div className="flex items-center gap-3">
            <Link to="/app" className="font-display font-bold text-lg tracking-tight hover:opacity-80">
              Motoshots
            </Link>
            <Link
              to="/app"
              className="hidden sm:inline-flex h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              title="Volver al inicio"
            >
              Inicio
            </Link>
          </div>

          {/* Centro: navegación simple */}
          <nav className="hidden md:flex items-center gap-4 text-sm">
            <Link to="/app/buscar" className="text-slate-700 hover:text-black">Buscar</Link>
            <Link to="/app/eventos" className="text-slate-700 hover:text-black">Eventos</Link>
            <AdminAccessLink />
          </nav>

          {/* Derecha: carrito + menú */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => openCart?.(true)}
              className="relative h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
              title="Ver carrito"
            >
              Carrito
              {Number(count) > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-blue-600 text-white text-[11px] grid place-items-center px-1">
                  {count}
                </span>
              )}
            </button>

            <button
              aria-label="Menú"
              onClick={() => setOpen(!open)}
              className="md:hidden grid place-items-center w-10 h-10 rounded-lg border border-slate-200 bg-white"
            >
              ≡
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
