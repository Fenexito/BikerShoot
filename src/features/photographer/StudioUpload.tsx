import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useMyEvents } from './useMyEvents'
import { PhotoUploadQueue } from './components/PhotoUploadQueue'
import { Select } from '../../ui/studio/Select'

export function StudioUpload() {
  const { user } = useAuth()
  const { data: events } = useMyEvents(user?.id)
  const [eventId, setEventId] = useState('')
  const [pointId, setPointId] = useState('')

  const event = events?.find((e) => e.id === eventId)

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 text-foreground md:px-16">
      <h1 className="font-studio text-3xl font-bold tracking-tight2 md:text-4xl">Carga rápida</h1>
      <p className="mt-2 text-muted-foreground">
        Arrastra las fotos de un punto específico y súbelas en lote — cada una se sube reducida, con la marca de agua PNG del evento si configuraste una (edítala en el evento). La entrega en alta calidad se sube aparte, foto por foto, después de cada venta (en el detalle del pedido).
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <Select label="Evento" value={eventId} onChange={(e) => { setEventId(e.target.value); setPointId('') }}>
          <option value="">Selecciona un evento</option>
          {events?.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.title}</option>
          ))}
        </Select>
        <Select label="Punto y horario" value={pointId} onChange={(e) => setPointId(e.target.value)} disabled={!event}>
          <option value="">Selecciona un punto</option>
          {event?.event_points.map((pt) => (
            <option key={pt.id} value={pt.id}>{pt.label} ({pt.time_start.slice(0, 5)}–{pt.time_end.slice(0, 5)})</option>
          ))}
        </Select>
      </div>

      {events && events.length === 0 && (
        <p className="mt-3 text-sm text-accent">No tienes eventos todavía — crea uno primero en "Eventos".</p>
      )}

      {event && !event.watermark_path && (
        <p className="mt-3 text-sm text-accent">Este evento no tiene marca de agua configurada — las fotos se subirán reducidas pero sin nada encima.</p>
      )}

      {user && eventId && pointId ? (
        <div className="mt-8">
          <PhotoUploadQueue
            key={`${eventId}-${pointId}`}
            eventId={eventId}
            pointId={pointId}
            photographerId={user.id}
            price={event?.price_per_photo ?? 0}
            watermarkPath={event?.watermark_path ?? null}
          />
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted-foreground">Elige un evento y un punto para poder subir fotos.</p>
      )}
    </div>
  )
}
