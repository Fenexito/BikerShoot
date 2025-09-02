import React from "react";
import { Link, useSearchParams } from "react-router-dom";

export default function AdminMain({ pending }) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      <Card
        title="Rutas"
        desc="Crear y administrar rutas maestras en el mapa (OSM/MapTiler)."
        to="/admin/rutas"
        color="bg-red-50 border-red-200"
      />
      <Card
        title="Magic Link"
        desc="Generar magic link para autorizar a un nuevo fotógrafo."
        to="/admin/magic-link"
        color="bg-blue-50 border-blue-200"
      />
      <Card title="Opción A" desc="Pendiente." to="/admin/opcion-a" />
      <Card title="Opción B" desc="Pendiente." to="/admin/opcion-b" />
      <Card title="Opción C" desc="Pendiente." to="/admin/opcion-c" />

      {pending && (
        <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="font-bold">Nota</div>
          <div className="text-slate-700">{pending}</div>
        </div>
      )}
    </section>
  );
}

function Card({ title, desc, to, color = "bg-white border-slate-200" }) {
  return (
    <Link
      to={to}
      className={`rounded-2xl border p-5 hover:shadow-md transition ${color}`}
    >
      <div className="text-lg font-display font-bold">{title}</div>
      <p className="text-slate-600 mt-1">{desc}</p>
      <div className="mt-3 inline-flex items-center gap-2 text-blue-700 font-semibold">
        Ir <span>→</span>
      </div>
    </Link>
  );
}
