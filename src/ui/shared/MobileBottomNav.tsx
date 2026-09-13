import { NavLink, useMatch } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { useAutoHideHeader } from './useAutoHideHeader'
import { AnimateIcon } from '../animate-icons/icon'
import type { ReactNode } from 'react'

export interface MobileNavItem {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
  /** Número a mostrar como insignia sobre el ícono (ej. cuántas fotos hay
   * en el carrito) — se omite si es 0/undefined. */
  badge?: number
}

interface MobileBottomNavProps {
  /** Los primeros 2 van a la izquierda, los últimos 2 a la derecha. */
  items: [MobileNavItem, MobileNavItem, MobileNavItem, MobileNavItem]
  /** La acción central, elevada — la primaria de la página (ej. Buscar en
   * el portal biker, Crear evento en el portal del fotógrafo). */
  primary: MobileNavItem
  activeClassName?: string
  /** Auto-ocultarse al bajar (y reaparecer al subir) — false por defecto,
   * así el menú se queda fijo en la mayoría de páginas. Solo Buscar fotos
   * lo activa: ahí conviene ceder ese espacio a la vista de fotos. */
  autoHide?: boolean
}

/** El ícono va envuelto en `AnimateIcon asChild` — NO se envuelve el
 * `NavLink` completo aquí: probamos eso primero, pero `Slot` reemplazando
 * al `NavLink` (vía `motion.create`) rompía el tamaño del ícono (se veía
 * gigante, a tamaño completo en vez de 20px) en vez de solo agregarle los
 * handlers de hover/tap. Envolver este `<span>` (que sí es un solo
 * elemento simple) evita ese problema — el tap sigue cubriendo el ícono
 * completo, que es la parte que en verdad se anima. */
function renderIcon(item: MobileNavItem) {
  return (
    <AnimateIcon animateOnHover animateOnTap asChild>
      <span className="relative h-5 w-5">
        {item.icon}
        {!!item.badge && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
            {item.badge > 9 ? '9+' : item.badge}
          </span>
        )}
      </span>
    </AnimateIcon>
  )
}

/** Botón central elevado — mismo motivo que `renderIcon`: se envuelve el
 * `<span>` del ícono (no el `NavLink`) para no romper el tamaño. Usa
 * `useMatch` (en vez del patrón de children-función de NavLink) solo para
 * pintar el círculo según el estado activo. */
function PrimaryNavButton({ item, activeClassName }: { item: MobileNavItem; activeClassName?: string }) {
  const match = useMatch({ path: item.to, end: item.end ?? false })
  return (
    <NavLink to={item.to} end={item.end} className="flex flex-1 flex-col items-center justify-center">
      <span
        className={cn(
          '-mt-6 flex h-14 w-14 items-center justify-center rounded-full border-4 border-background shadow-lg transition-colors',
          match ? cn('bg-foreground text-background', activeClassName) : 'bg-foreground/90 text-background',
        )}
      >
        <AnimateIcon animateOnHover animateOnTap asChild>
          <span className="h-6 w-6">{item.icon}</span>
        </AnimateIcon>
      </span>
    </NavLink>
  )
}

/** Barra inferior estilo Instagram — reemplaza la navegación por header en
 * pantallas chicas. 5 accesos: 2 + 2 alrededor de una acción central elevada.
 *
 * Cada ícono va envuelto en `AnimateIcon animateOnHover animateOnTap` —
 * `animateOnTap` es lo que de verdad importa aquí: en móvil (donde vive
 * este menú) no hay hover real, así que sin esto los íconos animados
 * nunca se verían — el tap los dispara igual que un click normal dispara
 * la navegación, sin interferir entre sí. */
export function MobileBottomNav({ items, primary, activeClassName, autoHide = false }: MobileBottomNavProps) {
  const [left1, left2, right1, right2] = items
  // Mismo criterio de auto-ocultado que el header: al bajar se esconde
  // (más espacio para ver fotos), al subir vuelve a aparecer — pero solo
  // si `autoHide` lo pide (ver el comentario de esa prop).
  const autoHidden = useAutoHideHeader()
  const hidden = autoHide && autoHidden

  function itemClass({ isActive }: { isActive: boolean }) {
    return cn(
      'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
      isActive ? cn('text-foreground', activeClassName) : 'text-muted-foreground',
    )
  }

  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md transition-transform duration-300 md:hidden',
        hidden ? 'translate-y-full' : 'translate-y-0',
      )}
    >
      {/* `h-16` fijo (antes la altura salía de `py-2` en cada item, variable
          según el contenido) — el footer flotante del checkout y el botón
          de reportar bugs asumen que esta barra mide exactamente 4rem para
          apilarse justo arriba de ella sin hueco ni superposición; con
          altura variable ese supuesto fallaba y dejaba un hueco visible. */}
      <div className="mx-auto flex h-16 max-w-lg items-center">
        {[left1, left2].map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={itemClass}>
            {renderIcon(item)}
            {item.label}
          </NavLink>
        ))}

        <PrimaryNavButton item={primary} activeClassName={activeClassName} />

        {[right1, right2].map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={itemClass}>
            {renderIcon(item)}
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
