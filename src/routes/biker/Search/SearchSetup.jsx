// src/routes/biker/Search/SearchSetup.jsx
import React, { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";

const arrToCsv = (a) => (Array.isArray(a) ? a.join(",") : "");
const HHMMtoMin = (hhmm) => {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  return h * 60 + m;
};
const minToHHMM = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export default function BikerSearchSetup() {
  const nav = useNavigate();
  const [params] = useSearchParams();

  const [fecha, setFecha] = useState(() => params.get("fecha") || new Date().toISOString().slice(0, 10));
  const [horaIniMin, setHoraIniMin] = useState(() => HHMMtoMin(params.get("inicio") || "06:00"));
  const [horaFinMin, setHoraFinMin] = useState(() => HHMMtoMin(params.get("fin") || "12:00"));
  const [ruta, setRuta] = useState(() => params.get("ruta") || "Todos");

  const goBuscar = () => {
    const url = new URL(window.location.origin + "/app/buscar");
    url.searchParams.set("fecha", fecha);
    url.searchParams.set("inicio", minToHHMM(horaIniMin));
    url.searchParams.set("fin", minToHHMM(horaFinMin));
    if (ruta && ruta !== "Todos") url.searchParams.set("ruta", ruta);
    nav(url.pathname + url.search);
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-xl font-semibold">Configuración de Búsqueda</h1>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-600">Fecha</label>
          <input type="date" className="h-9 border rounded-lg px-2 bg-white w-full" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600">Inicio</label>
          <input type="time" className="h-9 border rounded-lg px-2 bg-white w-full" value={minToHHMM(horaIniMin)} onChange={(e) => setHoraIniMin(HHMMtoMin(e.target.value))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600">Fin</label>
          <input type="time" className="h-9 border rounded-lg px-2 bg-white w-full" value={minToHHMM(horaFinMin)} onChange={(e) => setHoraFinMin(HHMMtoMin(e.target.value))} />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button className="h-9 px-4 rounded-lg bg-blue-600 text-white" onClick={goBuscar}>
          Ir a buscar
        </button>
        <Link to="/app/buscar" className="h-9 px-4 rounded-lg bg-slate-100">Abrir buscador</Link>
      </div>
    </div>
  );
}
