import type { ComponentType } from 'react'
import { AnimateIcon } from '../animate-icons/icon'
import { Instagram } from '../animate-icons/icons/Instagram'
import { Facebook } from '../animate-icons/icons/Facebook'
import { Tiktok } from '../animate-icons/icons/Tiktok'
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
    instagramUrl && { href: instagramUrl, label: 'Instagram', Icon: Instagram },
    facebookUrl && { href: facebookUrl, label: 'Facebook', Icon: Facebook },
    tiktokUrl && { href: tiktokUrl, label: 'TikTok', Icon: Tiktok },
  ].filter(Boolean) as { href: string; label: string; Icon: ComponentType<{ size?: number; className?: string }> }[]

  if (links.length === 0) return null

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {links.map(({ href, label, Icon }) => (
        <AnimateIcon key={label} animateOnHover animateOnTap asChild>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label={label}
            title={label}
            className={cn('text-muted-foreground transition-colors hover:text-foreground', iconClassName)}
          >
            <Icon size={20} />
          </a>
        </AnimateIcon>
      ))}
    </div>
  )
}
