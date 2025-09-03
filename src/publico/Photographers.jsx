import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

// Mock de fotógrafos (front only)
const ALL = [
  { id:'ph-1', nombre:'Studio Cobra', ciudad:'Guatemala', depto:'Guatemala', disciplina:'Dominical', rating:4.9, avatar:'https://images.unsplash.com/photo-1544006659-f0b21884ce1d?q=80&w=400&auto=format&fit=crop' },
  { id:'ph-2', nombre:'La Ceiba Photos', ciudad:'Antigua', depto:'Sacatepéquez', disciplina:'Pista', rating:4.7, avatar:'https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=400&auto=format&fit=crop' },
  { id:'ph-3', nombre:'MotoZoom GT', ciudad:'Mixco', depto:'Guatemala', disciplina:'Dominical', rating:4.8, avatar:'https://images.unsplash.com/photo-1529665253569-6d01c0eaf7b6?q=80&w=400&auto=format&fit=crop' },
  { id:'ph-4', nombre:'Eclipse Shots', ciudad:'Villa Nueva', depto:'Guatemala', disciplina:'Enduro', rating:4.6, avatar:'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=400&auto=format&fit=crop' },
  { id:'ph-5', nombre:'Ruta 502', ciudad:'Chimaltenango', depto:'Chimaltenango', disciplina:'Dominical', rating:4.8, avatar:'https://images.unsplash.com/photo-1542156822-6924d1a71ace?q=80&w=400&auto=format&fit=crop' },
  { id:'ph-6', nombre:'Veloz Studio', ciudad:'Amatitlán', depto:'Guatemala', disciplina:'Pista', rating:4.7, avatar:'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop' },
];

function CardFotografo({ f }) {
  return (
    <Link to={`/fotografos/${f.id}`} className="group rounded-2xl overflow-hidden border border-slate-200 bg-white hover:shadow-md transition p-4 flex items-center gap-3">
      <img src={f.avatar} alt={f.nombre} className="w-16 h-16 rounded-xl object-cover" />
      <div className="min-w-0">
        <div className="font-bold truncate">{f.nombre}</div>
        <div className="text-sm text-slate-600 truncate">{f.ciudad} • {f.depto}</div>
        <div className="text-xs text-slate-500">Disciplina: {f.disciplina} • ⭐ {f.rating}</div>
      </div>
    </Link>
  );
}

export default function Photographers(){
  const [q, setQ] = useState('');
  const [depto, setDepto] = useState('Todos');
  const [disciplina, setDisciplina] = useState('Todas');
  const [orden, setOrden] = useState('rating');

  const deptos = useMemo(() => ['Todos', ...Array.from(new Set(ALL.map(x=>x.depto)))], []);
  const disciplinas = useMemo(() => ['Todas', ...Array.from(new Set(ALL.map(x=>x.disciplina)))], []);

  const list = useMemo(() => {
    let arr = ALL.filter(x =>
      (depto === 'Todos' || x.depto === depto) &&
      (disciplina === 'Todas' || x.disciplina === disciplina) &&
      (q.trim() === '' || x.nombre.toLowerCase().includes(q.toLowerCase()))
    );
    if (orden === 'rating') arr = arr.sort((a,b)=> b.rating - a.rating);
    if (orden === 'nombre') arr = arr.sort((a,b)=> a.nombre.localeCompare(b.nombre));
    return arr;
  }, [q, depto, disciplina, orden]);

  return (
    <main className='container-max px-5 py-10'>
      <h1 className='text-3xl font-black'>Fotógrafos</h1>

      {/* Filtros */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 grid md:grid-cols-4 gap-3">
        <input
          className="h-11 rounded-lg border border-slate-200 px-3"
          placeholder="Buscar por nombre de estudio"
          value={q}
          onChange={e=>setQ(e.target.value)}
        />
        <select className="h-11 rounded-lg border border-slate-200 px-3" value={depto} onChange={e=>setDepto(e.target.value)}>
          {deptos.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="h-11 rounded-lg border border-slate-200 px-3" value={disciplina} onChange={e=>setDisciplina(e.target.value)}>
          {disciplinas.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="h-11 rounded-lg border border-slate-200 px-3" value={orden} onChange={e=>setOrden(e.target.value)}>
          <option value="rating">Mejor valorados</option>
          <option value="nombre">Nombre (A-Z)</option>
        </select>
      </div>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
        {list.map(f => <CardFotografo key={f.id} f={f} />)}
      </div>

      {list.length === 0 && (
        <div className="mt-6 text-center text-slate-600">
          No hay fotógrafos con esos filtros. Probá limpiarlos, patojo. 😅
        </div>
      )}
    </main>
  )
}
