import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useEvent } from './useMyEvents'
import { useRoutes } from '../shared/useRoutes'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { r2Url } from '../../lib/r2'
import { RoutePointPicker, type AddedPoint, type RoutePointPickerHandle } from './components/RoutePointPicker'
import { Input } from '../../ui/studio/Input'
import { Select } from '../../ui/studio/Select'
import { Button } from '../../ui/studio/Button'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { useToastStore } from '../../ui/overlays/toastStore'
import type { EventStatus } from '../../types/db'

const CATEGORIES = ['Rodada', 'Pista', 'Sesión de Fotos'] as const
const AUTODROMOS = ['Autodromo Pedro Cofiño', 'Autodromo GT', 'Guatemala Raceway (1/4 de Milla)']
const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: 'activo', label: 'Activo — visible para todos' },
  { value: 'pausado', label: 'Pausado — solo tú lo ves' },
  { value: 'cerrado', label: 'Cerrado' },
]
const RODADA_CITY = 'Guatemala'

interface LocalPoint {
  id: string
  routePointId: string | null
  label: string
  lat: number
  lng: number
  timeStart: string
  timeEnd: string
}

export function StudioEventEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const push = useToastStore((s) => s.push)
  // /studio/eventos/new no tiene :id — id llega undefined en esa ruta.
  const isNew = !id || id === 'new'
  const { data: existing, isLoading } = useEvent(id)
  const { data: routes = [] } = useRoutes()

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Rodada')
  const [routeId, setRouteId] = useState('')
  const [city, setCity] = useState('')
  const [venue, setVenue] = useState('')
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [price, setPrice] = useState(25)
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<EventStatus>('pausado')
  const [points, setPoints] = useState<LocalPoint[]>([])
  const [watermarkPath, setWatermarkPath] = useState<string | null>(null)
  const [watermarkFile, setWatermarkFile] = useState<File | null>(null)
  const [watermarkLocalPreview, setWatermarkLocalPreview] = useState<string | null>(null)
  const [coverPath, setCoverPath] = useState<string | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverLocalPreview, setCoverLocalPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const watermarkInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const routePointPickerRef = useRef<RoutePointPickerHandle>(null)

  useEffect(() => {
    if (existing) {
      setTitle(existing.title)
      setCategory(existing.category)
      setCity(existing.city)
      setVenue(existing.venue ?? '')
      setEventDate(existing.event_date)
      setPrice(existing.price_per_photo)
      setDescription(existing.description ?? '')
      setStatus(existing.status)
      setWatermarkPath(existing.watermark_path)
      setCoverPath(existing.cover_path)
      setPoints(
        existing.event_points.map((pt) => ({
          id: pt.id,
          routePointId: pt.route_point_id,
          label: pt.label,
          lat: pt.lat,
          lng: pt.lng,
          timeStart: pt.time_start.slice(0, 5),
          timeEnd: pt.time_end.slice(0, 5),
        })),
      )
      // Los puntos guardan a qué route_point pertenecen, pero no a qué ruta —
      // se busca la ruta a partir del primer punto anclado a una para
      // poder hidratar el selector único de arriba.
      const firstRoutePointId = existing.event_points.find((pt) => pt.route_point_id)?.route_point_id
      if (firstRoutePointId) {
        supabase
          .from('route_points')
          .select('route_id')
          .eq('id', firstRoutePointId)
          .single()
          .then(({ data }) => {
            if (data) setRouteId(data.route_id)
          })
      }
    }
  }, [existing])

  function addPoint(pt: AddedPoint) {
    setPoints((p) => [
      ...p,
      { id: `local-${Date.now()}`, routePointId: pt.routePointId, label: pt.label, lat: pt.lat, lng: pt.lng, timeStart: pt.timeStart, timeEnd: pt.timeEnd },
    ])
  }

  function removePoint(pointId: string) {
    setPoints((p) => p.filter((pt) => pt.id !== pointId))
  }

  function updatePointTime(pointId: string, field: 'timeStart' | 'timeEnd', value: string) {
    setPoints((p) => p.map((pt) => (pt.id === pointId ? { ...pt, [field]: value } : pt)))
  }

  function handleWatermarkFile(file: File | undefined) {
    if (!file) return
    if (file.type !== 'image/png') {
      push({ type: 'error', title: 'La marca de agua debe ser un PNG' })
      return
    }
    setWatermarkFile(file)
    setWatermarkLocalPreview(URL.createObjectURL(file))
  }

  function clearWatermark() {
    setWatermarkFile(null)
    setWatermarkLocalPreview(null)
    setWatermarkPath(null)
  }

  function handleCoverFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      push({ type: 'error', title: 'La portada debe ser una imagen' })
      return
    }
    setCoverFile(file)
    setCoverLocalPreview(URL.createObjectURL(file))
  }

  function clearCover() {
    setCoverFile(null)
    setCoverLocalPreview(null)
    setCoverPath(null)
  }

  async function save() {
    if (!user) return
    const isRodada = category === 'Rodada'
    if (!title.trim() || (!isRodada && !city.trim())) {
      push({ type: 'error', title: 'Título y ciudad son obligatorios' })
      return
    }

    setSaving(true)

    const pending = routePointPickerRef.current?.commitPending()
    const finalPoints = pending
      ? [
          ...points,
          { id: `local-${Date.now()}`, routePointId: pending.routePointId, label: pending.label, lat: pending.lat, lng: pending.lng, timeStart: pending.timeStart, timeEnd: pending.timeEnd },
        ]
      : points
    if (pending) setPoints(finalPoints)

    const payload = {
      photographer_id: user.id,
      title,
      category,
      city: isRodada ? RODADA_CITY : city,
      venue: isRodada ? null : venue || null,
      event_date: eventDate,
      price_per_photo: price,
      description: description || null,
      status,
    }

    let eventId = existing?.id

    if (isNew) {
      const { data, error } = await supabase.from('events').insert(payload).select('id').single()
      if (error || !data) {
        push({ type: 'error', title: 'No se pudo crear el evento', description: error?.message })
        setSaving(false)
        return
      }
      eventId = data.id
    } else {
      const { error } = await supabase.from('events').update(payload).eq('id', eventId)
      if (error) {
        push({ type: 'error', title: 'No se pudo actualizar el evento', description: error.message })
        setSaving(false)
        return
      }
    }

    // Reconciliación por id: nunca borrar-y-reinsertar TODOS los puntos —
    // event_points.id es la FK que las fotos usan (photos.point_id, on
    // delete set null). Borrar y recrear un punto que sigue existiendo le
    // da un id nuevo y desvincula silenciosamente todas sus fotos (bug
    // real detectado: guardar el evento las mandaba a "sin punto asignado"
    // aunque el fotógrafo no hubiera tocado los puntos para nada). Solo se
    // borran los puntos que el fotógrafo quitó de verdad.
    const isLocalPointId = (pid: string) => pid.startsWith('local-')
    const existingPointIds = new Set((existing?.event_points ?? []).map((pt) => pt.id))
    const keptPointIds = new Set(finalPoints.filter((pt) => !isLocalPointId(pt.id)).map((pt) => pt.id))
    const removedPointIds = [...existingPointIds].filter((pid) => !keptPointIds.has(pid))

    if (removedPointIds.length > 0) {
      await supabase.from('event_points').delete().in('id', removedPointIds)
    }

    for (const pt of finalPoints) {
      if (isLocalPointId(pt.id)) {
        const { error: pointsError } = await supabase.from('event_points').insert({
          event_id: eventId,
          route_point_id: pt.routePointId,
          label: pt.label,
          lat: pt.lat,
          lng: pt.lng,
          time_start: pt.timeStart,
          time_end: pt.timeEnd,
        })
        if (pointsError) {
          push({ type: 'error', title: 'El evento se guardó, pero fallaron los puntos', description: pointsError.message })
          setSaving(false)
          return
        }
      } else {
        const { error: pointsError } = await supabase
          .from('event_points')
          .update({
            route_point_id: pt.routePointId,
            label: pt.label,
            lat: pt.lat,
            lng: pt.lng,
            time_start: pt.timeStart,
            time_end: pt.timeEnd,
          })
          .eq('id', pt.id)
        if (pointsError) {
          push({ type: 'error', title: 'El evento se guardó, pero fallaron los puntos', description: pointsError.message })
          setSaving(false)
          return
        }
      }
    }

    if (watermarkFile) {
      const { data: signed, error: signError } = await supabase.functions.invoke('r2-watermark-upload-url', {
        body: { eventId, fileName: watermarkFile.name, contentType: watermarkFile.type },
      })
      if (signError || !signed?.uploadUrl) {
        push({ type: 'error', title: 'El evento se guardó, pero falló la marca de agua', description: signError?.message })
        setSaving(false)
        return
      }
      const putRes = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: watermarkFile })
      if (!putRes.ok) {
        push({ type: 'error', title: 'El evento se guardó, pero falló la marca de agua', description: `R2 respondió ${putRes.status}` })
        setSaving(false)
        return
      }
      await supabase.from('events').update({ watermark_path: signed.watermarkPath }).eq('id', eventId)
    } else if (!isNew && existing && watermarkPath !== existing.watermark_path) {
      // Se quitó la marca de agua sin subir una nueva.
      await supabase.from('events').update({ watermark_path: null }).eq('id', eventId)
    }

    if (coverFile) {
      const { data: signed, error: signError } = await supabase.functions.invoke('r2-cover-upload-url', {
        body: { eventId, fileName: coverFile.name, contentType: coverFile.type },
      })
      if (signError || !signed?.uploadUrl) {
        push({ type: 'error', title: 'El evento se guardó, pero falló la portada', description: signError?.message })
        setSaving(false)
        return
      }
      const putRes = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': coverFile.type }, body: coverFile })
      if (!putRes.ok) {
        push({ type: 'error', title: 'El evento se guardó, pero falló la portada', description: `R2 respondió ${putRes.status}` })
        setSaving(false)
        return
      }
      await supabase.from('events').update({ cover_path: signed.coverPath }).eq('id', eventId)
    } else if (!isNew && existing && coverPath !== existing.cover_path) {
      // Se quitó la portada sin subir una nueva.
      await supabase.from('events').update({ cover_path: null }).eq('id', eventId)
    }

    queryClient.invalidateQueries({ queryKey: ['my-events', user.id] })
    queryClient.invalidateQueries({ queryKey: ['event', eventId] })
    push({ type: 'success', title: isNew ? 'Evento creado — pausado hasta que lo publiques' : 'Evento actualizado' })
    setSaving(false)

    // Tanto al crear como al editar, el destino es la vista del evento — ahí
    // vive el uploader por punto.
    navigate(`/studio/eventos/${eventId}`, { replace: isNew })
  }

  if (!isNew && isLoading) {
    return <p className="px-6 py-16 text-center text-muted-foreground">Cargando evento…</p>
  }

  return (
    <div className={STUDIO_PAGE_WIDE}>
      <h1 className="font-studio text-3xl font-bold tracking-tight2 md:text-4xl">
        {isNew ? 'Crear evento' : 'Editar evento'}
      </h1>
      <p className="mt-2 text-muted-foreground">La info básica y los puntos de cobertura con su horario.</p>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input label="Título del evento" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Rodada Nocturna Antigua" />
        </div>
        <Select label="Categoría" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        {category === 'Rodada' && (
          <Select label="Ruta" value={routeId} onChange={(e) => setRouteId(e.target.value)}>
            <option value="">Selecciona una ruta</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
        )}
        <Input label="Precio por foto (Q)" type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        {category !== 'Rodada' && <Input label="Ciudad" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ej. Antigua" />}
        {category === 'Pista' && (
          <Select label="Autódromo" value={venue} onChange={(e) => setVenue(e.target.value)}>
            <option value="">Selecciona un autódromo</option>
            {AUTODROMOS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
        )}
        {category === 'Sesión de Fotos' && (
          <Input label="Lugar / punto de referencia" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Ej. Calzada Roosevelt" />
        )}
        <Input label="Fecha del evento" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
        <Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value as EventStatus)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>
        <div className="sm:col-span-2">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider2 text-muted-foreground">Descripción</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-base text-foreground outline-none transition-colors duration-150 focus:border-accent"
          />
        </div>
      </div>

      {/* Portada + Marca de agua */}
      <section className="mt-14 border-t border-border pt-10">
        <div className="grid grid-cols-1 gap-10 divide-y divide-border sm:grid-cols-2 sm:gap-0 sm:divide-x sm:divide-y-0">
          <div className="flex flex-col gap-4 sm:pr-10">
            <div>
              <h2 className="font-studio text-xl font-bold tracking-tight2">Foto de portada</h2>
              <p className="mt-1 min-h-[2.75rem] text-justify text-sm text-muted-foreground [text-align-last:left]">
                Se muestra como banner ancho en la vista del evento y en tu lista de eventos. Opcional.
              </p>
            </div>
            <div className="flex items-center gap-4">
              {(coverLocalPreview || coverPath) ? (
                <img
                  src={coverLocalPreview ?? r2Url(coverPath!)}
                  alt="Portada"
                  className="h-20 w-32 shrink-0 rounded-2xl border border-border object-cover"
                />
              ) : (
                <div className="flex h-20 w-32 shrink-0 items-center justify-center border border-dashed border-border text-xs text-muted-foreground">
                  Sin portada
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button variant="ghost" size="sm" onClick={() => coverInputRef.current?.click()}>
                  {coverPath || coverLocalPreview ? 'Cambiar' : 'Subir portada'}
                </Button>
                {(coverPath || coverLocalPreview) && (
                  <Button variant="ghost" size="sm" onClick={clearCover}>Quitar</Button>
                )}
              </div>
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleCoverFile(e.target.files?.[0])}
            />
          </div>

          <div className="flex flex-col gap-4 pt-10 sm:pl-10 sm:pt-0">
            <div>
              <h2 className="font-studio text-xl font-bold tracking-tight2">Marca de agua</h2>
              <p className="mt-1 min-h-[2.75rem] text-justify text-sm text-muted-foreground [text-align-last:left]">
                Un PNG que se estampa sobre las fotos de este evento. Opcional — sin uno, las fotos se suben reducidas pero sin marca.
              </p>
            </div>
            <div className="flex items-center gap-4">
              {(watermarkLocalPreview || watermarkPath) ? (
                <img
                  src={watermarkLocalPreview ?? r2Url(watermarkPath!)}
                  alt="Marca de agua"
                  className="h-20 w-20 shrink-0 rounded-2xl border border-border object-contain [background-image:linear-gradient(45deg,#8884_25%,transparent_25%),linear-gradient(-45deg,#8884_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#8884_75%),linear-gradient(-45deg,transparent_75%,#8884_75%)] [background-size:10px_10px]"
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center border border-dashed border-border text-xs text-muted-foreground">
                  Sin PNG
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button variant="ghost" size="sm" onClick={() => watermarkInputRef.current?.click()}>
                  {watermarkPath || watermarkLocalPreview ? 'Cambiar PNG' : 'Subir PNG'}
                </Button>
                {(watermarkPath || watermarkLocalPreview) && (
                  <Button variant="ghost" size="sm" onClick={clearWatermark}>Quitar</Button>
                )}
              </div>
            </div>
            <input
              ref={watermarkInputRef}
              type="file"
              accept="image/png"
              className="hidden"
              onChange={(e) => handleWatermarkFile(e.target.files?.[0])}
            />
          </div>
        </div>
      </section>

      {/* Puntos de cobertura */}
      <section className="mt-14 border-t border-border pt-10">
        <h2 className="font-studio text-xl font-bold tracking-tight2">Puntos de cobertura</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada punto es un lugar donde te paraste a cierta hora. Los bikers los usan para encontrarte por su ruta.
        </p>

        {points.length > 0 && (
          <div className="mt-6 flex flex-col divide-y divide-border rounded-2xl border border-border">
            {points.map((pt) => (
              <div key={pt.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <p className="font-semibold">{pt.label}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={pt.timeStart}
                    onChange={(e) => updatePointTime(pt.id, 'timeStart', e.target.value)}
                    className="rounded-2xl border border-border bg-input px-2 py-1 font-studio-mono text-xs text-foreground outline-none focus:border-accent"
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <input
                    type="time"
                    value={pt.timeEnd}
                    onChange={(e) => updatePointTime(pt.id, 'timeEnd', e.target.value)}
                    className="rounded-2xl border border-border bg-input px-2 py-1 font-studio-mono text-xs text-foreground outline-none focus:border-accent"
                  />
                  <button onClick={() => removePoint(pt.id)} className="ml-2 text-sm text-muted-foreground hover:text-accent">
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6">
          <RoutePointPicker ref={routePointPickerRef} onAdd={addPoint} useRoute={category === 'Rodada'} routeId={routeId} />
        </div>
      </section>

      {!isNew && (
        <p className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
          Para subir fotos, guarda tus cambios y hazlo desde la vista del evento.
        </p>
      )}

      <div className="sticky bottom-0 z-20 mt-10 flex justify-end gap-3 border-t border-border bg-background px-6 py-4 -mx-6 md:-mx-16 md:px-16">
        <Button variant="secondary" onClick={() => navigate(isNew ? '/studio/eventos' : `/studio/eventos/${id}`)}>Cancelar</Button>
        <Button onClick={save} loading={saving}>{isNew ? 'Crear evento' : 'Guardar cambios'}</Button>
      </div>
    </div>
  )
}
