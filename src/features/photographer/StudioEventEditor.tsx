import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useEvent } from './useMyEvents'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { r2Url } from '../../lib/r2'
import { RoutePointPicker, type AddedPoint } from './components/RoutePointPicker'
import { Input } from '../../ui/studio/Input'
import { Select } from '../../ui/studio/Select'
import { Button } from '../../ui/studio/Button'
import { useToastStore } from '../../ui/overlays/toastStore'

const CATEGORIES = ['Rodada', 'Pista', 'Sesión de Fotos'] as const
const AUTODROMOS = ['Autodromo Pedro Cofiño', 'Autodromo GT', 'Guatemala Raceway (1/4 de Milla)']

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
  const isNew = id === 'new'
  const { data: existing, isLoading } = useEvent(id)

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Rodada')
  const [city, setCity] = useState('')
  const [venue, setVenue] = useState('')
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [price, setPrice] = useState(25)
  const [description, setDescription] = useState('')
  const [points, setPoints] = useState<LocalPoint[]>([])
  const [watermarkPath, setWatermarkPath] = useState<string | null>(null)
  const [watermarkFile, setWatermarkFile] = useState<File | null>(null)
  const [watermarkLocalPreview, setWatermarkLocalPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const watermarkInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (existing) {
      setTitle(existing.title)
      setCategory(existing.category)
      setCity(existing.city)
      setVenue(existing.venue ?? '')
      setEventDate(existing.event_date)
      setPrice(existing.price_per_photo)
      setDescription(existing.description ?? '')
      setWatermarkPath(existing.watermark_path)
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

  async function save() {
    if (!user) return
    if (!title.trim() || !city.trim()) {
      push({ type: 'error', title: 'Título y ciudad son obligatorios' })
      return
    }

    setSaving(true)

    const payload = {
      photographer_id: user.id,
      title,
      category,
      city,
      venue: venue || null,
      event_date: eventDate,
      price_per_photo: price,
      description: description || null,
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
      // Reconciliación simple: borra los puntos existentes y vuelve a insertar los actuales.
      await supabase.from('event_points').delete().eq('event_id', eventId)
    }

    if (points.length > 0) {
      const { error: pointsError } = await supabase.from('event_points').insert(
        points.map((pt) => ({
          event_id: eventId,
          route_point_id: pt.routePointId,
          label: pt.label,
          lat: pt.lat,
          lng: pt.lng,
          time_start: pt.timeStart,
          time_end: pt.timeEnd,
        })),
      )
      if (pointsError) {
        push({ type: 'error', title: 'El evento se guardó, pero fallaron los puntos', description: pointsError.message })
        setSaving(false)
        return
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

    queryClient.invalidateQueries({ queryKey: ['my-events', user.id] })
    push({ type: 'success', title: isNew ? 'Evento creado' : 'Evento actualizado' })
    navigate('/studio/eventos')
  }

  if (!isNew && isLoading) {
    return <p className="px-6 py-16 text-center text-muted-foreground">Cargando evento…</p>
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 text-foreground md:px-16">
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
        <Input label="Precio por foto (Q)" type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        <Input label="Ciudad" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ej. Antigua" />
        {category === 'Pista' ? (
          <Select label="Autódromo" value={venue} onChange={(e) => setVenue(e.target.value)}>
            <option value="">Selecciona un autódromo</option>
            {AUTODROMOS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
        ) : (
          <Input label="Lugar / punto de referencia" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Ej. Calzada Roosevelt" />
        )}
        <Input label="Fecha del evento" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
        <div className="sm:col-span-2">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider2 text-muted-foreground">Descripción</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-border bg-input px-4 py-3 text-base text-foreground outline-none transition-colors duration-150 focus:border-accent"
          />
        </div>
      </div>

      {/* Marca de agua */}
      <section className="mt-14 border-t border-border pt-10">
        <h2 className="font-studio text-xl font-bold tracking-tight2">Marca de agua</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Un PNG que se estampa sobre todas las fotos de este evento hasta que lo cambies. Es opcional — si no subes uno, las fotos igual se suben reducidas, pero sin ninguna marca encima.
        </p>

        <div className="mt-4 flex items-center gap-4">
          {(watermarkLocalPreview || watermarkPath) ? (
            <img
              src={watermarkLocalPreview ?? r2Url(watermarkPath!)}
              alt="Marca de agua"
              className="h-20 w-20 border border-border object-contain [background-image:linear-gradient(45deg,#8884_25%,transparent_25%),linear-gradient(-45deg,#8884_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#8884_75%),linear-gradient(-45deg,transparent_75%,#8884_75%)] [background-size:10px_10px]"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center border border-dashed border-border text-xs text-muted-foreground">
              Sin PNG
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => watermarkInputRef.current?.click()}>
              {watermarkPath || watermarkLocalPreview ? 'Cambiar PNG' : 'Subir PNG'}
            </Button>
            {(watermarkPath || watermarkLocalPreview) && (
              <Button variant="ghost" onClick={clearWatermark}>Quitar</Button>
            )}
          </div>
          <input
            ref={watermarkInputRef}
            type="file"
            accept="image/png"
            className="hidden"
            onChange={(e) => handleWatermarkFile(e.target.files?.[0])}
          />
        </div>
      </section>

      {/* Puntos de cobertura */}
      <section className="mt-14 border-t border-border pt-10">
        <h2 className="font-studio text-xl font-bold tracking-tight2">Puntos de cobertura</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada punto es un lugar donde te paraste a cierta hora. Los bikers los usan para encontrarte por su ruta.
        </p>

        {points.length > 0 && (
          <div className="mt-6 flex flex-col divide-y divide-border border border-border">
            {points.map((pt) => (
              <div key={pt.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="font-semibold">{pt.label}</p>
                  <p className="font-studio-mono text-xs text-muted-foreground">{pt.timeStart} – {pt.timeEnd}</p>
                </div>
                <button onClick={() => removePoint(pt.id)} className="text-sm text-muted-foreground hover:text-accent">
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6">
          <RoutePointPicker onAdd={addPoint} showRouteSelector={category === 'Rodada'} />
        </div>
      </section>

      <div className="mt-10 flex justify-end gap-3">
        <Button variant="secondary" onClick={() => navigate('/studio/eventos')}>Cancelar</Button>
        <Button onClick={save} loading={saving}>{isNew ? 'Crear evento' : 'Guardar cambios'}</Button>
      </div>
    </div>
  )
}
