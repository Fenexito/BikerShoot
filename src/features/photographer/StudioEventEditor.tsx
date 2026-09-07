import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useEvent } from './useMyEvents'
import { useRoutes } from '../shared/useRoutes'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { r2Url } from '../../lib/r2'
import { RoutePointPicker, type AddedPoint, type RoutePointPickerHandle } from './components/RoutePointPicker'
import { FeaturedPhotosUploader, MAX_FEATURED } from './components/FeaturedPhotosUploader'
import { EventImagesManager } from './components/EventImagesManager'
import { Input } from '../../ui/studio/Input'
import { FancySelect } from '../../ui/shared/FancySelect'
import { DatePicker } from '../../ui/shared/DatePicker'
import { Button } from '../../ui/studio/Button'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { useToastStore } from '../../ui/overlays/toastStore'
import { confirmDialog } from '../../ui/overlays/confirmStore'
import { IconInfo, IconMap, IconImages } from '../../ui/shared/icons'
import { useBackButton } from '../../ui/shared/useBackButton'
import { cn } from '../../lib/cn'
import type { EventStatus } from '../../types/db'
import { Skeleton } from '../../ui/shared/Skeleton'

const CATEGORIES = ['Rodada', 'Pista', 'Sesión de Fotos'] as const
const AUTODROMOS = ['Autodromo Pedro Cofiño', 'Autodromo GT', 'Guatemala Raceway (1/4 de Milla)']
const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: 'activo', label: 'Activo — visible para todos' },
  { value: 'pausado', label: 'Pausado — solo tú lo ves' },
  { value: 'cerrado', label: 'Cerrado' },
]
const RODADA_CITY = 'Guatemala'

const TAB_IDS = ['info', 'cobertura', 'imagenes'] as const
type TabId = (typeof TAB_IDS)[number]

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

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
  useBackButton(isNew ? '/studio/eventos' : `/studio/eventos/${id}`)
  const { data: existing, isLoading } = useEvent(id)
  const { data: routes = [] } = useRoutes()

  const [tab, setTab] = useState<TabId>('info')
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

  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)
  const skipNextDirtyRef = useRef(true)
  // Se pone en true recién cuando TODA la hidratación inicial terminó —
  // incluyendo el fetch async de routeId (que resuelve después de que
  // `isLoading` ya pasó a false), no solo cuando useEvent() terminó. Sin
  // esto, ese segundo cambio de estado llegaba tarde y se marcaba como si
  // el fotógrafo hubiera tocado algo, disparando la confirmación de salida
  // en una página recién abierta y sin editar.
  const hydrationDoneRef = useRef(false)
  const [leaveHref, setLeaveHref] = useState<string | null>(null)
  const draftKey = user ? `motoshots-event-draft-${user.id}-${id ?? 'new'}` : null

  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  // Autosave a un borrador local + marcar "sucio" — se salta la primera
  // pasada (el mount con los valores por defecto, o la carga inicial de un
  // evento existente) para no marcar sucio algo que el fotógrafo no tocó.
  useEffect(() => {
    if (!hydrationDoneRef.current) return
    if (skipNextDirtyRef.current) {
      skipNextDirtyRef.current = false
      return
    }
    setDirty(true)
    if (!draftKey) return
    const draft = { title, category, routeId, city, venue, eventDate, price, description, status, points, savedAt: Date.now() }
    localStorage.setItem(draftKey, JSON.stringify(draft))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, category, routeId, city, venue, eventDate, price, description, status, points, isLoading, isNew])

  // Ofrece continuar un borrador guardado — solo una vez, y solo después de
  // que (si es edición) los datos reales del evento ya se hayan cargado, así
  // el borrador siempre pisa al final y no al revés.
  const draftCheckedRef = useRef(false)
  useEffect(() => {
    if (!draftKey || draftCheckedRef.current) return
    if (!isNew && isLoading) return
    draftCheckedRef.current = true
    const raw = localStorage.getItem(draftKey)
    if (!raw) return
    let draft: any
    try {
      draft = JSON.parse(raw)
    } catch {
      localStorage.removeItem(draftKey)
      return
    }
    confirmDialog
      .ask({
        title: 'Tienes un borrador sin terminar de este evento',
        description: `Guardado ${new Date(draft.savedAt).toLocaleString('es-GT')} — ¿quieres continuarlo?`,
        confirmLabel: 'Continuar borrador',
        cancelLabel: 'Descartar',
      })
      .then((ok) => {
        if (!ok) {
          localStorage.removeItem(draftKey)
          return
        }
        setTitle(draft.title ?? '')
        setCategory(draft.category ?? 'Rodada')
        setRouteId(draft.routeId ?? '')
        setCity(draft.city ?? '')
        setVenue(draft.venue ?? '')
        setEventDate(draft.eventDate ?? new Date().toISOString().slice(0, 10))
        setPrice(draft.price ?? 25)
        setDescription(draft.description ?? '')
        setStatus(draft.status ?? 'pausado')
        setPoints(draft.points ?? [])
        push({ type: 'success', title: 'Borrador restaurado' })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, isNew, isLoading])

  function attemptNavigate(href: string) {
    if (dirtyRef.current) {
      setLeaveHref(href)
    } else {
      navigate(href)
    }
  }

  // Cualquier <a>/<Link> de la app (header, nav inferior, menú de perfil…)
  // queda interceptado mientras haya cambios sin guardar — no solo el botón
  // Cancelar de esta página.
  useEffect(() => {
    function onClickCapture(e: MouseEvent) {
      if (!dirtyRef.current) return
      const a = (e.target as HTMLElement)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a) return
      let url: URL
      try {
        url = new URL(a.href, window.location.origin)
      } catch {
        return
      }
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return
      e.preventDefault()
      e.stopPropagation()
      setLeaveHref(url.pathname + url.search)
    }
    document.addEventListener('click', onClickCapture, true)
    return () => document.removeEventListener('click', onClickCapture, true)
  }, [])

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

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
            hydrationDoneRef.current = true
          })
      } else {
        hydrationDoneRef.current = true
      }
    } else if (isNew) {
      // Para un evento nuevo no hay ningún cambio de estado posterior que
      // le dé al efecto de "sucio" la oportunidad de correr de nuevo y
      // consumir el salto — se consume aquí mismo, directo.
      hydrationDoneRef.current = true
      skipNextDirtyRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, isNew])

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

  function computeErrors() {
    const isRodada = category === 'Rodada'
    const errors: { title?: boolean; city?: boolean; eventDate?: boolean; price?: boolean } = {}
    if (!title.trim()) errors.title = true
    if (!isRodada && !city.trim()) errors.city = true
    if (!eventDate) errors.eventDate = true
    if (!price || price <= 0) errors.price = true
    return errors
  }
  const fieldErrors = attemptedSubmit ? computeErrors() : {}

  async function save() {
    if (!user) return
    const errors = computeErrors()
    if (Object.keys(errors).length > 0) {
      setAttemptedSubmit(true)
      setTab('info')
      push({ type: 'error', title: 'Completa los campos obligatorios' })
      return
    }

    setSaving(true)
    const isRodada = category === 'Rodada'

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
    setDirty(false)
    if (draftKey) localStorage.removeItem(draftKey)

    // Tanto al crear como al editar, el destino es la vista del evento — ahí
    // vive el uploader por punto.
    navigate(`/studio/eventos/${eventId}`, { replace: isNew })
  }

  if (!isNew && isLoading) {
    return (
      <div className={STUDIO_PAGE_WIDE}>
        <Skeleton className="h-8 w-56" />
        <div className="mt-8 space-y-5">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  const isRodada = category === 'Rodada'
  const TABS: { id: TabId; label: string; icon: typeof IconInfo }[] = [
    { id: 'info', label: 'Información', icon: IconInfo },
    { id: 'cobertura', label: isRodada ? 'Ruta' : 'Punto', icon: IconMap },
    { id: 'imagenes', label: 'Imágenes', icon: IconImages },
  ]

  return (
    <div className={STUDIO_PAGE_WIDE}>
      <h1 className="font-studio text-3xl font-bold tracking-tight2 md:text-4xl">
        {isNew ? 'Crear evento' : 'Editar evento'}
      </h1>
      <p className="mt-2 text-muted-foreground">La info básica, la ruta o punto de cobertura, y las imágenes del evento.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[180px_1fr]">
        {/* Mismo patrón que Configuración: pestañas subrayadas horizontales
            en móvil, lista vertical a la izquierda en escritorio. */}
        <nav className="-mb-px flex gap-5 overflow-x-auto border-b border-border lg:mb-0 lg:flex-col lg:gap-1 lg:border-b-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors lg:border-b-0 lg:border-l-2 lg:px-3 lg:py-2 lg:pb-2 lg:text-left',
                tab === t.id
                  ? 'border-foreground font-bold text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <t.icon className="h-4 w-4 shrink-0" />
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex flex-col gap-6 pb-24">
          {tab === 'info' && (
            <Section title="Información del evento">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Input
                    label="Título del evento"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej. Rodada Nocturna Antigua"
                    error={fieldErrors.title ? 'Obligatorio' : undefined}
                  />
                </div>
                <FancySelect
                  label="Categoría"
                  value={category}
                  onChange={(v) => setCategory(v as typeof category)}
                  options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                  clearable={false}
                />
                <Input
                  label="Precio por foto (Q)"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  error={fieldErrors.price ? 'Obligatorio' : undefined}
                />
                {category !== 'Rodada' && (
                  <Input
                    label="Ciudad"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ej. Antigua"
                    error={fieldErrors.city ? 'Obligatorio' : undefined}
                  />
                )}
                {category === 'Pista' && (
                  <FancySelect
                    label="Autódromo"
                    value={venue}
                    onChange={setVenue}
                    options={AUTODROMOS.map((a) => ({ value: a, label: a }))}
                    placeholder="Selecciona un autódromo"
                  />
                )}
                {category === 'Sesión de Fotos' && (
                  <Input label="Lugar / punto de referencia" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Ej. Calzada Roosevelt" />
                )}
                <DatePicker label="Fecha del evento" value={eventDate} onChange={setEventDate} error={fieldErrors.eventDate} />
                <FancySelect
                  label="Estado"
                  value={status}
                  onChange={(v) => setStatus(v as EventStatus)}
                  options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
                  clearable={false}
                />
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Descripción</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-base text-foreground outline-none transition-colors duration-150 focus:border-accent"
                  />
                </div>
              </div>
            </Section>
          )}

          {tab === 'cobertura' && (
            <Section
              title={isRodada ? 'Ruta y puntos' : 'Punto de cobertura'}
              description={
                isRodada
                  ? 'Cada punto es un lugar donde te paraste a cierta hora. Los bikers los usan para encontrarte por su ruta.'
                  : 'Marca en el mapa dónde vas a estar y a qué hora — los bikers lo usan para encontrar sus fotos.'
              }
            >
              {isRodada && (
                <div className="mb-6">
                  <FancySelect
                    label="Ruta"
                    value={routeId}
                    onChange={setRouteId}
                    options={routes.map((r) => ({ value: r.id, label: r.name }))}
                    placeholder="Selecciona una ruta"
                  />
                </div>
              )}

              {points.length > 0 && (
                <div className="mb-6 flex flex-col divide-y divide-border rounded-2xl border border-border">
                  {points.map((pt) => (
                    <div key={pt.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <p className="font-semibold">{pt.label}</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={pt.timeStart}
                          onChange={(e) => updatePointTime(pt.id, 'timeStart', e.target.value)}
                          className="rounded-2xl border border-border bg-input px-2 py-1 text-xs text-foreground outline-none focus:border-accent"
                        />
                        <span className="text-xs text-muted-foreground">–</span>
                        <input
                          type="time"
                          value={pt.timeEnd}
                          onChange={(e) => updatePointTime(pt.id, 'timeEnd', e.target.value)}
                          className="rounded-2xl border border-border bg-input px-2 py-1 text-xs text-foreground outline-none focus:border-accent"
                        />
                        <button onClick={() => removePoint(pt.id)} className="ml-2 text-sm text-muted-foreground hover:text-foreground">
                          Quitar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <RoutePointPicker ref={routePointPickerRef} onAdd={addPoint} useRoute={isRodada} routeId={routeId} />
            </Section>
          )}

          {tab === 'imagenes' && (
            <>
              <Section title="Portada y marca de agua">
                <div className="flex flex-wrap gap-8">
                  <div className="flex items-center gap-4">
                    <button onClick={() => coverInputRef.current?.click()} className="relative h-16 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-border bg-muted">
                      {(coverLocalPreview || coverPath) ? (
                        <img src={coverLocalPreview ?? r2Url(coverPath!)} alt="Portada" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-lg opacity-30">📷</span>
                      )}
                    </button>
                    <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverFile(e.target.files?.[0])} />
                    <div>
                      <p className="text-sm font-semibold">Foto de portada</p>
                      <p className="mb-1 text-xs text-muted-foreground">Banner ancho en la vista del evento. Opcional.</p>
                      <div className="flex gap-2">
                        <button onClick={() => coverInputRef.current?.click()} className="text-xs font-semibold text-foreground hover:underline">
                          {coverPath || coverLocalPreview ? 'Cambiar' : 'Subir'}
                        </button>
                        {(coverPath || coverLocalPreview) && (
                          <button onClick={clearCover} className="text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline">
                            Quitar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => watermarkInputRef.current?.click()}
                      className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-border bg-muted [background-image:linear-gradient(45deg,#8884_25%,transparent_25%),linear-gradient(-45deg,#8884_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#8884_75%),linear-gradient(-45deg,transparent_75%,#8884_75%)] [background-size:10px_10px]"
                    >
                      {(watermarkLocalPreview || watermarkPath) ? (
                        <img src={watermarkLocalPreview ?? r2Url(watermarkPath!)} alt="Marca de agua" className="h-full w-full object-contain" />
                      ) : (
                        <span className="text-lg opacity-30">🖼️</span>
                      )}
                    </button>
                    <input ref={watermarkInputRef} type="file" accept="image/png" className="hidden" onChange={(e) => handleWatermarkFile(e.target.files?.[0])} />
                    <div>
                      <p className="text-sm font-semibold">Marca de agua (PNG)</p>
                      <p className="mb-1 text-xs text-muted-foreground">Se estampa sobre las fotos. Opcional.</p>
                      <div className="flex gap-2">
                        <button onClick={() => watermarkInputRef.current?.click()} className="text-xs font-semibold text-foreground hover:underline">
                          {watermarkPath || watermarkLocalPreview ? 'Cambiar' : 'Subir'}
                        </button>
                        {(watermarkPath || watermarkLocalPreview) && (
                          <button onClick={clearWatermark} className="text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline">
                            Quitar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Section>

              {!isNew && id && user && (
                <Section
                  title="Fotos destacadas"
                  description={`Tu portafolio de este evento — hasta ${MAX_FEATURED} fotos en alta calidad, sin marca de agua. No están a la venta.`}
                >
                  <FeaturedPhotosUploader eventId={id} photographerId={user.id} />
                </Section>
              )}

              {!isNew && id && user && (
                <Section
                  title="Fotos por punto"
                  description="Sube y organiza las fotos de cada punto desde aquí mismo — también puedes hacerlo después desde la vista del evento."
                >
                  <EventImagesManager
                    eventId={id}
                    photographerId={user.id}
                    price={price}
                    watermarkPath={watermarkPath}
                    points={points.filter((p) => !p.id.startsWith('local-')).map((p) => ({ id: p.id, label: p.label, time_start: p.timeStart, time_end: p.timeEnd }))}
                  />
                </Section>
              )}

              {isNew && (
                <p className="text-sm text-muted-foreground">
                  Las fotos destacadas y las fotos por punto se suben desde aquí mismo una vez creado el evento.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-20 mt-10 flex justify-end gap-3 border-t border-border bg-background px-6 py-4 -mx-6 md:-mx-16 md:px-16">
        <Button variant="secondary" onClick={() => attemptNavigate(isNew ? '/studio/eventos' : `/studio/eventos/${id}`)}>Cancelar</Button>
        <Button variant="dark" onClick={save} loading={saving}>{isNew ? 'Crear evento' : 'Guardar cambios'}</Button>
      </div>

      {leaveHref && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60" onClick={() => setLeaveHref(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="text-lg font-bold">Tienes cambios sin guardar</h2>
            <p className="mt-2 text-sm text-muted-foreground">¿Qué quieres hacer antes de salir?</p>
            <div className="mt-6 flex flex-col gap-2">
              <Button
                variant="dark"
                onClick={() => {
                  setLeaveHref(null)
                  save()
                }}
              >
                Guardar evento
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const href = leaveHref
                  setLeaveHref(null)
                  navigate(href)
                }}
              >
                Guardar como borrador y salir
              </Button>
              <button
                onClick={() => {
                  if (draftKey) localStorage.removeItem(draftKey)
                  const href = leaveHref
                  setLeaveHref(null)
                  navigate(href)
                }}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
