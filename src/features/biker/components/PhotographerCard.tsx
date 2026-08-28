import { Link } from 'react-router-dom'
import type { Photographer } from '../../../data/mockPhotos'
import { thumbUrl } from '../../../data/mockPhotos'

export function PhotographerCard({ photographer }: { photographer: Photographer }) {
  return (
    <Link
      to={`/app/fotografos/${photographer.id}`}
      className="group flex shrink-0 flex-col items-center gap-3 rounded-lg bg-muted p-5 text-center transition-transform duration-200 hover:scale-[1.02] w-40"
    >
      <div className="relative">
        <img
          src={thumbUrl(photographer.avatarSeed, 96, 96)}
          alt={photographer.name}
          className="h-20 w-20 rounded-full object-cover"
        />
        {photographer.verified && (
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-white ring-2 ring-white">
            ✓
          </span>
        )}
      </div>
      <div>
        <p className="truncate font-bold">{photographer.name}</p>
        <p className="text-xs text-muted-foreground">{photographer.city}</p>
        <p className="mt-1 text-xs font-semibold text-accent">★ {photographer.rating}</p>
      </div>
    </Link>
  )
}
