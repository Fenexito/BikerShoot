import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSearchPhotos } from './usePublicData'
import { useFavoritesStore } from './favoritesStore'
import { PhotoGrid, type GridPhoto } from './components/PhotoGrid'
import { PhotoLightbox } from './components/PhotoLightbox'
import { Button } from '../../ui/flat/Button'

export function Favorites() {
  const favoriteIds = useFavoritesStore((s) => s.ids)
  const { data: photos = [] } = useSearchPhotos({})
  const [lightbox, setLightbox] = useState<{ photos: GridPhoto[]; index: number } | null>(null)

  const favoritePhotos: GridPhoto[] = useMemo(
    () =>
      photos
        .filter((p) => favoriteIds.includes(p.id))
        .map((p) => ({ ...p, eventTitle: p.event?.title ?? '', photographerName: p.photographer?.display_name ?? '' })),
    [photos, favoriteIds],
  )

  if (favoritePhotos.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-24 text-center font-flat">
        <span className="text-5xl">♡</span>
        <h1 className="text-2xl font-bold tracking-tight">Sin favoritos todavía</h1>
        <p className="text-muted-foreground">Toca el corazón en cualquier foto para guardarla aquí.</p>
        <Link to="/app/buscar">
          <Button size="lg" className="mt-4">Buscar fotos</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 font-flat md:px-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight md:text-3xl">Tus favoritos</h1>
      <p className="mb-6 text-muted-foreground">{favoritePhotos.length} fotos guardadas</p>

      <PhotoGrid photos={favoritePhotos} onOpenPhoto={(photos, index) => setLightbox({ photos, index })} />

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={(index) => setLightbox({ photos: lightbox.photos, index })}
        />
      )}
    </div>
  )
}
