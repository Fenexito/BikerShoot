import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getStudioEventById, type StudioPoint } from '../../data/mockStudio'
import { MapPointPicker } from './components/MapPointPicker'
import { Input } from '../../ui/studio/Input'
import { Select } from '../../ui/studio/Select'
import { Button } from '../../ui/studio/Button'
import { useToastStore } from '../../ui/overlays/toastStore'

const GUATEMALA_CENTER = { lat: 14.6349, lng: -90.5069 }

export function StudioEventEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const push = useToastStore((s) => s.push)
  const isNew = id === 'new'
  const existing = !isNew ? getStudioEventById(id ?? '') : undefined

  const [title, setTitle] = useState(existing?.title ?? '')
  const [category, setCategory] = useState(existing?.category ?? 'Rodada')
  const [city, setCity] = useState(existing?.city ?? '')
  const [venue, setVenue] = useState(existing?.venue ?? '')
  const [price, setPrice] = useState(existing?.pricePerPhoto ?? 25)
  const [description, setDescription] = useState(existing?.description ?? '')
  const [points, setPoints] = useState<StudioPoint[]>(existing?.points ?? [])

  const [newLat, setNewLat] = useState(GUATEMALA_CENTER.lat)
  const [newLng, setNewLng] = useState(GUATEMALA_CENTER.lng)
  const [newLabel, setNewLabel] = useState('')
  const [newStart, setNewStart] = useState('05:00')
  const [newEnd, setNewEnd] = useState('05:30')

  function addPoint() {
    if (!newLabel.trim()) {
      push({ type: 'error', title: 'Ponle un nombre al punto' })
      return
    }
    setPoints((p) => [
      ...p,
      { id: `pt-${Date.now()}`, label: newLabel, lat: newLat, lng: newLng, timeStart: newStart, timeEnd: newEnd },
    ])
    setNewLabel('')
  }

  function removePoint(pointId: string) {
    setPoints((p) => p.filter((pt) => pt.id !== pointId))
  }

  function save() {
    push({ type: 'success', title: isNew ? 'Evento creado' : 'Evento actualizado' })
    navigate('/studio/eventos')
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
          <option>Rodada</option>
          <option>Pista</option>
          <option>Exhibición</option>
          <option>Concentración</option>
        </Select>
        <Input label="Precio por foto (Q)" type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        <Input label="Ciudad" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ej. Antigua" />
        <Input label="Lugar / punto de referencia" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Ej. Calzada Roosevelt" />
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

        <div className="mt-6 border border-border p-5">
          <p className="mb-3 font-studio-mono text-xs uppercase tracking-wider2 text-muted-foreground">
            Haz clic en el mapa para marcar el punto
          </p>
          <MapPointPicker lat={newLat} lng={newLng} onPick={(lat, lng) => { setNewLat(lat); setNewLng(lng) }} />
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Input label="Nombre del punto" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Ej. Km 15" />
            </div>
            <Input label="Hora inicio" type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
            <Input label="Hora fin" type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
          </div>
          <Button variant="ghost" className="mt-3" onClick={addPoint}>
            + Agregar este punto
          </Button>
        </div>
      </section>

      <div className="mt-10 flex justify-end gap-3">
        <Button variant="secondary" onClick={() => navigate('/studio/eventos')}>Cancelar</Button>
        <Button onClick={save}>{isNew ? 'Crear evento' : 'Guardar cambios'}</Button>
      </div>
    </div>
  )
}
