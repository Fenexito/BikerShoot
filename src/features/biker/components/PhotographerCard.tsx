import { Link } from 'react-router-dom'
import type { DbPhotographer } from '../../../types/db'
import { InitialsAvatar } from '../../../ui/shared/InitialsAvatar'

export function PhotographerCard({ photographer }: { photographer: DbPhotographer }) {
  return (
    <Link
      to={`/app/fotografos/${photographer.id}`}
      className="flex w-40 shrink-0 flex-col items-center gap-3 rounded-3xl border border-border bg-card p-5 text-center transition-all hover:border-primary/30 hover:shadow-sm"
    >
      <InitialsAvatar name={photographer.display_name} className="h-20 w-20 rounded-full bg-primary text-xl text-white" />
      <div>
        <p className="truncate font-bold">{photographer.display_name}</p>
        {photographer.city && <p className="text-xs text-muted-foreground">{photographer.city}</p>}
      </div>
    </Link>
  )
}
