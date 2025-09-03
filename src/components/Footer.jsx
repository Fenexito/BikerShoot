import React from 'react'
import { Link } from 'react-router-dom'

export default function Footer(){
  return (
    <footer className='mt-20'>
      <div className='h-14 bg-blue-600' />
      <div className='bg-[#0f1115] text-slate-200'>
        <div className='container-max px-5 py-10'>

          {/* Top bar */}
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-white/10'>
            <div className='flex items-center gap-3'>
              <span className='w-8 h-8 bg-white rounded'/>
              <span className='text-xl font-bold'>MotoShots</span>
            </div>
            <div className='flex gap-2'>
              {[1,2,3,4].map(i => <a key={i} href='#' className='w-9 h-9 grid place-items-center rounded-xl bg-white/5'><span className='w-4 h-4 block bg-white/80 rounded-sm'/></a>)}
            </div>
          </div>

          {/* Grids */}
          <div className='grid md:grid-cols-4 gap-7 py-8'>

            <div>
              <h4 className='font-semibold text-lg mb-3'>Explorar</h4>
              <ul className='space-y-2 text-slate-300/90'>
                <li><Link to='/eventos' className='hover:underline'>Eventos</Link></li>
                <li><Link to='/fotografos' className='hover:underline'>Directorio de Fotógrafos</Link></li>
                <li><a href='#' className='hover:underline'>MotoShots para Organizadores</a></li>
                <li><a href='#' className='hover:underline'>Top Agencias 2025</a></li>
                {/* REMOVIDO: Precios */}
                <li><a href='#' className='hover:underline'>Blog</a></li>
              </ul>
            </div>

            <div>
              <h4 className='font-semibold text-lg mb-3'>Legal</h4>
              <ul className='space-y-2 text-slate-300/90'>
                <li><a href='#' className='hover:underline'>Términos de servicio</a></li>
                <li><a href='#' className='hover:underline'>Política de privacidad</a></li>
                <li><a href='#' className='hover:underline'>Aviso de cookies</a></li>
                <li><a href='#' className='hover:underline'>Reportar una violación</a></li>
                <li><a href='#' className='hover:underline'>Estándares de comunidad</a></li>
              </ul>
            </div>

            <div>
              <h4 className='font-semibold text-lg mb-3'>MotoShots</h4>
              <ul className='space-y-2 text-slate-300/90'>
                <li><a href='#' className='hover:underline'>Sobre nosotros</a></li>
                <li><a href='#' className='hover:underline'>Empleos</a></li>
                <li><a href='#' className='hover:underline'>Help Center</a></li>
              </ul>
            </div>

            <div>
              <div className='rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-center'>
                <b className='text-base'>¿Necesitas ayuda?</b>{' '}
                <a href='mailto:soporte@motots.com' className='font-bold text-blue-300'>soporte@motots.com</a>
              </div>
              <div className='flex gap-3 justify-center mt-3'>
                <a className='flex items-center gap-2 border border-white/20 rounded-xl px-4 py-3' href='#'><span className='w-6 h-6 bg-white/80 rounded'/>App Store</a>
                <a className='flex items-center gap-2 border border-white/20 rounded-xl px-4 py-3' href='#'><span className='w-6 h-6 bg-white/80 rounded'/>Google Play</a>
              </div>
            </div>

          </div>

          <div className='text-center text-slate-400 text-sm'>MotoShots® demo • ©2025</div>
        </div>
      </div>
    </footer>
  )
}
