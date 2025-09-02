import React from "react";
import { hotspots, routes as routeList } from "../../../data/hotspots";
import { Link } from "react-router-dom";

export default function SearchByPoint(){
  return (
    <main className="w-full max-w-6xl mx-auto px-4 md:px-6 xl:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-black">Buscar por Punto</h1>
        <p className="text-slate-600 mt-1 text-sm">Elegí el punto donde pasaste y mirá las fotos de los estudios que estuvieron ahí.</p>
      </div>

      {routeList.map((r)=>(
        <section key={r} className="mb-6">
          <h2 className="text-lg font-semibold mb-2">{r}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {hotspots.filter(h=>h.route===r).map(h=>(
              <div key={h.id} className="rounded-xl border bg-white p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{h.name}</div>
                  <div className="text-sm text-slate-500">Punto #{h.id}</div>
                </div>
                <Link className="h-10 px-4 rounded-xl bg-blue-600 text-white font-display font-bold" to={`/app/buscar?hotspots=${h.id}`}>
                  Ver fotos
                </Link>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
