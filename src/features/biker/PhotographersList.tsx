import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApprovedPhotographers } from './usePublicData'
import { Select } from '../../ui/flat/Select'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'

export function PhotographersList() {
  const { data: photographers = [], isLoading } = useApprovedPhotographers()
  const [city, setCity] = useState('')

  const CITIES = useMemo(() => Array.from(new Set(photographers.map((p) => p.city).filter(Boolean))) as string[], [photographers])

  const filtered = useMemo(
    () => photographers.filter((p) => (city ? p.city === city : true)),
    [photographers, city],
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 font-flat md:px-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight md:text-3xl">Fotógrafos</h1>
      <p className="mb-6 text-muted-foreground">{filtered.length} fotógrafos</p>

      {CITIES.length > 0 && (
        <Select value={city} onChange={(e) => setCity(e.target.value)} className="mb-8 w-48">
          <option value="">Toda ciudad</option>
          {CITIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
      )}

      {isLoading && <p className="text-muted-foreground">Cargando…</p>}
      {!isLoading && filtered.length === 0 && <p className="text-muted-foreground">Todavía no hay fotógrafos aprobados.</p>}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <Link
            key={p.id}
            to={`/app/fotografos/${p.id}`}
            className="flex items-center gap-4 rounded-lg bg-muted p-5 transition-transform duration-200 hover:scale-[1.02]"
          >
            <InitialsAvatar name={p.display_name} className="h-16 w-16 shrink-0 rounded-full bg-primary text-lg text-white" />
            <div className="min-w-0">
              <p className="truncate font-bold">{p.display_name}</p>
              {p.city && <p className="text-sm text-muted-foreground">{p.city}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
