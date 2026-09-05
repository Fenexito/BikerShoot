import { NavLink } from 'react-router-dom'
import { cn } from '../../lib/cn'
import type { ReactNode } from 'react'

export interface MobileNavItem {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
}

interface MobileBottomNavProps {
  /** Los primeros 2 van a la izquierda, los últimos 2 a la derecha. */
  items: [MobileNavItem, MobileNavItem, MobileNavItem, MobileNavItem]
  /** La acción central, elevada — la primaria de la página (ej. Buscar en
   * el portal biker, Crear evento en el portal del fotógrafo). */
  primary: MobileNavItem
  activeClassName?: string
}

/** Barra inferior estilo Instagram — reemplaza la navegación por header en
 * pantallas chicas. 5 accesos: 2 + 2 alrededor de una acción central elevada. */
export function MobileBottomNav({ items, primary, activeClassName }: MobileBottomNavProps) {
  const [left1, left2, right1, right2] = items

  function itemClass({ isActive }: { isActive: boolean }) {
    return cn(
      'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
      isActive ? cn('text-foreground', activeClassName) : 'text-muted-foreground',
    )
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
      <div className="mx-auto flex max-w-lg items-center">
        {[left1, left2].map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={itemClass}>
            <span className="h-5 w-5">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        <NavLink
          to={primary.to}
          end={primary.end}
          className="flex flex-1 flex-col items-center justify-center"
        >
          {({ isActive }) => (
            <span
              className={cn(
                '-mt-6 flex h-14 w-14 items-center justify-center rounded-full border-4 border-background shadow-lg transition-colors',
                isActive ? 'bg-foreground text-background' : 'bg-foreground/90 text-background',
              )}
            >
              <span className="h-6 w-6">{primary.icon}</span>
            </span>
          )}
        </NavLink>

        {[right1, right2].map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={itemClass}>
            <span className="h-5 w-5">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
