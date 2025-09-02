import React from 'react'
import { Link } from 'react-router-dom'
export default function PhotographerLanding(){
  return (<main className='bg-studio-bg text-slate-100'>
    <section className='grid lg:grid-cols-[1.1fr_.9fr] gap-7 items-center container-max px-5 pt-10 mx-auto'>
      <div>
        <h1 className='text-4xl md:text-6xl font-black leading-tight'>Vende tus <span className='text-blue-500'>fotos</span> por evento</h1>
        <p className='text-slate-300 text-lg mt-2'>Publica galerías por placa, recibe pagos y construye tu marca.</p>
        <div className='flex gap-3 mt-4 flex-wrap'><Link to='/signup-fotografo' className='px-4 py-2 rounded-xl bg-blue-600 text-white font-bold'>Crear cuenta</Link><Link to='/login-fotografo' className='px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-bold'>Iniciar sesión</Link></div>
      </div>
      <div className='rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,.6)] bg-studio-panel h-[360px]' />
    </section>
  </main>)
}