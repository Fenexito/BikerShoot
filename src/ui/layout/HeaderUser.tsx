import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { useBikerDetails } from '../../features/biker/useBikerDetails'
import { useCartStore } from '../../features/cart/cartStore'
import { useCartDrawerStore } from '../../features/cart/cartDrawerStore'
import { useCartSync } from '../../features/cart/useCartSync'
import { CartDrawer } from '../../features/cart/CartDrawer'
import { r2Url } from '../../lib/r2'
import { IconCart, IconImages, IconReceipt } from '../shared/icons'
import { AnimateIcon } from '../animate-icons/icon'
import { Search } from '../animate-icons/icons/Search'
import { Heart } from '../animate-icons/icons/Heart'
import { UserRound } from '../animate-icons/icons/UserRound'
import { Settings } from '../animate-icons/icons/Settings'
import { Sparkles } from '../animate-icons/icons/Sparkles'
import { LogOut } from '../animate-icons/icons/LogOut'
import { InitialsAvatar } from '../shared/InitialsAvatar'
import { ProfileMenu } from '../shared/ProfileMenu'
import { NotificationsMenu } from '../shared/NotificationsMenu'
import { MobileBottomNav } from '../shared/MobileBottomNav'
import { ThemeSwitcherInline } from '../flat/ThemeSwitcherInline'
import { useAutoHideHeader } from '../shared/useAutoHideHeader'
import { useHeaderTransformStore } from './headerTransformStore'
import { HeaderBackSlot } from '../shared/HeaderBackSlot'
import { BikerSearchModal } from '../../features/biker/components/BikerSearchModal'
import { cn } from '../../lib/cn'

// "Mapa" se quitó de aquí — ahora vive como acceso directo dentro de
// Buscar fotos (ver Search.tsx). "Pedidos" ocupa su lugar, para que el nav
// del biker tenga la misma relación de accesos que el del fotógrafo
// (Eventos/Pedidos en ambos portales).
const NAV_ITEMS = [
  { to: '/app/buscar', label: 'Buscar fotos' },
  { to: '/app/historial', label: 'Pedidos' },
  { to: '/app/eventos', label: 'Eventos' },
  { to: '/app/fotografos', label: 'Fotógrafos' },
]

export function HeaderUser() {
  const { user, profile, signOut } = useAuth()
  const { data: bikerDetails } = useBikerDetails(user?.id)
  const navigate = useNavigate()
  const itemCount = useCartStore((s) => s.items.length)
  const openCartDrawer = useCartDrawerStore((s) => s.openDrawer)
  // Sincroniza el carrito con Supabase mientras haya sesión — así el mismo
  // carrito se ve igual en el teléfono y en la computadora.
  useCartSync(user?.id)
  const [signingOut, setSigningOut] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      navigate('/')
    } finally {
      setSigningOut(false)
    }
  }

  const avatarUrl = profile?.avatar_url ? (profile.avatar_url.startsWith('http') ? profile.avatar_url : r2Url(profile.avatar_url)) : null
  const autoHidden = useAutoHideHeader()

  // Mismo mecanismo que HeaderStudio: si la página actual registró
  // contenido y señaló que ya toca mostrarlo (useHeaderTransform), TODO lo
  // que hay a la derecha del botón atrás (logo, nav, buscar, favoritos,
  // carrito, notificaciones, perfil) cede su lugar a las herramientas
  // propias de esa página, con un crossfade — el header nunca cambia de
  // tamaño ni posición, solo lo que hay adentro. Por defecto solo aplica en
  // escritorio — una página puede pedir `mobileEnabled` (ver
  // headerTransformStore) para que también aplique en móvil.
  const transformContent = useHeaderTransformStore((s) => s.content)
  const transformActive = useHeaderTransformStore((s) => s.active)
  const hideSearchTrigger = useHeaderTransformStore((s) => s.hideSearchTrigger)
  const hideCartTrigger = useHeaderTransformStore((s) => s.hideCartTrigger)
  const actionsSlot = useHeaderTransformStore((s) => s.actionsSlot)
  const mobileEnabled = useHeaderTransformStore((s) => s.mobileEnabled)
  const mobileBackSlotContent = useHeaderTransformStore((s) => s.mobileBackSlotContent)
  const suppressAutoHide = useHeaderTransformStore((s) => s.suppressAutoHide)
  const extraContent = useHeaderTransformStore((s) => s.extraContent)
  const extraActive = useHeaderTransformStore((s) => s.extraActive)
  const transformed = transformActive && transformContent != null
  const secondaryRowOpen = extraActive && extraContent != null
  // El radio de esquina se decide por si la página PUEDE llegar a extender
  // el header (trae `extraContent`) y ya está transformada — NO por si la
  // fila secundaria está abierta o cerrada en este instante. Antes cambiaba
  // junto con `secondaryRowOpen`, así que el radio "se reajustaba" visible
  // apenas terminaba la animación de abrir/cerrar; ahora es constante
  // mientras el header sigue transformado, sin importar cuántas veces se
  // abra/cierre la fila de abajo.
  const canExpand = extraContent != null
  // El auto-ocultado (bajar = esconder, subir = mostrar) aplica siempre,
  // también en páginas con `mobileEnabled` como Buscar fotos — el biker
  // quiere seguir viendo fotos sin el header/menú estorbando mientras
  // sigue bajando, y recuperarlos apenas sube un poco. `suppressAutoHide`
  // es la excepción: páginas de puro texto (ej. el detalle de un pedido)
  // no quieren que el header desaparezca nunca mientras se hace scroll.
  const hidden = suppressAutoHide ? false : autoHidden

  return (
    <>
      <div
        className={cn(
          'fixed inset-x-0 top-0 z-30 px-3 pt-3 transition-transform duration-300 md:sticky md:top-4 md:px-4 md:pt-0 md:!translate-y-0',
          hidden ? '-translate-y-[calc(100%+1rem)]' : 'translate-y-0',
        )}
      >
        {/* `bg-background` sólido (antes `bg-background/90 backdrop-blur-md`):
            con el header interactivo activo sobre una grilla de fotos de
            colores variados, la translucidez + blur se leía como una mancha
            gris/oscurecida encima de la barra en vez de un blanco limpio.
            El radio de borde pasa de `rounded-full` (pill) a `rounded-3xl`
            en cuanto el header transforma (si la página puede llegar a
            extenderlo) — y se queda ahí fijo, sin volver a cambiar cada vez
            que la fila secundaria se abre/cierra. */}
        <header
          className={cn(
            'mx-auto max-w-6xl border border-border bg-background shadow-sm transition-[border-radius] duration-300',
            transformed && canExpand ? 'rounded-3xl' : 'rounded-full',
          )}
        >
        <div className="flex h-14 items-center gap-3 px-3 md:h-16 md:gap-5 md:px-4">
          {/* La flecha de "volver" y su reemplazo móvil (si la página pidió
              uno) ocupan EXACTAMENTE el mismo hueco de 36×36 — un overlay
              encima del otro, nunca dos elementos con su propio espacio,
              así no hay ningún salto de layout al cambiar entre uno y otro. */}
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
            <div className={cn(mobileBackSlotContent && transformed && 'invisible sm:visible')}>
              <HeaderBackSlot />
            </div>
            {mobileBackSlotContent && (
              <div className={cn('absolute inset-0 flex items-center justify-center sm:hidden', !transformed && 'invisible')}>{mobileBackSlotContent}</div>
            )}
          </div>
          <div className="relative h-11 min-w-0 flex-1">
            {/* Capa normal: logo + nav + buscar/favoritos/carrito/
                notificaciones/perfil — se desvanece cuando `transformed`,
                siempre a partir de md, y también en móvil si la página pidió
                `mobileEnabled`.
                OJO: cada rama del ternario reemplaza el set COMPLETO de
                clases de opacidad/traslado (nunca las agrega encima de una
                base fija) — `cn` aquí es un simple `clsx`, SIN el merge de
                `tailwind-merge`, así que dos utilidades que apunten a la
                misma propiedad en el MISMO breakpoint (ej. `opacity-100` y
                `opacity-0` sueltos, sin prefijo `md:` en ninguna) quedan
                ambas en el string de clases a la vez, y cuál "gana" depende
                del orden interno en el que Tailwind generó el CSS, no del
                orden en el que aparecen aquí — eso es justo lo que causaba
                que en móvil (`mobileEnabled`, sin prefijo `md:` de por
                medio) se vieran las dos capas superpuestas al mismo tiempo. */}
            <div
              className={cn(
                'absolute inset-0 flex items-center gap-3 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] md:gap-5',
                transformed
                  ? mobileEnabled
                    ? 'pointer-events-none -translate-y-2.5 opacity-0'
                    : 'translate-y-0 opacity-100 md:pointer-events-none md:-translate-y-2.5 md:opacity-0'
                  : 'translate-y-0 opacity-100',
              )}
            >
              <Link to="/app" className="shrink-0 text-lg font-extrabold tracking-tight text-primary">
                MotoShots
              </Link>
              <nav className="hidden flex-1 items-center gap-1 text-sm font-medium lg:flex">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/app'}
                    className={({ isActive }) =>
                      cn(
                        'rounded-full px-3.5 py-2 transition-colors',
                        isActive ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground hover:text-foreground',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-2">
                <AnimateIcon animateOnHover animateOnTap asChild>
                  <button
                    onClick={() => setSearchOpen(true)}
                    aria-label="Buscar en tus pedidos, eventos, fotógrafos y rutas"
                    title="Buscar"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-border"
                  >
                    <Search size={20} />
                  </button>
                </AnimateIcon>
                <AnimateIcon animateOnHover animateOnTap asChild>
                  <Link
                    to="/app/favoritos"
                    aria-label="Favoritos"
                    title="Favoritos"
                    className="hidden h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-border sm:flex"
                  >
                    <Heart size={20} />
                  </Link>
                </AnimateIcon>
                <button
                  data-cart-icon
                  onClick={openCartDrawer}
                  aria-label="Carrito"
                  title="Carrito"
                  className="relative hidden h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-border md:flex"
                >
                  <IconCart className="h-5 w-5" />
                  {itemCount > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                      {itemCount}
                    </span>
                  )}
                </button>
                <NotificationsMenu />
                <div className="hidden md:block">
                  <ProfileMenu
                    name={profile?.display_name ?? 'Biker'}
                    email={user?.email}
                    avatar={
                      avatarUrl ? (
                        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <InitialsAvatar name={profile?.display_name ?? 'B'} className="h-full w-full bg-primary text-sm text-white" />
                      )
                    }
                    editProfile={
                      bikerDetails && (!bikerDetails.city || !bikerDetails.moto_brand)
                        ? { label: 'Completar perfil', to: '/app/perfil' }
                        : undefined
                    }
                    themeSwitcher={<ThemeSwitcherInline />}
                    sections={[
                      [
                        { to: '/app/perfil', label: 'Mi perfil', icon: <UserRound size={16} /> },
                        { to: '/app/historial', label: 'Mis compras', icon: <IconCart className="h-4 w-4" /> },
                        { to: '/app/favoritos', label: 'Favoritos', icon: <Heart size={16} /> },
                      ],
                      [
                        // Mismo lugar/patrón que en el menú del fotógrafo —
                        // acá vive en la misma página que "Mi perfil"
                        // (BikerProfilePage ya combina perfil+cuenta+
                        // notificaciones bajo el título "Configuración"),
                        // pero antes no había NINGÚN acceso a ella con ese
                        // nombre desde este menú.
                        { to: '/app/perfil', label: 'Configuración', icon: <Settings size={16} /> },
                        { to: '/changelog', label: 'Novedades', icon: <Sparkles size={16} /> },
                        { onClick: handleSignOut, label: signingOut ? 'Saliendo…' : 'Cerrar sesión', icon: <LogOut size={16} />, tone: 'danger' },
                      ],
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Capa transformada: por defecto solo existe en el DOM a
                partir de md (`hidden md:flex`) — en móvil no aplica salvo
                que la página pida `mobileEnabled`, en cuyo caso está
                disponible siempre. La búsqueda global se queda disponible
                aquí también (a la derecha, con forma de cuadro de
                búsqueda), en el mismo lugar donde vivían buscar/
                favoritos/carrito/notificaciones/perfil — nunca en medio
                del contenido de la página. */}
            <div
              className={cn(
                'absolute inset-0 items-center gap-2 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                mobileEnabled ? 'flex' : 'hidden md:flex',
                transformed ? 'delay-100 translate-y-0 opacity-100' : 'pointer-events-none translate-y-2.5 opacity-0',
              )}
            >
              <div className="min-w-0 flex-1 overflow-hidden">{transformContent}</div>
              {/* Fuera del contenedor `overflow-hidden` de arriba a propósito
                  — un panel flotante (ej. el menú "···" de ActionMenu) que
                  viviera adentro quedaría recortado apenas se abriera. */}
              {actionsSlot}
              {!hideSearchTrigger && (
                <AnimateIcon animateOnHover animateOnTap asChild>
                  <button
                    onClick={() => setSearchOpen(true)}
                    className={cn(
                      'flex h-10 w-44 shrink-0 items-center gap-2 rounded-full bg-muted px-4 text-sm text-muted-foreground transition-colors hover:bg-border',
                      // En móvil los filtros ya necesitan todo el espacio
                      // disponible — el buscador permanente vuelve a partir
                      // de `sm` (tablet en adelante), donde sí sobra sitio.
                      mobileEnabled && 'hidden sm:flex',
                    )}
                  >
                    <Search size={20} className="shrink-0" />
                    <span className="truncate">Buscar…</span>
                  </button>
                </AnimateIcon>
              )}
              {/* El carrito se conserva también en la capa transformada,
                  siempre al borde derecho — es la única herramienta que no
                  cede su lugar al contenido de la página. Una página como el
                  detalle de un pedido lo oculta (`hideCartTrigger`): ahí el
                  biker no está navegando fotos para comprar. */}
              {!hideCartTrigger && (
                <button
                  data-cart-icon
                  onClick={openCartDrawer}
                  aria-label="Carrito"
                  title="Carrito"
                  className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-border"
                >
                  <IconCart className="h-5 w-5" />
                  {itemCount > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                      {itemCount}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Segunda fila que hace crecer el propio header (no un panel
            flotante aparte) — el truco de `grid-template-rows` 0fr↔1fr anima
            un alto que no conocemos de antemano (depende del contenido de
            cada página) sin tener que medirlo a mano; el `overflow-hidden`
            de adentro es lo que realmente recorta durante la transición. */}
        {extraContent && (
          <div className={cn('grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]', secondaryRowOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
            <div className="overflow-hidden">
              <div className="px-4 pb-4 pt-1 md:px-6">{extraContent}</div>
            </div>
          </div>
        )}
        </header>
      </div>

      <BikerSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CartDrawer />

      <MobileBottomNav
        items={[
          // "Inicio" se quitó (Eventos ocupa su lugar) y "Pedidos" ocupa el
          // lugar donde antes vivía Eventos — misma relación de accesos que
          // el menú inferior del fotógrafo (Eventos/Pedidos/Espacio/Perfil).
          { to: '/app/eventos', label: 'Eventos', icon: <IconImages className="h-full w-full" /> },
          { to: '/app/historial', label: 'Pedidos', icon: <IconReceipt className="h-full w-full" /> },
          { to: '/app/checkout', label: 'Carrito', icon: <IconCart className="h-full w-full" />, badge: itemCount },
          { to: '/app/perfil', label: 'Perfil', icon: <UserRound className="h-full w-full" /> },
        ]}
        primary={{ to: '/app/buscar', label: 'Buscar', icon: <Search className="h-full w-full" /> }}
        activeClassName="text-primary"
        autoHide={mobileEnabled && !suppressAutoHide}
      />
    </>
  )
}
