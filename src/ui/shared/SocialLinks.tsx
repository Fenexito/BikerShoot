import { IconInstagram, IconFacebook, IconTiktok } from './icons'
import { cn } from '../../lib/cn'

interface SocialLinksProps {
  instagramUrl?: string | null
  facebookUrl?: string | null
  tiktokUrl?: string | null
  className?: string
  iconClassName?: string
}

export function SocialLinks({ instagramUrl, facebookUrl, tiktokUrl, className, iconClassName }: SocialLinksProps) {
  const links = [
    instagramUrl && { href: instagramUrl, label: 'Instagram', Icon: IconInstagram },
    facebookUrl && { href: facebookUrl, label: 'Facebook', Icon: IconFacebook },
    tiktokUrl && { href: tiktokUrl, label: 'TikTok', Icon: IconTiktok },
  ].filter(Boolean) as { href: string; label: string; Icon: typeof IconInstagram }[]

  if (links.length === 0) return null

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {links.map(({ href, label, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={label}
          title={label}
          className={cn('text-muted-foreground transition-colors hover:text-foreground', iconClassName)}
        >
          <Icon className="h-5 w-5" />
        </a>
      ))}
    </div>
  )
}
