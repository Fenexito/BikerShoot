import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { photographers, thumbUrl } from '../../data/mockPhotos'
import { Select } from '../../ui/flat/Select'

const CITIES = Array.from(new Set(photographers.map((p) => p.city)))

export function PhotographersList() {
  const [city, setCity] = useState('')

  const filtered = useMemo(
    () => [...photographers].filter((p) => (city ? p.city === city : true)).sort((a, b) => b.rating - a.rating),
    [city],
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 font-flat md:px-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight md:text-3xl">Fotógrafos</h1>
      <p className="mb-6 text-muted-foreground">{filtered.length} fotógrafos</p>

      <Select value={city} onChange={(e) => setCity(e.target.value)} className="mb-8 w-48">
        <option value="">Toda ciudad</option>
        {CITIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </Select>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <Link
            key={p.id}
            to={`/app/fotografos/${p.id}`}
            className="flex items-center gap-4 rounded-lg bg-muted p-5 transition-transform duration-200 hover:scale-[1.02]"
          >
            <div className="relative shrink-0">
              <img src={thumbUrl(p.avatarSeed, 72, 72)} alt={p.name} className="h-16 w-16 rounded-full object-cover" />
              {p.verified && (
                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-white ring-2 ring-background">
                  ✓
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-bold">{p.name}</p>
              <p className="text-sm text-muted-foreground">{p.city}</p>
              <p className="mt-1 text-sm font-semibold text-accent">★ {p.rating} · {p.eventsCount} eventos</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
