// src/pages/Home.jsx
import React from 'react'
import { Link } from 'react-router-dom'

// ===== Mock data (front-only por ahora) =====
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

// ===== UI helpers locales (evitamos más archivos) =====
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

// ===== Iconos inline (ligeros, estilo lucide) =====
const IconRide = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6"><path fill="currentColor" d="M5 18a3 3 0 1 1 2.83-4H11l2-3h-1a2 2 0 0 1 0-4h3l2 3h2a2 2 0 0 1 0 4h-1l-2 4H8.5A3 3 0 0 1 5 18Z"/></svg>
);
const IconClock = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6"><path fill="currentColor" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm1 5h-2v6l4 2 1-1-3-1.5V7Z"/></svg>
);
const IconMapPin = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6"><path fill="currentColor" d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7Zm0 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>
);
const IconAI = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6"><path fill="currentColor" d="M12 2l2.5 4.5L20 9l-3.5 3.5L18 18l-6-2.5L6 18l1.5-5.5L4 9l5.5-2.5L12 2Z"/></svg>
);
const IconDownload = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6"><path fill="currentColor" d="M12 3v10l3-3 1.4 1.4L12 17.8 7.6 11.4 9 10l3 3V3h0Zm-7 14h14v2H5v-2Z"/></svg>
);

// ===== Home =====
export default function Home(){
  // Replanteo de “píldoras”: más útiles para el usuario
  const pills = [
    {label:'Búsqueda por placa',tip:'IA que te encuentra hasta de reojo'},
    {label:'Galerías HD',tip:'Fotos nítidas listas para IG'},
    {label:'Pagos seguros',tip:'Compra sin clavos'}
  ];

  return (
    <main className="bg-gradient-to-b from-white to-slate-50">
      {/* ===== HERO ===== */}
      <section className="relative">
        {/* Fondo */}
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
              Encontrá tus fotos por evento, apoyá a los fotógrafos chapines y revive cada curva como si
              todavía la fueras trazando. Dale viaje. 💨
            </p>

            <div className="flex gap-3 mt-5 flex-wrap">
              <Link to="/eventos" className="px-5 py-3 rounded-xl bg-blue-600 text-white font-bold">
                Ver próximos eventos
              </Link>
              <Link to="/fotografos" className="px-5 py-3 rounded-xl bg-white border border-slate-200 font-bold">
                Explorar fotógrafos
              </Link>
            </div>

            {/* Mini métricas para pegada social */}
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-600">
              <span className="px-3 py-1.5 rounded-full bg-white border border-slate-200">+1,500 fotos por domingo</span>
              <span className="px-3 py-1.5 rounded-full bg-white border border-slate-200">+20 fotógrafos activos</span>
              <span className="px-3 py-1.5 rounded-full bg-white border border-slate-200">Entrega en HD</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl overflow-hidden ring-1 ring-slate-200">
            <img
              className="md:h-[380px] h-52 w-full object-cover"
              alt="Biker"
              src="https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?q=80&w=1600&auto=format&fit=crop"
            />
          </div>
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

      {/* ===== ¿Cómo funciona? (5 pasos) ===== */}
      <section className="container-max px-5 mt-12">
        <SectionTitle
          title="¿Cómo funciona?"
          subtitle="Tranquilo, patojo. Aquí la jugada, paso a paso:"
        />
        <div className="grid md:grid-cols-5 gap-4 mt-4">
          {/* 1 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black text-blue-600">1</span>
              <IconRide />
            </div>
            <div className="font-bold mt-2">Salí a rodar</div>
            <div className="text-slate-600 text-sm">
              Anotá tu hora de salida y de llegada (ida y vuelta). Así luego ubicás tu evento de un solo.
            </div>
          </div>
          {/* 2 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black text-blue-600">2</span>
              <IconClock />
            </div>
            <div className="font-bold mt-2">Esperá las fotos</div>
            <div className="text-slate-600 text-sm">
              Los fotógrafos suben el contenido al ratito. Vos relax, nosotros te avisamos.
            </div>
          </div>
          {/* 3 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black text-blue-600">3</span>
              <IconMapPin />
            </div>
            <div className="font-bold mt-2">Buscá el evento</div>
            <div className="text-slate-600 text-sm">
              Domingos, nocturnas y más. Filtrás por fecha o lugar pa’ llegar directo.
            </div>
          </div>
          {/* 4 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black text-blue-600">4</span>
              <IconAI />
            </div>
            <div className="font-bold mt-2">Encontrá tus fotos</div>
            <div className="text-slate-600 text-sm">
              Usá la IA y filtros (placa, moto, colores) para cacharte en segundos.
            </div>
          </div>
          {/* 5 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black text-blue-600">5</span>
              <IconDownload />
            </div>
            <div className="font-bold mt-2">Comprá y descargá</div>
            <div className="text-slate-600 text-sm">
              Pagá seguro y bajá tus fotos en HD de volada. ¡Listo para presumir!
            </div>
          </div>
        </div>
      </section>

      {/* ===== Próximos eventos (preview) ===== */}
      <section className="container-max px-5 mt-12">
        <SectionTitle
          title="Próximos eventos"
          subtitle="Lo que se viene para dominguear rico."
          right={<Link to="/eventos" className="text-blue-700 font-bold">Ver todos</Link>}
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {MOCK_EVENTOS.map(e => <CardEvento key={e.id} e={e} />)}
        </div>
      </section>

      {/* ===== Fotógrafos destacados ===== */}
      <section className="container-max px-5 mt-12">
        <SectionTitle
          title="Fotógrafos destacados"
          subtitle="Cracks que te van a sacar en tu mejor ángulo."
          right={<Link to="/fotografos" className="text-blue-700 font-bold">Explorar</Link>}
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {MOCK_FOTOGRAFOS.map(f => <CardFotografo key={f.id} f={f} />)}
        </div>
      </section>

      {/* ===== Testimonios ===== */}
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
