import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMyEvents } from './useMyEvents'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { r2Url } from '../../lib/r2'
import { EVENT_STATUS_STYLE } from '../../lib/eventStatus'
import { Badge } from '../../ui/studio/Badge'
import { Button } from '../../ui/studio/Button'
import { StatusPill } from '../../ui/shared/StatusPill'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { useToastStore } from '../../ui/overlays/toastStore'
import type { EventStatus } from '../../types/db'
import { cn } from '../../lib/cn'

export function StudioEvents() {
  const { user } = useAuth()
  const { data: events, isLoading, error } = useMyEvents(user?.id)
  const push = useToastStore((s) => s.push)

  async function toggleStatus(e: React.MouseEvent, eventId: string, next: EventStatus) {
    e.preventDefault()
    e.stopPropagation()
    const { error } = await supabase.from('events').update({ status: next }).eq('id', eventId)
    if (error) {
      push({ type: 'error', title: 'No se pudo actualizar', description: error.message })
      return
    }
    push({ type: 'success', title: next === 'pausado' ? 'Evento pausado — oculto del público' : 'Evento publicado' })
    queryClient.invalidateQueries({ queryKey: ['my-events', user?.id] })
  }

  return (
    <div className={STUDIO_PAGE_WIDE}>
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-studio text-3xl font-bold tracking-tight2 md:text-4xl">Tus eventos</h1>
          <p className="mt-2 text-muted-foreground">{events?.length ?? 0} eventos publicados</p>
        </div>
        <Link to="/studio/eventos/new">
          <Button variant="secondary">+ Crear evento</Button>
        </Link>
      </div>

      {isLoading && <p className="text-muted-foreground">Cargando…</p>}
      {error && <p className="text-accent">No se pudieron cargar tus eventos.</p>}

      {events && events.length === 0 && (
        <div className="rounded-2xl border border-border px-6 py-16 text-center text-muted-foreground">
          Todavía no tienes eventos.{' '}
          <Link to="/studio/eventos/new" className="text-accent">Crea el primero.</Link>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {events?.map((event) => {
          const photoCount = event.photos?.[0]?.count ?? 0
          const statusStyle = EVENT_STATUS_STYLE[event.status]
          return (
            <div
              key={event.id}
              className="group overflow-hidden rounded-2xl border border-border transition-colors duration-150 hover:border-border-hover"
            >
              <Link to={`/studio/eventos/${event.id}`} className="block">
                <div className="relative flex h-40 items-center justify-center overflow-hidden bg-muted">
                  {event.cover_path ? (
                    <img src={r2Url(event.cover_path)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-3xl opacity-30">📷</span>
                  )}
                  <div className="absolute left-3 top-3">
                    <Badge className="border-white/20 bg-black/70 text-white">{event.category}</Badge>
                  </div>
                </div>
                <div className="px-5 pt-5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-studio text-lg font-bold">{event.title}</h3>
                    <StatusPill
                      dot={statusStyle.dot}
                      text={statusStyle.text}
                      label={statusStyle.label}
                      className="shrink-0 font-studio-mono text-[10px] uppercase tracking-wider2"
                    />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {event.city} · {new Date(event.event_date).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })}
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
                    <div>
                      <p className="font-studio text-lg font-bold">Q{event.price_per_photo}</p>
                      <p className="font-studio-mono text-[10px] uppercase text-muted-foreground">Por foto</p>
                    </div>
                    <div>
                      <p className="font-studio text-lg font-bold">{event.event_points.length}</p>
                      <p className="font-studio-mono text-[10px] uppercase text-muted-foreground">Puntos</p>
                    </div>
                    <div>
                      <p className="font-studio text-lg font-bold">{photoCount}</p>
                      <p className="font-studio-mono text-[10px] uppercase text-muted-foreground">Fotos</p>
                    </div>
                  </div>
                </div>
              </Link>
              <div className="grid grid-cols-2 gap-2 border-t border-border p-5 pt-4">
                {event.status === 'pausado' ? (
                  <button
                    onClick={(e) => toggleStatus(e, event.id, 'activo')}
                    className="rounded-full bg-emerald-600 py-2 text-center text-xs font-bold text-white transition-colors hover:bg-emerald-500"
                  >
                    Publicar
                  </button>
                ) : (
                  <button
                    onClick={(e) => toggleStatus(e, event.id, 'pausado')}
                    className="rounded-full bg-blue-600 py-2 text-center text-xs font-bold text-white transition-colors hover:bg-blue-500"
                  >
                    Pausar
                  </button>
                )}
                <Link
                  to={`/studio/eventos/${event.id}/editar`}
                  className={cn(
                    'rounded-full bg-foreground py-2 text-center text-xs font-bold text-background transition-opacity hover:opacity-80',
                  )}
                >
                  Editar
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
