import React from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function BikerEvent() {
  const { id } = useParams();
  const nav = useNavigate();

  return (
    <main className="max-w-6xl mx-auto px-5 py-8">
      <button className="mb-4 text-sm text-blue-600 hover:underline" onClick={() => nav(-1)}>
        ← Regresar
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-display font-bold">Evento #{id}</h1>
        <p className="text-slate-600 mt-2">
          Aquí vamos a mostrar <strong>todas las fotografías</strong>, con <em>buscador</em>, opción de{" "}
          <em>agregar al carrito</em> y la compra. Próximo paso 😉
        </p>
      </div>
    </main>
  );
}
