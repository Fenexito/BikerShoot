import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

export interface ProfileMenuLink {
  to?: string
  onClick?: () => void
  label: string
  icon?: ReactNode
  tone?: 'default' | 'danger'
}

interface ProfileMenuProps {
  name: string
  email?: string
  avatar?: ReactNode
  links: ProfileMenuLink[]
  themeSwitcher?: ReactNode
}

/** Menú flotante oscuro al hacer clic en el avatar — mismo patrón en los dos
 * portales (Studio y biker), independiente del tema de la página: siempre
 * "panel de comando" oscuro flotando sobre lo que sea, como en la
 * referencia de Mobbin. */
export function ProfileMenu({ name, email, avatar, links, themeSwitcher }: ProfileMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Menú de perfil"
        className="block h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-transparent transition-all hover:ring-white/20"
      >
        {avatar}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 w-72 origin-top-right animate-menu-in overflow-hidden rounded-3xl border border-white/10 bg-neutral-900 py-2 text-white shadow-2xl">
          <div className="px-4 py-3">
            <p className="truncate font-semibold">{name}</p>
            {email && <p className="truncate text-xs text-white/50">{email}</p>}
          </div>

          {themeSwitcher && <div className="border-t border-white/10 px-4 py-3">{themeSwitcher}</div>}

          <div className="border-t border-white/10 py-2">
            {links.map((link) => {
              const content = (
                <>
                  {link.icon && <span className="h-4 w-4 shrink-0">{link.icon}</span>}
                  {link.label}
                </>
              )
              const itemClass = cn(
                'flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/10',
                link.tone === 'danger' ? 'text-red-400' : 'text-white/90',
              )
              return link.to ? (
                <Link key={link.label} to={link.to} onClick={() => setOpen(false)} className={itemClass}>
                  {content}
                </Link>
              ) : (
                <button
                  key={link.label}
                  onClick={() => {
                    setOpen(false)
                    link.onClick?.()
                  }}
                  className={itemClass}
                >
                  {content}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
