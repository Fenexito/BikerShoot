import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient' // mismo cliente que usas en auth :contentReference[oaicite:3]{index=3}

/* ---------- SLIDES del héroe ---------- */
const SLIDES = [
  'https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?q=80&w=1600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1502877338535-766e1452684a?q=80&w=1600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1558981806-ec527fa84c39?q=80&w=1600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?q=80&w=1600&auto=format&fit=crop',
];

/* ---------- Hero slider (autoplay + swipe) ---------- */
function HeroSlider() {
  const [idx, setIdx] = useState(0);
  const timer = useRef(null);
  const touchStart = useRef(null);

  const go = (n) => setIdx((p) => (p + n + SLIDES.length) % SLIDES.length);
  const goTo = (n) => setIdx(((n % SLIDES.length) + SLIDES.length) % SLIDES.length);

  useEffect(() => {
    timer.current = setInterval(() => go(1), 4500);
    return () => clearInterval(timer.current);
  }, []);

  const onTouchStart = (e) => { touchStart.current = e.touches[0].clientX; };
  const onTouchMove = (e) => {
    if (touchStart.current == null) return;
    const delta = e.touches[0].clientX - touchStart.current;
    if (Math.abs(delta) > 60) {
      go(delta < 0 ? 1 : -1);
      touchStart.current = null;
    }
  };

  return (
    <div className="relative rounded-2xl shadow-xl overflow-hidden ring-1 ring-slate-200">
      <div className="relative h-52 md:h-[380px]" onTouchStart={onTouchStart} onTouchMove={onTouchMove}>
        {SLIDES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`slide-${i+1}`}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${i===idx?'opacity-100':'opacity-0'}`}
            loading={i===0?'eager':'lazy'}
          />
        ))}
      </div>
      {/* Controles */}
      <button aria-label="Anterior" onClick={() => go(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-full bg-black/40 text-white hover:bg-black/60">
        <svg viewBox="0 0 24 24" className="w-5 h-5"><path fill="currentColor" d="M15.5 19.5L8 12l7.5-7.5 1.5 1.5L11 12l6 6-1.5 1.5Z"/></svg>
      </button>
      <button aria-label="Siguiente" onClick={() => go(1)} className="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-full bg-black/40 text-white hover:bg-black/60">
        <svg viewBox="0 0 24 24" className="w-5 h-5"><path fill="currentColor" d="m8.5 4.5 7.5 7.5-7.5 7.5L7 18l6-6-6-6 1.5-1.5Z"/></svg>
      </button>
      {/* Dots */}
      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
        {SLIDES.map((_, i) => (
          <button key={i} className={`h-2.5 rounded-full transition-all ${i===idx?'w-7 bg-white':'w-2.5 bg-white/60 hover:bg-white'}`} onClick={() => goTo(i)} aria-label={`Ir al slide ${i+1}`} />
        ))}
      </div>
    </div>
  );
}

/* ---------- UI helpers ---------- */
function SectionTitle({ title, subtitle, right }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2">
      <div>
        <h2 className="text-2xl md:text-3xl font-black">{title}</h2>
        {subtitle && <p className="text-slate-600">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function CardEvento({ e }) {
  return (
    <Link to={`/eventos`} className="group rounded-2xl overflow-hidden border border-slate-200 bg-white hover:shadow-md transition">
      <div className="relative">
        <img src={e.cover} alt={e.nombre} className="h-40 w-full object-cover" />
      </div>
      <div className="p-4">
        <div className="text-sm text-slate-500">{e.fechaLabel}</div>
        <div className="font-bold">{e.nombre}</div>
        <div className="text-sm text-slate-600">{e.lugar}</div>
        <div className="mt-3">
          <span className="inline-block text-xs font-semibold px-2 py-1 rounded bg-blue-50 text-blue-700"># fotógrafos: {e.fotCount ?? 12}</span>
        </div>
      </div>
    </Link>
  );
}

function CardFotografo({ f }) {
  return (
    <Link to={`/fotografos`} className="group rounded-2xl overflow-hidden border border-slate-200 bg-white hover:shadow-md transition p-4 flex items-center gap-3">
      <img src={f.avatar} alt={f.nombre} className="w-14 h-14 rounded-xl object-cover" />
      <div className="min-w-0">
        <div className="font-bold truncate">{f.nombre}</div>
        <div className="text-sm text-slate-600">{f.ciudad} • ⭐ {f.rating}</div>
        <div className="text-xs text-blue-700">Ver perfil</div>
      </div>
    </Link>
  );
}

/* ---------- Normalizadores para tu SQL real ---------- */
const FALLBACK_EVENT_IMG = 'https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?q=80&w=1600&auto=format&fit=crop';

function normEvent(row){
  const nombre = row.nombre || row.name || row.titulo || 'Evento';
  const fecha = row.fecha || row.date || row.event_date || row.dia;
  const lugar = row.lugar || row.place || row.ubicacion || '';
  const ruta  = row.ruta  || row.route || '';
  const cover = row.cover || row.cover_url || row.portada || (Array.isArray(row.covers)? row.covers[0] : null) || FALLBACK_EVENT_IMG;
  const fotCount = row.fotografos_count || row.photographers_count || (row.fotografos?.length ?? row.photographers?.length);
  const fechaLabel = fecha ? new Date(fecha).toLocaleDateString('es-GT',{weekday:'short', day:'2-digit', month:'short'}) : '';
  return { id: row.id, nombre, fecha, fechaLabel, lugar, ruta, cover, fotCount };
}

function normPhotographer(row){
  const nombre = row.nombre || row.name || row.studio || row.studio_name || 'Fotógrafo';
  const ciudad = row.ciudad || row.city || row.ubicacion || 'Guatemala';
  const rating = row.rating || row.calificacion || 4.8;
  const avatar = row.avatar || row.avatar_url || row.foto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=400&auto=format&fit=crop';
  return { id: row.id, nombre, ciudad, rating, avatar };
}

/* ---------- Fetch a Supabase (tablas flex) ---------- */
async function fetchFirstExisting(tableNames, select='*', filters=()=>({})){
  for (const t of tableNames){
    const q = supabase.from(t).select(select);
    const prepared = filters(q) || q;
    const { data, error } = await prepared;
    if (!error && Array.isArray(data)) return data;
  }
  return [];
}

export default function Home(){
  const [evs, setEvs] = useState([]);
  const [phs, setPhs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Píldoras compactas
  const pills = useMemo(() => ([
    {label:'Búsqueda por placa',tip:'IA que te encuentra al toque'},
    {label:'Galerías HD',tip:'Listas para IG y portadas'},
    {label:'Pagos seguros',tip:'Sin clavos y rapidito'}
  ]), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Eventos (probamos varias tablas comunes)
        const rawEvents = await fetchFirstExisting(
          ['events','event','evento','eventos'],
          '*',
          (q)=> q.limit(8)
        );
        const events = rawEvents.map(normEvent);

        // Fotógrafos destacados
        const rawPhotogs = await fetchFirstExisting(
          ['photographers','fotografos','photographer','users'],
          '*',
          (q)=> q.limit(6)
        );
        const photogs = rawPhotogs.map(normPhotographer);

        if (alive){
          setEvs(events);
          setPhs(photogs);
        }
      } catch (e) {
        // fallback silencioso
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Respaldo en caso no haya datos
  const fallbackEventos = [
    { id: 'evt-1', nombre: 'Domingo Carretera a El Salvador', fechaLabel: 'dom, 07 sep', lugar: 'Km 18 CA-1', cover: FALLBACK_EVENT_IMG, fotCount: 12 },
    { id: 'evt-2', nombre: 'Ruta a Antigua', fechaLabel: 'dom, 14 sep', lugar: 'Obelisco', cover: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?q=80&w=1600&auto=format&fit=crop', fotCount: 10 },
    { id: 'evt-3', nombre: 'Nocturna en la Reforma', fechaLabel: 'sáb, 20 sep', lugar: 'Zona 10', cover: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?q=80&w=1600&auto=format&fit=crop', fotCount: 9 },
    { id: 'evt-4', nombre: 'Enduro San Lucas', fechaLabel: 'dom, 28 sep', lugar: 'San Lucas', cover: 'https://images.unsplash.com/photo-1493247035880-efdf54f3fa6f?q=80&w=1600&auto=format&fit=crop', fotCount: 7 },
  ];
  const fallbackPhs = [
    { id: 'ph-1', nombre: 'Studio Cobra', ciudad: 'Guatemala', rating: 4.9, avatar: 'https://images.unsplash.com/photo-1544006659-f0b21884ce1d?q=80&w=400&auto=format&fit=crop' },
    { id: 'ph-2', nombre: 'La Ceiba Photos', ciudad: 'Antigua', rating: 4.7, avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=400&auto=format&fit=crop' },
    { id: 'ph-3', nombre: 'MotoZoom GT', ciudad: 'Mixco', rating: 4.8, avatar: 'https://images.unsplash.com/photo-1529665253569-6d01c0eaf7b6?q=80&w=400&auto=format&fit=crop' },
  ];

  const eventos = (evs && evs.length ? evs : fallbackEventos);
  const fotografos = (phs && phs.length ? phs : fallbackPhs);

  return (
    <main className="bg-gradient-to-b from-white to-slate-50">
      {/* ===== HERO con slider ===== */}
      <section className="relative">
        <div className="absolute inset-0 -z-10">
          <div className="h-[520px] bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.18),transparent_60%)]" />
        </div>

        <div className="container-max px-5 pt-10 mx-auto grid lg:grid-cols-[1.05fr_.95fr] gap-7 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              Nuevo: búsqueda por placa con IA
            </div>

            <h1 className="mt-3 text-4xl md:text-6xl font-black leading-tight tracking-tight">
              Tus <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-400">mejores rodadas</span> en fotos brutales
            </h1>

            <p className="text-slate-700 text-lg mt-3">
              Encontrá tus fotos por evento, apoyá a los fotógrafos chapines y revive cada curva como si todavía la fueras trazando. Dale viaje. 💨
            </p>

            <div className="flex gap-3 mt-5 flex-wrap">
              <Link to="/eventos" className="px-5 py-3 rounded-xl bg-blue-600 text-white font-bold">
                Ver eventos
              </Link>
              <Link to="/fotografos" className="px-5 py-3 rounded-xl bg-white border border-slate-200 font-bold">
                Explorar fotógrafos
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-600">
              <span className="px-3 py-1.5 rounded-full bg-white border border-slate-200">+1,500 fotos por domingo</span>
              <span className="px-3 py-1.5 rounded-full bg-white border border-slate-200">+20 fotógrafos activos</span>
              <span className="px-3 py-1.5 rounded-full bg-white border border-slate-200">Entrega en HD</span>
            </div>
          </div>

          <HeroSlider />
        </div>

        {/* Pills / beneficios rápidos */}
        <div className="container-max px-5 mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {pills.map(p => (
            <div key={p.label} className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
              <div className="font-semibold">{p.label}</div>
              <div className="text-xs text-slate-500">{p.tip}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== ¿Cómo funciona? (igual que dejamos) ===== */}
      <section className="container-max px-5 mt-12">
        <SectionTitle
          title="¿Cómo funciona?"
          subtitle="Tranquilo, patojo. Aquí la jugada, paso a paso:"
        />
        <div className="grid md:grid-cols-5 gap-4 mt-4">
          {[
            {n:1,t:'Salí a rodar',d:'Anotá tu hora de salida y de llegada (ida y vuelta). Así luego ubicás tu evento de un solo.',icon:
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-blue-600"><path fill="currentColor" d="M6 3v18H4V3h2Zm3 2h7l1 2h3v9h-7l-1-2H9V5Z"/></svg>},
            {n:2,t:'Esperá las fotos',d:'Los fotógrafos suben el contenido al ratito. Vos relax, nosotros te avisamos.',icon:
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-blue-600"><path fill="currentColor" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm1 5h-2v6l4 2 1-1-3-1.5V7Z"/></svg>},
            {n:3,t:'Buscá el evento',d:'Domingos, nocturnas y más. Filtrás por fecha o lugar pa’ llegar directo.',icon:
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-blue-600"><path fill="currentColor" d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7Zm0 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>},
            {n:4,t:'Encontrá tus fotos',d:'Usá la IA y filtros (placa, moto, colores) para cacharte en segundos.',icon:
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-blue-600"><path fill="currentColor" d="M12 2l2.5 4.5L20 9l-3.5 3.5L18 18l-6-2.5L6 18l1.5-5.5L4 9l5.5-2.5L12 2Z"/></svg>},
            {n:5,t:'Comprá y descargá',d:'Pagá seguro y bajá tus fotos en HD de volada. ¡Listo para presumir!',icon:
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-blue-600"><path fill="currentColor" d="M12 3v10l3-3 1.4 1.4L12 17.8 7.6 11.4 9 10l3 3V3h0Zm-7 14h14v2H5v-2Z"/></svg>},
          ].map(s=>(
            <div key={s.n} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black text-blue-600">{s.n}</span>
                {s.icon}
              </div>
              <div className="font-bold mt-2">{s.t}</div>
              <div className="text-slate-600 text-sm">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Eventos (desde SQL si hay) ===== */}
      <section className="container-max px-5 mt-12">
        <SectionTitle
          title="Eventos"
          subtitle="Lo que se viene para dominguear rico."
          right={<Link to="/eventos" className="text-blue-700 font-bold">Ver eventos</Link>}
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {eventos.map(e => <CardEvento key={e.id || e.nombre} e={e} />)}
        </div>
      </section>

      {/* ===== Fotógrafos destacados (desde SQL si hay) ===== */}
      <section className="container-max px-5 mt-12">
        <SectionTitle
          title="Fotógrafos destacados"
          subtitle="Cracks que te van a sacar en tu mejor ángulo."
          right={<Link to="/fotografos" className="text-blue-700 font-bold">Explorar</Link>}
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {fotografos.map(f => <CardFotografo key={f.id || f.nombre} f={f} />)}
        </div>
      </section>

      {/* ===== CTA final ===== */}
      <section className="container-max px-5 mt-12 mb-16">
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 text-white p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-2xl font-black">¿Listo para buscar tus fotos?</div>
            <div className="text-white/85">Entrá a tu cuenta o uníte como fotógrafo.</div>
          </div>
          <div className="flex gap-3">
            <Link to="/login" className="px-4 py-2 rounded-xl bg-white text-blue-700 font-bold">Iniciar sesión</Link>
            <Link to="/login-fotografo" className="px-4 py-2 rounded-xl border border-white/40 font-bold">Soy fotógrafo</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
