import React from "react";
import { photographers } from "../../../data/photographers";
import { hotspots } from "../../../data/hotspots";
import { Link } from "react-router-dom";

export default function SearchByPhotographer(){
  return (
    <main className="w-full max-w-6xl mx-auto px-4 md:px-6 xl:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-black">Buscar por Fotógrafo</h1>
        <p className="text-slate-600 mt-1 text-sm">Método tradicional: elegí un estudio y navegá por sus eventos, horarios y puntos.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {photographers.map(p=>(
          <article key={p.id} className="rounded-2xl border bg-white overflow-hidden">
            <div className="h-36 bg-slate-100">
              <img src={p.portada || p.foto} alt="" className="w-full h-full object-cover"/>
            </div>
            <div className="p-4">
              <h3 className="font-semibold">{p.estudio}</h3>
              <div className="text-sm text-slate-500">Rating {p.rating?.toFixed(1) || "—"}</div>

              <div className="mt-3">
                <div className="text-xs text-slate-500 mb-1">Eventos / Puntos recientes</div>
                <div className="space-y-1">
                  {hotspots.slice(0,4).map(h=>(
                    <div key={h.id} className="text-sm flex items-center justify-between border rounded-lg px-3 py-2">
                      <span>{h.name}</span>
                      <Link className="text-blue-600 font-semibold" to={`/app/buscar?photogs=${p.id}&hotspots=${h.id}`}>Ver</Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
