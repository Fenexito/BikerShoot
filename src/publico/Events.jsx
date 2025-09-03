import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

// Mock eventos (front only)
const BASE = [
  { id:'evt-1', nombre:'Domingo Carretera a El Salvador', fecha:'2025-09-07', lugar:'Km 18 CA-1', cover:'https://images.unsplash.com/photo-1558981806-ec527fa84c39?q=80&w=1600&auto=format&fit=crop' },
  { id:'evt-2', nombre:'Ruta a Antigua', fecha:'2025-09-14', lugar:'Obelisco', cover:'https://images.unsplash.com/photo-1502877338535-766e1452684a?q=80&w=1600&auto=format&fit=crop' },
  { id:'evt-3', nombre:'Nocturna en la Reforma', fecha:'2025-09-20', lugar:'Zona 10', cover:'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?q=80&w=1600&auto=format&fit=crop' },
  { id:'evt-4', nombre:'Enduro San Lucas', fecha:'2025-09-28', lugar:'San Lucas', cover:'https://images.unsplash.com/photo-1493247035880-efdf54f3fa6f?q=80&w=1600&auto=format&fit=crop' },
  { id:'evt-5', nombre:'Rodada Mixco Express', fecha:'2025-10-05', lugar:'Naranjo Mall', cover:'https://images.unsplash.com/photo-1544967082-d9e3449aa7d1?q=80&w=1600&auto=format&fit=crop' },
  { id:'evt-6', nombre:'Pista Guatemala GP', fecha:'2025-10-12', lugar:'Autódromo', cover:'https://images.unsplash.com/photo-1558980664-10ea0b8e62d2?q=80&w=1600&auto=format&fit=crop' },
];

function nice(dstr){
  const d = new Date(dstr + 'T00:00:00');
  return d.toLocaleDateString('es-GT', { weekday:'short', day:'2-digit', month:'short' });
}

function CardEvento({ e }){
  return (
    <Link to={`/eventos/${e.id}`} className="group rounded-2xl overflow-hidden border border-slate-200 bg-white hover:shadow-md transition">
      <img src={e.cover} alt={e.nombre} className="h-40 w-full object-cover" />
      <div className="p-4">
        <div className="text-sm text-slate-500">{nice(e.fecha)}</div>
        <div className="font-bold">{e.nombre}</div>
        <div className="text-sm text-slate-600">{e.lugar}</div>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-block text-xs font-semibold px-2 py-1 rounded bg-blue-50 text-blue-700"># fotógrafos: 12</span>
          <span className="inline-block text-xs font-semibold px-2 py-1 rounded bg-emerald-50 text-emerald-700">+1,500 fotos</span>
        </div>
      </div>
    </Link>
  );
}

export default function Events(){
  const [when, setWhen] = useState('todo'); // hoy / finde / mes / todo
  const [q, setQ] = useState('');

  const list = useMemo(()=>{
    const now = new Date();
    let arr = BASE.filter(x => q.trim()==='' || x.nombre.toLowerCase().includes(q.toLowerCase()) || x.lugar.toLowerCase().includes(q.toLowerCase()));
    if (when !== 'todo'){
      arr = arr.filter(x=>{
        const d = new Date(x.fecha + 'T00:00:00');
        if (when === 'hoy'){
          return d.toDateString() === now.toDateString();
        }
        if (when === 'finde'){
          // próximo sábado/domingo respecto a hoy
          const wd = d.getDay(); // 0=dom
          return wd === 0 || wd === 6;
        }
        if (when === 'mes'){
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }
        return true;
      });
    }
    return arr;
  }, [when, q]);

  // Carrusel "Este domingo" (simulado)
  const domingo = useMemo(()=> BASE.slice(0,4), []);

  return (
    <main className='container-max px-5 py-10'>
      <h1 className='text-3xl font-black'>Eventos</h1>

      {/* Carrusel este domingo (scroll horizontal) */}
      <div className="mt-4">
        <div className="text-slate-600 font-semibold mb-2">Este domingo</div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {domingo.map(e=>(
            <Link key={e.id} to={`/eventos/${e.id}`} className="min-w-[240px] rounded-xl overflow-hidden border border-slate-200 bg-white">
              <img src={e.cover} alt={e.nombre} className="h-28 w-full object-cover" />
              <div className="p-3">
                <div className="text-xs text-slate-500">{nice(e.fecha)}</div>
                <div className="text-sm font-bold line-clamp-2">{e.nombre}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 grid md:grid-cols-[1fr_160px_160px] gap-3">
        <input
          className="h-11 rounded-lg border border-slate-200 px-3"
          placeholder="Buscar por nombre o lugar"
          value={q}
          onChange={e=>setQ(e.target.value)}
        />
        <select className="h-11 rounded-lg border border-slate-200 px-3" value={when} onChange={e=>setWhen(e.target.value)}>
          <option value="todo">Todas las fechas</option>
          <option value="hoy">Hoy</option>
          <option value="finde">Este finde</option>
          <option value="mes">Este mes</option>
        </select>
        <Link to="/fotografos" className="h-11 grid place-items-center rounded-lg border border-slate-200 font-semibold">
          Ver fotógrafos
        </Link>
      </div>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
        {list.map(e => <CardEvento key={e.id} e={e} />)}
      </div>

      {list.length === 0 && (
        <div className="mt-6 text-center text-slate-600">
          No hay eventos con esos filtros. Probá cambiar la fecha, patojo. 🫶
        </div>
      )}
    </main>
  )
}
