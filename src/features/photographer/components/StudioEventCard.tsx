import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { queryClient } from '../../../lib/queryClient'
import { r2Url } from '../../../lib/r2'
import { EVENT_STATUS_STYLE } from '../../../lib/eventStatus'
import { Badge } from '../../../ui/studio/Badge'
import { StatusPill } from '../../../ui/shared/StatusPill'
import { EventCoverMedia } from '../../../ui/shared/EventCoverMedia'
import { useToastStore } from '../../../ui/overlays/toastStore'
import type { MyEvent } from '../useMyEvents'
import type { EventStatus } from '../../../types/db'
import { cn } from '../../../lib/cn'

/** Una sola tarjeta de evento — usada tal cual tanto en la lista de eventos
 * (StudioEvents.tsx) como en la pestaña "Eventos" del perfil del fotógrafo,
 * para que ambas vistas muestren exactamente lo mismo (misma portada,
 * tamaño, info y acciones). */
export function StudioEventCard({ event, photographerId }: { event: MyEvent; photographerId: string | undefined }) {
  const push = useToastStore((s) => s.push)
  const photoCount = event.photos?.[0]?.count ?? 0
  const statusStyle = EVENT_STATUS_STYLE[event.status]

  async function toggleStatus(e: React.MouseEvent, next: EventStatus) {
    e.preventDefault()
    e.stopPropagation()
    const { error } = await supabase.from('events').update({ status: next }).eq('id', event.id)
    if (error) {
      push({ type: 'error', title: 'No se pudo actualizar', description: error.message })
      return
    }
    push({ type: 'success', title: next === 'pausado' ? 'Evento pausado — oculto del público' : 'Evento publicado' })
    queryClient.invalidateQueries({ queryKey: ['my-events', photographerId] })
  }

  return (
    <div className="group overflow-hidden rounded-3xl border border-border transition-all duration-300 hover:-translate-y-1 hover:border-border-hover hover:shadow-xl">
      <Link to={`/studio/eventos/${event.id}`} className="block">
        <EventCoverMedia
          coverUrl={event.cover_path ? r2Url(event.cover_path) : null}
          categorySlot={<Badge className="border-white/20 bg-black/70 text-white">{event.category}</Badge>}
          statusSlot={
            <StatusPill
              dot={statusStyle.dot}
              text={statusStyle.text}
              label={statusStyle.label}
              className="rounded-full bg-black/70 px-2.5 py-1 text-[10px] uppercase tracking-wide"
            />
          }
        />
        <div className="px-5 pt-5">
          <h3 className="font-studio text-lg font-bold">{event.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {event.city} · {new Date(event.event_date).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
            <div>
              <p className="font-studio text-lg font-bold">Q{event.price_per_photo}</p>
              <p className="text-[10px] uppercase text-muted-foreground">Por foto</p>
            </div>
            <div>
              <p className="font-studio text-lg font-bold">{event.event_points.length}</p>
              <p className="text-[10px] uppercase text-muted-foreground">Puntos</p>
            </div>
            <div>
              <p className="font-studio text-lg font-bold">{photoCount}</p>
              <p className="text-[10px] uppercase text-muted-foreground">Fotos</p>
            </div>
          </div>
        </div>
      </Link>
      <div className="grid grid-cols-2 gap-2 border-t border-border p-5 pt-4">
        {event.status === 'pausado' ? (
          <button
            onClick={(e) => toggleStatus(e, 'activo')}
            className="rounded-full bg-emerald-600 py-2 text-center text-xs font-bold text-white transition-colors hover:bg-emerald-500"
          >
            Publicar
          </button>
        ) : (
          <button
            onClick={(e) => toggleStatus(e, 'pausado')}
            className="rounded-full bg-blue-600 py-2 text-center text-xs font-bold text-white transition-colors hover:bg-blue-500"
          >
            Pausar
          </button>
        )}
        <Link
          to={`/studio/eventos/${event.id}/editar`}
          className={cn('rounded-full bg-foreground py-2 text-center text-xs font-bold text-background transition-opacity hover:opacity-80')}
        >
          Editar
        </Link>
      </div>
    </div>
  )
}
