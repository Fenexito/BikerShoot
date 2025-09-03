import React from 'react'
import { Link } from 'react-router-dom'

// Mock: Próximos eventos y fotógrafos destacados (front only por ahora)
const MOCK_EVENTOS = [
  { id: 'evt-1', nombre: 'Domingo Carretera a El Salvador', fecha: 'Dom 7 Sep · 7:00 AM', lugar: 'Km 18 CA-1', cover: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?q=80&w=1600&auto=format&fit=crop' },
  { id: 'evt-2', nombre: 'Ruta a Antigua', fecha: 'Dom 14 Sep · 7:00 AM', lugar: 'Obelisco', cover: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?q=80&w=1600&auto=format&fit=crop' },
  { id: 'evt-3', nombre: 'Nocturna en la Reforma', fecha: 'Sáb 20 Sep · 8:00 PM', lugar: 'Zona 10', cover: 'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?q=80&w=1600&auto=format&fit=crop' },
  { id: 'evt-4', nombre: 'Enduro San Lucas', fecha: 'Dom 28 Sep · 6:30 AM', lugar: 'San Lucas', cover: 'https://images.unsplash.com/photo-1493247035880-efdf54f3fa6f?q=80&w=1600&auto=format&fit=crop' },
];

const MOCK_FOTOGRAFOS = [
  { id: 'ph-1', nombre: 'Studio Cobra', ciudad: 'Guatemala', rating: 4.9, avatar: 'https://images.unsplash.com/photo-1544006659-f0b21884ce1d?q=80&w=400&auto=format&fit=crop' },
  { id: 'ph-2', nombre: 'La Ceiba Photos', ciudad: 'Antigua', rating: 4.7, avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=400&auto=format&fit=crop' },
  { id: 'ph-3', nombre: 'MotoZoom GT', ciudad: 'Mixco', rating: 4.8, avatar: 'https://images.unsplash.com/photo-1529665253569-6d01c0eaf7b6?q=80&w=400&auto=format&fit=crop' },
  { id: 'ph-4', nombre: 'Eclipse Shots', ciudad: 'Villa Nueva', rating: 4.6, avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=400&auto=format&fit=crop' },
  { id: 'ph-5', nombre: 'Ruta 502', ciudad: 'Chimaltenango', rating: 4.8, avatar: 'https://images.unsplash.com/photo-1542156822-6924d1a71ace?q=80&w=400&auto=format&fit=crop' },
  { id: 'ph-6', nombre: 'Veloz Studio', ciudad: 'Amatitlán', rating: 4.7, avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop' },
];

// UI helpers locales (evitamos crear más archivos)
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
        <div className="text-sm text-slate-500">{e.fecha}</div>
        <div className="font-bold">{e.nombre}</div>
        <div className="text-sm text-slate-600">{e.lugar}</div>
        <div className="mt-3">
          <span className="inline-block text-xs font-semibold px-2 py-1 rounded bg-blue-50 text-blue-700"># fotógrafos: 12</span>
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

export default function Home(){
  const pills = ['Descarga en HD','Pago seguro','Perfiles verificados','Eventos cada semana'];

  return (
    <main>
      {/* HERO (se queda, pero con tweaks) */}
      <section className='grid lg:grid-cols-[1.1fr_.9fr] gap-7 items-center container-max px-5 pt-10 mx-auto'>
        <div>
          <h1 className='text-4xl md:text-6xl font-black leading-tight'>
            Fotos épicas de tus <span className='text-blue-600'>rodadas</span>
          </h1>
          <p className='text-slate-600 text-lg mt-2'>Encuentra tus fotos por evento, apoya a fotógrafos locales y revive cada curva.</p>
          <div className='flex gap-3 mt-4 flex-wrap'>
            <Link to='/eventos' className='px-4 py-2 rounded-xl bg-blue-600 text-white font-bold'>Ver próximos eventos</Link>
            <Link to='/fotografos' className='px-4 py-2 rounded-xl bg-white border border-slate-200 font-bold'>Explorar fotógrafos</Link>
          </div>
          <div className='mt-3 text-sm font-bold'>
            <span className='text-slate-500'>¿ERES FOTÓGRAFO?</span>{' '}
            <Link to='/login-fotografo' className='text-blue-600 underline'>INICIA SESIÓN AQUÍ</Link>
          </div>
        </div>
        <div className='bg-white rounded-2xl shadow-lg overflow-hidden'>
          <img className='md:h-[360px] h-48 w-full object-cover' alt='Biker' src='https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?q=80&w=1600&auto=format&fit=crop'/>
        </div>
      </section>
<<<<<<< HEAD

      {/* Pills */}
=======
>>>>>>> acdfd865856c4cf70e29c8d8b13157661142bfde
      <div className='container-max grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 px-5 mt-4'>
        {pills.map(p => <div key={p} className='bg-white border border-slate-200 rounded-full px-4 py-3 text-center font-semibold'>{p}</div>)}
      </div>

      {/* Cómo funciona */}
      <section className="container-max px-5 mt-10">
        <SectionTitle
          title="¿Cómo funciona?"
          subtitle="Es más fácil que pelar bananos, vos. Tres pasitos:"
        />
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          {[
            {t:'Elegí el evento',d:'Domingos, nocturnas y más. Buscá por fecha o lugar.'},
            {t:'Encontrá tu placa',d:'Filtros por número de placa o por motocicleta.'},
            {t:'Comprá y descarga',d:'Pagá seguro y bajá tus fotos en HD de volada.'},
          ].map((x,i)=>(
            <div key={x.t} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-3xl font-black text-blue-600">{i+1}</div>
              <div className="font-bold mt-1">{x.t}</div>
              <div className="text-slate-600 text-sm">{x.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Próximos eventos (preview) */}
      <section className="container-max px-5 mt-10">
        <SectionTitle
          title="Próximos eventos"
          subtitle="Lo que se viene para dominguear rico."
          right={<Link to="/eventos" className="text-blue-700 font-bold">Ver todos</Link>}
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {MOCK_EVENTOS.map(e => <CardEvento key={e.id} e={e} />)}
        </div>
      </section>

      {/* Fotógrafos destacados */}
      <section className="container-max px-5 mt-10">
        <SectionTitle
          title="Fotógrafos destacados"
          subtitle="Cracks que te van a sacar en tu mejor ángulo."
          right={<Link to="/fotografos" className="text-blue-700 font-bold">Explorar</Link>}
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {MOCK_FOTOGRAFOS.map(f => <CardFotografo key={f.id} f={f} />)}
        </div>
      </section>

      {/* Testimonios cortos */}
      <section className="container-max px-5 mt-12">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {q:'“Compré mis fotos de la Antigua y salieron perrisísimas.”',a:'— Kevin, Pulsar 200'},
            {q:'“Fácil de usar y las fotos de 10/10, calidad brutal.”',a:'— Gaby, R3'},
            {q:'“Me encontraron por placa. Ni tuve que buscar mucho.”',a:'— Checha, CB190'},
          ].map((t)=>(
            <div key={t.q} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-slate-800">{t.q}</div>
              <div className="text-slate-500 text-sm mt-2">{t.a}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA doble */}
      <section className="container-max px-5 mt-12 mb-16">
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 text-white p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-2xl font-black">¿Listo para salir en las fotos?</div>
            <div className="text-white/85">Explorá eventos o uníte como fotógrafo.</div>
          </div>
          <div className="flex gap-3">
            <Link to="/eventos" className="px-4 py-2 rounded-xl bg-white text-blue-700 font-bold">Ver eventos</Link>
            <Link to="/login-fotografo" className="px-4 py-2 rounded-xl border border-white/40 font-bold">Soy fotógrafo</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
