import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useSearchPhotos } from '../biker/usePublicData'
import { previewUrl } from '../../lib/r2'
import { resolveSharedLink } from './sharedLinks'
import { Button } from '../../ui/flat/Button'
import { Skeleton } from '../../ui/shared/Skeleton'

type LinkStatus = 'loading' | 'not-found' | 'resolved'

/** Página pública (sin sesión) para un link de "compartir foto". Dos
 * caminos posibles apenas se sabe si hay sesión activa:
 *  - CON sesión: no hace falta ninguna vista propia — se manda directo a
 *    la búsqueda completa con los mismos filtros que tenía quien compartió
 *    el link, con esta foto resaltada (mismo mecanismo que ya usa
 *    Search.tsx para centrar la foto recién cerrada del visor).
 *  - SIN sesión: vista de "solo lectura" — la foto (con marca de agua,
 *    igual que cualquier vista previa) más su info básica, y un llamado a
 *    iniciar sesión o crear cuenta. Ambos botones cargan `next` con este
 *    mismo link, así que después de entrar, la persona vuelve aquí — y
 *    esta vez, ya con sesión, cae directo en la búsqueda completa. */
export function SharedPhotoPage() {
  const { code } = useParams<{ code: string }>()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState<LinkStatus>('loading')
  const [photoId, setPhotoId] = useState<string | null>(null)

  const { data: photos = [], isLoading: photosLoading } = useSearchPhotos({})
  const photo = photoId ? photos.find((p) => p.id === photoId) : undefined

  useEffect(() => {
    if (authLoading || !code) return
    let cancelled = false
    resolveSharedLink(code).then((resolved) => {
      if (cancelled) return
      if (!resolved) {
        setStatus('not-found')
        return
      }
      if (user) {
        // Ya con sesión: la experiencia completa (grilla + visor con
        // anterior/siguiente) vive en Search.tsx, no aquí — se reproducen
        // los mismos filtros que tenía quien compartió, con esta foto
        // marcada para resaltar apenas cargue.
        const params = new URLSearchParams(resolved.searchParams)
        params.set('foto', resolved.photoId)
        navigate(`/app/buscar?${params.toString()}`, { replace: true })
        return
      }
      setPhotoId(resolved.photoId)
      setStatus('resolved')
    })
    return () => {
      cancelled = true
    }
  }, [code, user, authLoading, navigate])

  const stillLoading = authLoading || status === 'loading' || (status === 'resolved' && photosLoading)

  if (stillLoading) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-24 font-flat">
        <Skeleton className="h-80 w-full max-w-sm" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    )
  }

  if (status === 'not-found' || !photo) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center font-flat">
        <span className="text-5xl">🔗</span>
        <h1 className="text-2xl font-bold tracking-tight">Este enlace ya no está disponible</h1>
        <p className="text-muted-foreground">La foto pudo haberse eliminado, o el link está incompleto.</p>
        <Link to="/">
          <Button size="lg" className="mt-4">
            Ir a MotoShots
          </Button>
        </Link>
      </div>
    )
  }

  const nextParam = `/f/${code}`

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-12 text-center font-flat md:py-16">
      <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Te compartieron esta foto
      </span>
      <div className="mt-6 w-full overflow-hidden rounded-3xl border border-border bg-muted shadow-sm">
        <img src={previewUrl(photo)} alt={photo.event?.title ?? ''} className="max-h-[70vh] w-full object-contain" />
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">{photo.event?.title}</h1>
      <p className="mt-1 text-muted-foreground">
        {photo.photographer?.display_name} · {photo.event?.city}
        {!photo.featured && ` · Q${photo.price} por foto`}
      </p>

      <div className="mt-8 w-full rounded-3xl border border-border bg-card p-6">
        <p className="font-semibold">Inicia sesión para guardarla o comprarla</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Vuelve a este mismo link después de entrar — te llevará directo a esta foto, con las de alrededor también
          listas para ver.
        </p>
        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <Link to={`/login?next=${encodeURIComponent(nextParam)}`} className="sm:flex-1">
            <Button size="lg" className="w-full">
              Iniciar sesión
            </Button>
          </Link>
          <Link to={`/signup?next=${encodeURIComponent(nextParam)}`} className="sm:flex-1">
            <Button size="lg" variant="secondary" className="w-full">
              Crear cuenta
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
