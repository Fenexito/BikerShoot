import React, { useEffect } from 'react'
import { Routes, Route, Outlet, useLocation, useNavigate } from 'react-router-dom'
import HeaderPublic from './components/HeaderPublic.jsx'
import HeaderUser from './components/HeaderUser.jsx'
import HeaderStudio from './components/HeaderStudio.jsx'
import Footer from './components/Footer.jsx'
import { CartProvider, useCart } from './state/CartContext.jsx'
import Drawer from './components/ui/Drawer.jsx'
import ModalHost from './components/ui/Modal.jsx'
import Toaster from './components/ui/Toaster.jsx'
import { isAuthPath, isUserPortal, isStudioPortal, isDarkRoute } from './lib/utils.js'
import ApprovePhotographer from './admin/ApprovePhotographer.jsx';
import SetPassword from './auth/SetPassword.jsx';
import RequireAdmin from './components/RequireAdmin.jsx'
import AdminLayout from './admin/AdminLayout.jsx'
import AdminMain from './admin/AdminMain.jsx'
import AdminRoutesEditor from './admin/AdminRoutesEditor.jsx'
import AdminMagicLink from './admin/AdminMagicLink.jsx'

// Pages (public)
import Home from './publico/Home.jsx'
import Login from './publico/Login.jsx'
import LoginPhotographer from './publico/LoginPhotographer.jsx'
import Signup from './publico/Signup.jsx'
import PhotographerLanding from './publico/PhotographerLanding.jsx'
import Events from './publico/Events.jsx'
import Photographers from './publico/Photographers.jsx'

// Biker portal
import BikerHome from './routes/biker/index.jsx'
import BikerHistory from './routes/biker/history.jsx'
import BikerSearch from './routes/biker/Search/Search.jsx'
import BikerSearchSetup from './routes/biker/Search/SearchSetup.jsx';
import SearchByPhotographer from './routes/biker/Search/SearchByPhotographer.jsx';
import SearchByPoint from './routes/biker/Search/SearchByPoint.jsx';
import BikerPhotographers from './routes/biker/photographers.jsx'
import BikerPhotographerDetail from "./routes/biker/photographer"
import BikerEvent from "./routes/biker/Event.jsx"
import BikerProfile from './routes/biker/BikerProfile.jsx'
import Checkout from './routes/biker/Checkout.jsx'
import BikerOrderDetail from './routes/biker/order.jsx' // ← NUEVO

// Studio portal
import StudioHome from './routes/photographer/index.jsx'
import StudioEventos from './routes/photographer/Eventos.jsx'
import EventoEditor from './routes/photographer/EventoEditor.jsx'
import StudioPedidos from './routes/photographer/Orders.jsx'
import OrderDetail from './routes/photographer/OrderDetail.jsx'
import StudioEstadisticas from './routes/photographer/Estadisticas.jsx'
import StudioPerfil from './routes/photographer/PhotographerProfile.jsx'
import StudioCargaRapida from './routes/photographer/CargaRapida.jsx'

// 🧩 store del toaster para disparar desde acá (mismo que usa tu Toaster.jsx)
import { useToast } from './state/ui.jsx'

function LayoutShell(){
  const loc = useLocation()
  const navigate = useNavigate()
  const path = loc.pathname
  const dark = isDarkRoute(path)
  const hideChrome = isAuthPath(path)
  const userPortal = isUserPortal(path)
  const studioPortal = isStudioPortal(path)
  const adminPortal = path.startsWith('/admin')
  const bg = dark ? 'bg-studio-bg text-slate-100' : 'bg-slate-50'

  // Acceso al store del toaster (mismo que renderiza <Toaster/>)
  const toastApi = useToast()
  // detectar método disponible en tu store (push/add/show/success)
  const emitToast = (payload) => {
    const { push, add, show, success } = toastApi || {}
    if (payload?.type === 'success' && typeof success === 'function' && !payload.description) {
      success(payload.title || 'Operación exitosa')
      return
    }
    const fn = push || add || show
    fn?.(payload)
  }

  // Lee ?logout=1 y ?login=1 y dispara toasts con tu Toaster global
  useEffect(() => {
    const sp = new URLSearchParams(loc.search)
    let changed = false

    if (sp.get('logout') === '1') {
      emitToast({
        id: 'auth-logout',
        type: 'success',
        title: 'Sesión cerrada con éxito',
        description: '¡Nos miramos pronto!',
        position: 'top' // tu Toaster pinta todo lo que no sea "bottom" arriba-derecha
      })
      sp.delete('logout')
      changed = true
    }

    if (sp.get('login') === '1') {
      emitToast({
        id: 'auth-login',
        type: 'success',
        title: '¡Bienvenido de vuelta!',
        description: 'Sesión iniciada correctamente.',
        position: 'top'
      })
      sp.delete('login')
      changed = true
    }

    if (changed) {
      navigate({ pathname: loc.pathname, search: sp.toString() }, { replace: true })
    }
  }, [loc.pathname, loc.search]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={'min-h-screen ' + bg}>
      {!hideChrome && !adminPortal && (userPortal ? <HeaderUser/> : studioPortal ? <HeaderStudio/> : <HeaderPublic/>)}
      <Outlet />
      {!hideChrome && !userPortal && !studioPortal && !adminPortal && <Footer/>}
      {userPortal && <CartDrawer/>}
      <ModalHost dark={dark} />
      <Toaster dark={dark} />
    </div>
  )
}

function CartDrawer(){
  const { open, setOpen, items, removeItem, total } = useCart()
  return (
    <Drawer open={open} onClose={()=>setOpen(false)} side='right'>
      <div className='flex items-center justify-between p-4 border-b'>
        <h3 className='font-black text-lg'>Tu carrito</h3>
        <button onClick={()=>setOpen(false)} className='w-9 h-9 grid place-items-center rounded-lg border'>✕</button>
      </div>
      <div className='p-4 space-y-3 overflow-auto h-[calc(100%-160px)]'>
        {items.length===0 && <div className='text-slate-500'>Tu carrito está vacío.</div>}
        {items.map(it => (
          <div key={it.id} className='flex items-center gap-3 border rounded-xl p-3'>
            <div className='w-16 h-16 bg-slate-200 rounded-lg overflow-hidden'><img src={it.img} alt='' className='w-full h-full object-cover'/></div>
            <div className='flex-1'><div className='font-semibold'>{it.name}</div><div className='text-sm text-slate-500'>x{it.qty||1}</div></div>
            <div className='font-bold'>${(it.price*(it.qty||1)).toFixed(2)}</div>
            <button onClick={()=>removeItem(it.id)} className='w-9 h-9 grid place-items-center rounded-lg border'>✕</button>
          </div>
        ))}
      </div>
      <div className='p-4 border-t'>
        <div className='flex items-center justify-between font-bold text-lg'><span>Total</span><span>${total.toFixed(2)}</span></div>
        <a href='/app/checkout' className='block text-center mt-3 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold'>Ir al checkout</a>
      </div>
    </Drawer>
  )
}

export default function App(){
  return (
    <CartProvider>
      <Routes>
        <Route element={<LayoutShell/>}>
          {/* públicas */}
          <Route index element={<Home/>}/>
          <Route path='/login' element={<Login/>}/>
          <Route path='/login-fotografo' element={<LoginPhotographer/>}/>
          <Route path='/signup' element={<Signup/>}/>
          <Route path='/eres-fotografo' element={<PhotographerLanding/>}/>
          <Route path='/fotografos' element={<Photographers/>}/>
          <Route path='/eventos' element={<Events/>}/>
          {/* portal biker */}
          <Route path='/app' element={<BikerHome/>}/>
          <Route path='/app/historial' element={<BikerHistory/>}/>
          <Route path='/app/historial/:id' element={<BikerOrderDetail/>}/> {/* ← NUEVA */}
          <Route path='/app/eventos/:id' element={<BikerEvent/>}/> {/* ← NUEVA (placeholder evento) */}
          <Route path='/app/buscar/configurar' element={<BikerSearchSetup/>}/>
          <Route path='/app/buscar' element={<BikerSearch/>}/>
          <Route path='/app/buscar/por-fotografo' element={<SearchByPhotographer/>}/>
          <Route path='/app/buscar/por-punto' element={<SearchByPoint/>}/>
          <Route path='/app/fotografos' element={<BikerPhotographers/>}/>
          <Route path="/app/fotografos/:id" element={<BikerPhotographerDetail />} />
          <Route path='/app/perfil' element={<BikerProfile/>}/>
          <Route path='/app/checkout' element={<Checkout/>}/>
          {/* ADMIN (protegido) */}
          <Route path='/admin' element={<RequireAdmin><AdminLayout/></RequireAdmin>}>
            <Route index element={<AdminMain/>}/>
            <Route path='rutas' element={<AdminRoutesEditor/>}/>
            <Route path='magic-link' element={<AdminMagicLink/>}/>
            <Route path='aprobar-fotografo' element={<ApprovePhotographer/>}/>
            {/* Opciones pendientes (placeholders) */}
            <Route path='opcion-a' element={<AdminMain pending="Opción A pendiente"/>}/>
            <Route path='opcion-b' element={<AdminMain pending="Opción B pendiente"/>}/>
            <Route path='opcion-c' element={<AdminMain pending="Opción C pendiente"/>}/>
          </Route>
          {/* portal fotógrafo */}
          <Route path='/set-password' element={<SetPassword/>}/>
          <Route path='/studio' element={<StudioHome/>}/>
          <Route path='/studio/eventos' element={<StudioEventos/>}/>
          <Route path='/studio/eventos/:id' element={<EventoEditor/>}/>
          <Route path='/studio/pedidos' element={<StudioPedidos/>}/>
          <Route path='/studio/pedidos/:id' element={<OrderDetail/>}/>
          <Route path='/studio/estadisticas' element={<StudioEstadisticas/>}/>
          <Route path='/studio/perfil' element={<StudioPerfil/>}/>
          <Route path='/studio/carga-rapida' element={<StudioCargaRapida/>}/>
        </Route>
      </Routes>
    </CartProvider>
  )
}
