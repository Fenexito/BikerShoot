import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

export default function AdminHeader() {
  const nav = useNavigate();

  const linkCls = ({ isActive }) =>
    "px-3 h-10 rounded-lg font-semibold grid place-items-center " +
    (isActive
      ? "bg-slate-900 text-white"
      : "bg-white text-slate-700 border border-slate-200");

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-4">
        <Link
          to="/admin"
          className="flex items-center gap-2 font-black text-lg text-slate-900"
        >
          <span className="w-8 h-8 rounded bg-red-600 inline-block" /> Admin
        </Link>

        <nav className="flex-1">
          <ul className="flex items-center gap-2">
            <li>
              <NavLink to="/admin/rutas" className={linkCls}>
                RUTAS
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/magic-link" className={linkCls}>
                MAGIC LINK
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/opcion-a" className={linkCls}>
                Opción A
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/opcion-b" className={linkCls}>
                Opción B
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/opcion-c" className={linkCls}>
                Opción C
              </NavLink>
            </li>
          </ul>
        </nav>

        <button
          className="h-10 px-4 rounded-xl bg-blue-600 text-white font-display font-bold"
          onClick={() => nav("/app/perfil")}
        >
          VOLVER AL PERFIL
        </button>
      </div>
    </header>
  );
}
