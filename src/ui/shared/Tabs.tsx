import { motion } from 'motion/react'
import { useId, type ComponentType, type ReactNode } from 'react'
import { AnimateIcon } from '../animate-icons/icon'
import { cn } from '../../lib/cn'

const SPRING = { type: 'spring', stiffness: 500, damping: 40 } as const

export interface UnderlineTabItem<T extends string> {
  value: T
  label: ReactNode
}

export interface UnderlineTabsProps<T extends string> {
  tabs: UnderlineTabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  tabClassName?: string
  activeClassName?: string
  inactiveClassName?: string
  indicatorClassName?: string
}

/** Fila de pestañas con línea inferior animada — la misma línea de siempre,
 * pero ahora se DESLIZA de una pestaña a otra (`layoutId` de `motion`) en
 * vez de saltar de golpe. Pensada para reemplazar cualquier fila de
 * `border-b-2` ya existente (filtros de Eventos/Pedidos, "Fotos
 * destacadas/Eventos" del perfil del fotógrafo, etc.) sin cambiar cómo se
 * ve en reposo — solo cómo se mueve al cambiar.
 *
 * `data-no-ripple`: una pestaña no es un botón de acción — es un selector,
 * como un tab de navegador. El ripple de clic (`GlobalRipple`) es para
 * botones reales (confirmar, guardar, agregar al carrito...), no para
 * esto. */
export function UnderlineTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  tabClassName,
  activeClassName,
  inactiveClassName,
  indicatorClassName,
}: UnderlineTabsProps<T>) {
  const groupId = useId()
  return (
    <div className={className}>
      {tabs.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            type="button"
            data-no-ripple
            onClick={() => onChange(t.value)}
            className={cn('relative', tabClassName, active ? activeClassName : inactiveClassName)}
          >
            {t.label}
            {active && (
              <motion.span
                layoutId={`underline-tabs-${groupId}`}
                className={cn('absolute inset-x-0 -bottom-[2px] h-0.5 rounded-full bg-foreground', indicatorClassName)}
                transition={SPRING}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

export interface SettingsTabItem<T extends string> {
  id: T
  label: string
  icon: ComponentType<{ className?: string }>
}

/** Pestañas de una página de "Configuración" — horizontales y subrayadas
 * en móvil, columna vertical con borde izquierdo en escritorio (mismo
 * patrón ya usado en `BikerProfilePage`/`StudioSettings`). El indicador
 * (línea o borde, según el ancho de pantalla) se desliza con `motion` en
 * vez de aparecer de golpe en la pestaña recién activada — dos
 * indicadores separados (uno por orientación, cada uno oculto en la
 * otra) porque son ejes de movimiento distintos, no se puede animar el
 * mismo elemento en dos direcciones a la vez. */
export function SettingsTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly SettingsTabItem<T>[]
  value: T
  onChange: (value: T) => void
}) {
  const groupId = useId()
  return (
    <nav className="-mb-px flex gap-5 overflow-x-auto border-b border-border lg:mb-0 lg:flex-col lg:gap-1 lg:border-b-0">
      {tabs.map((t) => {
        const active = t.id === value
        return (
          <AnimateIcon key={t.id} animateOnHover animateOnTap asChild>
            <button
              type="button"
              data-no-ripple
              onClick={() => onChange(t.id)}
              className={cn(
                'relative flex shrink-0 items-center gap-2 whitespace-nowrap pb-3 text-sm font-medium transition-colors lg:px-3 lg:py-2 lg:pb-2 lg:text-left',
                active ? 'font-bold text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <t.icon className="h-4 w-4 shrink-0" />
              {t.label}
              {active && (
                <>
                  <motion.span
                    layoutId={`settings-tabs-underline-${groupId}`}
                    className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-foreground lg:hidden"
                    transition={SPRING}
                  />
                  <motion.span
                    layoutId={`settings-tabs-border-${groupId}`}
                    className="absolute inset-y-0 -left-0.5 hidden w-0.5 rounded-full bg-foreground lg:block"
                    transition={SPRING}
                  />
                </>
              )}
            </button>
          </AnimateIcon>
        )
      })}
    </nav>
  )
}
