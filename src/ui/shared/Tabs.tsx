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
              // `bottom-0` (nunca un valor negativo) a propósito: un
              // contenedor con `overflow-x-auto` activa también
              // `overflow-y` por la regla de pareja de la spec de CSS —
              // un indicador que se saliera de la caja del botón (ej.
              // `-bottom-[2px]`) quedaba recortado o forzaba un scroll
              // vertical minúsculo para poder verlo. Quedándose DENTRO del
              // borde inferior del botón (donde antes vivía el
              // `border-b-2` original) no depende de que el contenedor de
              // afuera tenga overflow visible.
              <motion.span
                layoutId={`underline-tabs-${groupId}`}
                className={cn('absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-foreground', indicatorClassName)}
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
    // `flex-wrap` (no `overflow-x-auto`) por debajo de `lg:` — con varias
    // categorías la fila ya no cabe en una sola línea sin desplazarse de
    // lado, y el indicador activo vive DENTRO de cada botón (no es un
    // elemento global compartido), así que envolver a una segunda línea es
    // seguro: cada fila conserva su propio indicador sin importar en cuál
    // línea caiga.
    <nav className="-mb-px flex flex-wrap gap-x-5 gap-y-2 border-b border-border lg:mb-0 lg:flex-col lg:flex-nowrap lg:gap-1 lg:border-b-0">
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
                // Mismo criterio que en `UnderlineTabs`: nunca un offset
                // negativo. `bottom-0`/`left-0` se quedan DENTRO de la
                // caja del botón (donde vivía el `border-b-2`/`border-l-2`
                // original) — un valor negativo se salía de esa caja y,
                // como el `<nav>` de afuera usa `overflow-x-auto` (activa
                // `overflow-y` también, por la regla de pareja de CSS) o
                // vive dentro de la columna angosta del sidebar en
                // escritorio, terminaba recortado — invisible del todo en
                // vez de solo necesitar un scroll para verse.
                <>
                  <motion.span
                    layoutId={`settings-tabs-underline-${groupId}`}
                    className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-foreground lg:hidden"
                    transition={SPRING}
                  />
                  <motion.span
                    layoutId={`settings-tabs-border-${groupId}`}
                    className="absolute inset-y-0 left-0 hidden w-0.5 rounded-full bg-foreground lg:block"
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
