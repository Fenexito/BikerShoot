import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { usePublicPhotoSample } from '../../features/biker/usePublicData'
import { previewUrl } from '../../lib/r2'
import DriftWall from '../reactbits/DriftWall'

interface AuthSplitLayoutProps {
  children: ReactNode
  logoTo?: string
  logoLabel?: string
}

/** Layout de las 4 páginas de auth (biker/Studio × login/signup) — panel de
 * formulario a la izquierda, muro de fotos reales a la derecha. Mismo
 * patrón visual que la referencia de Mobbin (login con showcase a un lado),
 * pero con fotos de eventos reales en vez de screenshots de apps. */
export function AuthSplitLayout({ children, logoTo = '/', logoLabel = 'MotoShots' }: AuthSplitLayoutProps) {
  const { data: photos = [] } = usePublicPhotoSample(30)

  return (
    <div className="flex min-h-screen">
      <div className="flex w-full flex-col justify-center px-6 py-16 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          <Link to={logoTo} className="mb-10 inline-block text-2xl font-extrabold tracking-tight text-primary">
            {logoLabel}
          </Link>
          {children}
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-neutral-950 lg:block lg:w-1/2">
        {photos.length > 0 ? (
          <DriftWall
            items={photos.map((p) => ({ image: previewUrl(p) }))}
            columns={6}
            tileWidth={220}
            tileHeight={280}
            gap={10}
            radius={16}
            tilt={18}
            turn={-16}
            perspective={1000}
            depth={110}
            speed={16}
            variance={0.5}
            parallax={0.4}
            lift={40}
            fade={0.3}
            dim={0.55}
            overlayColor="#0a0a0a"
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl opacity-20">🏍️</div>
        )}
      </div>
    </div>
  )
}
