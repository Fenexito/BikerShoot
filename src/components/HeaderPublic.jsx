import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function HeaderPublic(){
  const [open, setOpen] = useState(false)
  return (
    <header className='sticky top-4 z-50 px-4'>
      <div className='bg-white text-slate-900 rounded-2xl shadow-lg'>
        <div className='container-max flex h-[72px] items-center gap-4 px-5'>
          <Link to='/' className='flex items-center gap-2 font-extrabold'>
            <span className='w-8 h-8 rounded bg-blue-600 inline-block'/> MotoShots
          </Link>
          <div className={`ml-auto lg:ml-0 lg:flex-1 ${open ? 'absolute top-full left-0 w-full bg-white' : 'hidden'} lg:static lg:block lg:w-auto lg:bg-transparent`}>
            <nav>
              <ul className='flex flex-col lg:flex-row lg:justify-center gap-2 lg:gap-7 font-semibold'>
                <li><Link to='/' className='px-2 py-2 rounded-lg text-slate-800/80 hover:text-slate-900'>Inicio</Link></li>
                <li><Link to='/fotografos' className='px-2 py-2 rounded-lg text-slate-800/80 hover:text-slate-900'>Fotógrafos</Link></li>
                <li><Link to='/eventos' className='px-2 py-2 rounded-lg text-slate-800/80 hover:text-slate-900'>Eventos</Link></li>
                <li><Link to='/precios' className='px-2 py-2 rounded-lg text-slate-800/80 hover:text-slate-900'>Precios</Link></li>
                <li><Link to='/eres-fotografo' className='text-white px-3 py-2 rounded-lg bg-blue-600/90 hover:bg-blue-700 lg:ml-4'>¿Eres fotógrafo?</Link></li>
              </ul>
            </nav>
          </div>
          <div className='hidden lg:flex items-center gap-3'>
            <Link to='/login' className='px-4 py-2 rounded-xl border border-slate-200 font-bold bg-white'>Iniciar Sesión</Link>
            <Link to='/signup' className='px-4 py-2 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700'>Crear Cuenta Gratis</Link>
          </div>
          <button aria-label='Menu' onClick={()=>setOpen(!open)} className='lg:hidden grid place-items-center w-10 h-10 rounded-lg border border-slate-200 bg-white'>≡</button>
        </div>
      </div>
    </header>
  )
}