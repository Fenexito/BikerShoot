import React from 'react'
export default function Footer(){
  return (
    <footer className='mt-20'>
      <div className='h-14 bg-blue-600' />
      <div className='bg-[#0f1115] text-slate-200'>
        <div className='container-max px-5 py-10'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-white/10'>
            <div className='flex items-center gap-3'>
              <span className='w-8 h-8 bg-white rounded'/>
              <span className='text-xl font-bold'>MotoShots</span>
            </div>
            <div className='flex gap-2'>
              {[1,2,3,4].map(i => <a key={i} href='#' className='w-9 h-9 grid place-items-center rounded-xl bg-white/5'><span className='w-4 h-4 block bg-white/80 rounded-sm'/></a>)}
            </div>
          </div>
          <div className='grid md:grid-cols-4 gap-7 py-8'>
            <div>
              <h4 className='font-semibold text-lg mb-3'>Learn more</h4>
              <ul className='space-y-2 text-slate-300/90'>
                {['MotoShots para Organizadores','Top Agencias 2025','Directorio de Fotógrafos','Precios','Blog','Programa de Referidos','Tienda','Recursos'].map(x => <li key={x}><a href='#' className='hover:underline'>{x}</a></li>)}
              </ul>
            </div>
            <div>
              <h4 className='font-semibold text-lg mb-3'>Legal</h4>
              <ul className='space-y-2 text-slate-300/90'>
                {['Términos de servicio','Política de privacidad','Aviso de cookies','Reportar una violación','Estándares de comunidad'].map(x => <li key={x}><a href='#' className='hover:underline'>{x}</a></li>)}
              </ul>
            </div>
            <div>
              <h4 className='font-semibold text-lg mb-3'>MotoShots</h4>
              <ul className='space-y-2 text-slate-300/90'>
                {['Sobre nosotros','Empleos','Help Center'].map(x => <li key={x}><a href='#' className='hover:underline'>{x}</a></li>)}
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
