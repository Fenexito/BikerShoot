import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface EventCoverMediaProps {
  coverUrl?: string | null
  alt?: string
  /** Insignia de categoría (izquierda) — cada portal pasa su propio
   * `Badge` ya estilado (studio/flat), este componente solo la posiciona. */
  categorySlot: ReactNode
  /** Insignia de estado (derecha, ej. Activo/Pausado en Studio) — no todos
   * los portales la necesitan (el biker no ve el estado interno del
   * evento), por eso es opcional. */
  statusSlot?: ReactNode
  /** Reemplaza la imagen de portada por completo (ej. el carrusel de fotos
   * del biker) — cuando se da, `coverUrl` se ignora. */
  media?: ReactNode
  placeholderIcon?: string
  className?: string
}

/** Bloque de portada compartido entre `StudioEventCard` (fotógrafo) y
 * `EventCard` (biker) — mismo zoom de hover (125%), mismo degradado que
 * solo aparece en hover, mismas posiciones de insignia. Antes cada portal
 * tenía su propia copia a mano de este bloque (idénticas por fuera, pero
 * dos lugares que actualizar si algo cambiaba); ahora es un solo
 * componente. El contenido de ABAJO de la portada (precio/stats en
 * Studio, fotógrafo/precio en biker) sigue siendo cosa de cada tarjeta —
 * eso sí es legítimamente distinto entre portales. Debe usarse dentro de
 * un contenedor con la clase `group` (el hover que dispara el zoom/
 * degradado es `group-hover`). */
export function EventCoverMedia({ coverUrl, alt = '', categorySlot, statusSlot, media, placeholderIcon = '📷', className }: EventCoverMediaProps) {
  return (
    <div className={cn('relative flex h-56 items-center justify-center overflow-hidden bg-muted', className)}>
      {media ? (
        media
      ) : coverUrl ? (
        <img src={coverUrl} alt={alt} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-125" />
      ) : (
        <span className="text-3xl opacity-30">{placeholderIcon}</span>
      )}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="absolute left-3 top-3">{categorySlot}</div>
      {statusSlot && <div className="absolute right-3 top-3">{statusSlot}</div>}
    </div>
  )
}
