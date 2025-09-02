import React from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../state/CartContext.jsx'

export default function Home(){
  const pills = ['Descarga en HD','Pago seguro','Perfiles verificados','Eventos cada semana']
  return (
    <main>
      <section className='grid lg:grid-cols-[1.1fr_.9fr] gap-7 items-center container-max px-5 pt-10 mx-auto'>
        <div>
          <h1 className='text-4xl md:text-6xl font-black leading-tight'>Fotos épicas de tus <span className='text-blue-600'>rodadas</span></h1>
          <p className='text-slate-600 text-lg mt-2'>Encuentra tus fotos por evento, apoya a fotógrafos locales y revive cada curva.</p>
          <div className='flex gap-3 mt-4 flex-wrap'>
            <Link to='/eventos' className='px-4 py-2 rounded-xl bg-blue-600 text-white font-bold'>Ver próximos eventos</Link>
            <Link to='/fotografos' className='px-4 py-2 rounded-xl bg-white border border-slate-200 font-bold'>Explorar fotógrafos</Link>
          </div>
          <div className='mt-3 text-sm font-bold'><span className='text-slate-500'>¿ERES FOTÓGRAFO?</span> <Link to='/login-fotografo' className='text-blue-600 underline'>INICIA SESIÓN AQUÍ</Link></div>
        </div>
        <div className='bg-white rounded-2xl shadow-lg overflow-hidden'>
          <img className='md:h-[360px] h-48 w-full object-cover' alt='Biker' src='https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?q=80&w=1600&auto=format&fit=crop'/>
        </div>
      </section>
      <div className='container-max grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 px-5 mt-4'>
        {pills.map(p => <div key={p} className='bg-white border border-slate-200 rounded-full px-4 py-3 text-center font-semibold'>{p}</div>)}
      </div>
    </main>
  )
}
