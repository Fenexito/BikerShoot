import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApprovedPhotographers, usePublicEvents, useFeaturedEventPhotos } from './usePublicData'
import { PhotoCarousel } from './components/PhotoCarousel'
import { previewUrl, r2Url } from '../../lib/r2'
import { FancySelect } from '../../ui/shared/FancySelect'
import { Button } from '../../ui/flat/Button'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { IconVerified } from '../../ui/shared/icons'
import { SkeletonRows } from '../../ui/shared/Skeleton'
import type { DbPhoto, DbPhotographer } from '../../types/db'
import { cn } from '../../lib/cn'

const SORTS: { value: string; label: string }[] = [
  { value: 'popular', label: 'Más experiencia' },
  { value: 'az', label: 'A-Z' },
]

function dayOfYear() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  return Math.floor((+now - +start) / 86_400_000)
}

function avatarSrc(photographer: DbPhotographer) {
  if (!photographer.avatar_url) return null
  return photographer.avatar_url.startsWith('http') ? photographer.avatar_url : r2Url(photographer.avatar_url)
}

function PhotographerAvatar({ photographer, className }: { photographer: DbPhotographer; className: string }) {
  const src = avatarSrc(photographer)
  return src ? (
    <img src={src} alt={photographer.display_name} className={cn(className, 'object-cover')} />
  ) : (
    <InitialsAvatar name={photographer.display_name} className={cn(className, 'bg-primary text-white')} />
  )
}

function PhotographerSpotlight({ photographer, eventCount, photos }: { photographer: DbPhotographer; eventCount: number; photos: DbPhoto[] }) {
  return (
    <div className="mb-10 overflow-hidden rounded-3xl border border-border bg-card">
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-blue-100 to-emerald-100 md:aspect-auto">
          {photos.length > 0 ? (
            <PhotoCarousel photos={photos} />
          ) : photographer.profile_cover_path ? (
            <img src={r2Url(photographer.profile_cover_path)} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl opacity-30">🏍️</div>
          )}
        </div>
        <div className="flex flex-col justify-center gap-4 p-6 sm:p-8">
          <span className="inline-flex w-fit items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700">
            ✨ Fotógrafo destacado
          </span>
          <div className="flex items-center gap-3">
            <PhotographerAvatar photographer={photographer} className="h-14 w-14 shrink-0 rounded-full" />
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xl font-bold">{photographer.display_name}</p>
                <IconVerified className="h-4 w-4 shrink-0" />
              </div>
              {photographer.city && <p className="text-sm text-muted-foreground">{photographer.city}</p>}
            </div>
          </div>
          {photographer.bio && <p className="line-clamp-2 text-sm text-muted-foreground">{photographer.bio}</p>}
          <p className="text-sm font-semibold text-primary">{eventCount} evento{eventCount === 1 ? '' : 's'} cubierto{eventCount === 1 ? '' : 's'}</p>
          <Link to={`/app/fotografos/${photographer.id}`}>
            <Button size="lg">Ver perfil completo</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

function PhotographerGridCard({ photographer, eventCount, photos }: { photographer: DbPhotographer; eventCount: number; photos: DbPhoto[] }) {
  const grid = photos.slice(0, 4)
  return (
    <Link
      to={`/app/fotografos/${photographer.id}`}
      className="group flex animate-[fade-in-up_.4s_ease-out_backwards] flex-col overflow-hidden rounded-3xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
    >
      <div className="grid aspect-[16/9] grid-cols-2 gap-0.5 overflow-hidden bg-muted">
        {grid.length > 0 ? (
          grid.map((photo) => (
            <div key={photo.id} className={cn('relative overflow-hidden bg-muted', grid.length === 1 && 'col-span-2 row-span-2')}>
              <img
                src={previewUrl(photo)}
                alt=""
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          ))
        ) : photographer.profile_cover_path ? (
          <div className="col-span-2 overflow-hidden">
            <img
              src={r2Url(photographer.profile_cover_path)}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        ) : (
          <div className="col-span-2 flex items-center justify-center text-3xl opacity-30">📷</div>
        )}
      </div>
      <div className="flex items-center gap-3 p-4">
        <PhotographerAvatar photographer={photographer} className="h-12 w-12 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="truncate font-bold">{photographer.display_name}</p>
            <IconVerified className="h-3.5 w-3.5 shrink-0" />
          </div>
          {photographer.city && <p className="truncate text-sm text-muted-foreground">{photographer.city}</p>}
        </div>
        {eventCount > 0 && (
          <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
            {eventCount} evento{eventCount === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </Link>
  )
}

export function PhotographersList() {
  const { data: photographers = [], isLoading } = useApprovedPhotographers()
  const { data: events = [] } = usePublicEvents()
  const { data: featuredPhotos = [] } = useFeaturedEventPhotos()
  const [city, setCity] = useState('')
  const [sort, setSort] = useState('popular')

  const CITIES = useMemo(() => Array.from(new Set(photographers.map((p) => p.city).filter(Boolean))) as string[], [photographers])

  const eventCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of events) map.set(e.photographer_id, (map.get(e.photographer_id) ?? 0) + 1)
    return map
  }, [events])

  const photosByPhotographer = useMemo(() => {
    const map = new Map<string, DbPhoto[]>()
    for (const p of featuredPhotos) {
      const list = map.get(p.photographer_id) ?? []
      list.push(p)
      map.set(p.photographer_id, list)
    }
    return map
  }, [featuredPhotos])

  const filtered = useMemo(() => {
    let list = photographers.filter((p) => (city ? p.city === city : true))
    list = [...list].sort((a, b) =>
      sort === 'az'
        ? a.display_name.localeCompare(b.display_name)
        : (eventCounts.get(b.id) ?? 0) - (eventCounts.get(a.id) ?? 0),
    )
    return list
  }, [photographers, city, sort, eventCounts])

  const spotlight = useMemo(() => {
    const candidates = [...photographers]
      .filter((p) => (eventCounts.get(p.id) ?? 0) > 0)
      .sort((a, b) => (eventCounts.get(b.id) ?? 0) - (eventCounts.get(a.id) ?? 0))
      .slice(0, 5)
    if (candidates.length === 0) return null
    return candidates[dayOfYear() % candidates.length]
  }, [photographers, eventCounts])

  const rest = spotlight ? filtered.filter((p) => p.id !== spotlight.id) : filtered

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 font-flat md:px-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight md:text-3xl">Fotógrafos</h1>
      <p className="mb-6 text-muted-foreground">{filtered.length} fotógrafos · elige al que mejor capture tu estilo</p>

      {isLoading && <SkeletonRows count={6} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" />}

      {!isLoading && spotlight && (
        <PhotographerSpotlight
          photographer={spotlight}
          eventCount={eventCounts.get(spotlight.id) ?? 0}
          photos={photosByPhotographer.get(spotlight.id) ?? []}
        />
      )}

      {!isLoading && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-6 border-b border-border">
            {SORTS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSort(s.value)}
                className={cn(
                  'border-b-2 pb-3 text-sm font-semibold transition-colors',
                  sort === s.value ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          {CITIES.length > 0 && (
            <FancySelect value={city} onChange={setCity} options={CITIES.map((c) => ({ value: c, label: c }))} placeholder="Toda ciudad" className="w-48" />
          )}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border py-20 text-center">
          <span className="text-4xl opacity-40">📷</span>
          <p className="font-semibold">Todavía no hay fotógrafos aprobados</p>
          <p className="text-sm text-muted-foreground">Vuelve pronto — estamos revisando solicitudes.</p>
        </div>
      )}

      {!isLoading && rest.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((p) => (
            <PhotographerGridCard key={p.id} photographer={p} eventCount={eventCounts.get(p.id) ?? 0} photos={photosByPhotographer.get(p.id) ?? []} />
          ))}
        </div>
      )}
    </div>
  )
}
