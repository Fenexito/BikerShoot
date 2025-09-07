import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

// ===== Mock de eventos con mini-galería por tarjeta =====
const EVENTS = [
  {
    id:'evt-1',
    nombre:'Domingo Carretera a El Salvador',
    fecha:'2025-09-07',
    lugar:'Km 18 CA-1',
    ruta:'Obelisco → Km18 → Cima',
    fotografos:['Studio Cobra','MotoZoom'],
    fotos:[
      'https://images.unsplash.com/photo-1558981806-ec527fa84c39?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1544967082-d9e3449aa7d1?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?q=80&w=1600&auto=format&fit=crop',
    ],
  },
  {
    id:'evt-2',
    nombre:'Ruta a Antigua',
    fecha:'2025-09-14',
    lugar:'Obelisco',
    ruta:'Obelisco → San Lucas → Antigua',
    fotografos:['La Ceiba Photos'],
    fotos:[
      'https://images.unsplash.com/photo-1502877338535-766e1452684a?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1493247035880-efdf54f3fa6f?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1529665253569-6d01c0eaf7b6?q=80&w=1600&auto=format&fit=crop',
    ],
  },
  {
    id:'evt-3',
    nombre:'Nocturna en la Reforma',
    fecha:'2025-09-20',
    lugar:'Zona 10',
    ruta:'Torre → Reforma → Obelisco',
    fotografos:['Eclipse Shots','Veloz Studio'],
    fotos:[
      'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1502877338535-766e1452684a?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1558980664-10ea0b8e62d2?q=80&w=1600&auto=format&fit=crop',
    ],
  },
  {
    id:'evt-4',
    nombre:'Enduro San Lucas',
    fecha:'2025-09-28',
    lugar:'San Lucas',
    ruta:'Bosques → Cumbres → San Lucas',
    fotografos:['Ruta 502'],
    fotos:[
      'https://images.unsplash.com/photo-1493247035880-efdf54f3fa6f?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1542156822-6924d1a71ace?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1558981806-ec527fa84c39?q=80&w=1600&auto=format&fit=crop',
    ],
  },
  {
    id:'evt-5',
    nombre:'Pista Guatemala GP',
    fecha:'2025-10-12',
    lugar:'Autódromo',
    ruta:'Boxes → Curva 3 → Recta',
    fotografos:['MotoZoom GT'],
    fotos:[
      'https://images.unsplash.com/photo-1558980664-10ea0b8e62d2?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1544967082-d9e3449aa7d1?q=80&w=1600&auto=format&fit=crop',
    ],
  },
  {
    id:'evt-6',
    nombre:'Rodada Mixco Express',
    fecha:'2025-10-05',
    lugar:'Naranjo Mall',
    ruta:'Naranjo → Peri → Calzada',
    fotografos:['Veloz Studio'],
    fotos:[
      'https://images.unsplash.com/photo-1544967082-d9e3449aa7d1?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1502877338535-766e1452684a?q=80&w=1600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?q=80&w=1600&auto=format&fit=crop',
    ],
  },
];

function nice(dstr){
  const d = new Date(dstr + 'T00:00:00');
  return d.toLocaleDateString('es-GT', { weekday:'short', day:'2-digit', month:'short' });
}

// ===== Mini Slider (autoplay + swipe) =====
function MiniSlider({ images, interval=3500, className='' }){
  const [idx, setIdx] = useState(0);
  const timer = useRef(null);
  const startX = useRef(null);

  const go = (n)=> setIdx(p => (p + n + images.length) % images.length);
  const goTo = (n)=> setIdx(((n % images.length) + images.length) % images.length);

  useEffect(()=>{
    timer.current = setInterval(()=>go(1), interval);
    return ()=> clearInterval(timer.current);
  }, [interval]);

  const onTouchStart = (e)=> { startX.current = e.touches[0].clientX; };
  const onTouchMove = (e)=> {
    if (startX.current == null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (Math.abs(dx) > 60){
      go(dx < 0 ? 1 : -1);
      startX.current = null;
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      <div className="relative h-44 md:h-56" onTouchStart={onTouchStart} onTouchMove={onTouchMove}>
        {images.map((src,i)=>(
          <img
            key={src}
            src={src}
            alt={`foto-${i+1}`}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${i===idx?'opacity-100':'opacity-0'}`}
            loading={i===0?'eager':'lazy'}
          />
        ))}
      </div>
      {/* Dots */}
      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
        {images.map((_,i)=>(
          <button
            key={i}
            className={`h-2.5 rounded-full transition-all ${i===idx?'w-7 bg-white':'w-2.5 bg-white/70 hover:bg-white'}`}
            onClick={()=>goTo(i)}
            aria-label={`Ir a foto ${i+1}`}
          />
        ))}
      </div>
    </div>
  );
}

// ===== Tarjeta limpia (neutra) =====
function CardEventoClean({ ev }){
  const fotos = ev.fotos?.length ? ev.fotos : [
    'https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?q=80&w=1600&auto=format&fit=crop'
  ];
  const fotosLabel = useMemo(()=>{
    if (!ev.fotografos?.length) return '—';
    const [first, ...rest] = ev.fotografos;
    return rest.length ? `${first} +${rest.length}` : first;
  }, [ev.fotografos]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <MiniSlider images={fotos} />
      <div className="p-4">
        <div className="font-bold text-lg leading-snug">{ev.nombre}</div>
        <div className="text-slate-600 text-sm">{ev.lugar} • {nice(ev.fecha)}</div>
        <div className="text-slate-600 text-sm">Ruta: {ev.ruta}</div>
        <div className="text-slate-600 text-sm">Fotógrafo(s): {fotosLabel}</div>

        <div className="mt-3 flex items-center gap-2">
          <span className="inline-block text-xs font-semibold px-2 py-1 rounded bg-blue-50 text-blue-700">+1,500 fotos</span>
          <span className="inline-block text-xs font-semibold px-2 py-1 rounded bg-emerald-50 text-emerald-700">Activos: {ev.fotografos?.length || 0}</span>
        </div>

        <div className="mt-4">
          <Link to="/eventos" className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-black/80">
            Ver evento
            <svg viewBox="0 0 24 24" className="w-4 h-4"><path fill="currentColor" d="m13 5 7 7-7 7-1.4-1.4 4.6-4.6H4v-2h12.2L11.6 6.4 13 5Z"/></svg>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function Events(){
  const [q, setQ] = useState('');

  const list = useMemo(()=>{
    if (!q.trim()) return EVENTS;
    const t = q.toLowerCase();
    return EVENTS.filter(e =>
      e.nombre.toLowerCase().includes(t) ||
      e.lugar.toLowerCase().includes(t) ||
      e.ruta.toLowerCase().includes(t) ||
      (e.fotografos || []).some(n => n.toLowerCase().includes(t))
    );
  }, [q]);

  return (
    <main className='container-max px-5 py-10'>
      <h1 className='text-3xl font-black'>Eventos</h1>

      {/* Buscador simple */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 grid md:grid-cols-[1fr_160px] gap-3">
        <input
          className="h-11 rounded-lg border border-slate-200 px-3"
          placeholder="Buscar por nombre, fotógrafo, ruta o lugar"
          value={q}
          onChange={e=>setQ(e.target.value)}
        />
        <Link to="/fotografos" className="h-11 grid place-items-center rounded-lg border border-slate-200 font-semibold">
          Ver fotógrafos
        </Link>
      </div>

      {/* Grid de tarjetas limpias */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {list.map(ev => <CardEventoClean key={ev.id} ev={ev} />)}
      </div>

      {list.length === 0 && (
        <div className="mt-6 text-center text-slate-600">
          No hay eventos con esos filtros. Probá cambiar la búsqueda, patojo. 😅
        </div>
      )}
    </main>
  )
}
