import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApprovedPhotographers } from './usePublicData'
import { Select } from '../../ui/flat/Select'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { SkeletonRows } from '../../ui/shared/Skeleton'

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

      {isLoading && <SkeletonRows count={6} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" />}

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border py-20 text-center">
          <span className="text-4xl opacity-40">📷</span>
          <p className="font-semibold">Todavía no hay fotógrafos aprobados</p>
          <p className="text-sm text-muted-foreground">Vuelve pronto — estamos revisando solicitudes.</p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <Link
              key={p.id}
              to={`/app/fotografos/${p.id}`}
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              className="flex animate-[fade-in-up_.4s_ease-out_backwards] items-center gap-4 rounded-3xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-sm"
            >
              <InitialsAvatar name={p.display_name} className="h-16 w-16 shrink-0 rounded-full bg-primary text-lg text-white" />
              <div className="min-w-0">
                <p className="truncate font-bold">{p.display_name}</p>
                {p.city && <p className="text-sm text-muted-foreground">{p.city}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
