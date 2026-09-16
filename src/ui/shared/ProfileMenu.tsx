import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimateIcon } from '../animate-icons/icon'
import { cn } from '../../lib/cn'

export interface ProfileMenuLink {
  to?: string
  onClick?: () => void
  label: string
  icon?: ReactNode
  tone?: 'default' | 'danger'
  external?: boolean
}

interface ProfileMenuProps {
  name: string
  email?: string
  avatar?: ReactNode
  socialLinks?: ReactNode
  editProfile?: { label: string; to: string }
  /** Grupos de links — cada grupo se separa del siguiente con una línea. */
  sections: ProfileMenuLink[][]
}

const FOOTER_LINKS: ProfileMenuLink[] = [
  { to: '/privacidad', label: 'Privacidad' },
  { to: '/terminos', label: 'Términos' },
  { to: '/derechos-de-autor', label: 'Derechos de autor' },
]

/** Menú flotante oscuro al hacer clic en el avatar — mismo patrón en los dos
 * portales (Studio y biker), independiente del tema de la página: siempre
 * "panel de comando" oscuro flotando sobre lo que sea, como en la
 * referencia de Mobbin. */
export function ProfileMenu({ name, email, avatar, socialLinks, editProfile, sections }: ProfileMenuProps) {
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
        data-no-ripple
        className="block h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-transparent transition-all hover:ring-white/20"
      >
        {avatar}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 w-72 origin-top-right animate-menu-in overflow-hidden rounded-3xl border border-white/10 bg-neutral-900 py-2 text-white shadow-2xl">
          <div className="px-4 py-3">
            <p className="truncate font-semibold">{name}</p>
            {email && <p className="truncate text-xs text-white/50">{email}</p>}
            {socialLinks && <div className="mt-2.5">{socialLinks}</div>}
          </div>

          {editProfile && (
            <div className="px-4 pb-3">
              <Link
                to={editProfile.to}
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-center rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-white/15"
              >
                {editProfile.label}
              </Link>
            </div>
          )}

          {sections.map((group, gi) => (
            <div key={gi} className="border-t border-white/10 py-2">
              {group.map((link) => {
                const content = (
                  <>
                    {link.icon && <span className="flex h-4 w-4 shrink-0 items-center justify-center">{link.icon}</span>}
                    <span className="truncate">{link.label}</span>
                    {link.external && <span className="ml-auto text-white/40">↗</span>}
                  </>
                )
                const itemClass = cn(
                  'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-white/10',
                  link.tone === 'danger' ? 'text-red-400' : 'text-white/90',
                )
                // Fila COMPLETA envuelta en AnimateIcon (no solo el ícono)
                // — cualquier ícono animado que un caller pase en
                // `link.icon` dispara su animación con el hover de toda la
                // fila; uno estático lo ignora sin problema.
                return link.to ? (
                  <AnimateIcon key={link.label} animateOnHover animateOnTap asChild>
                    <Link
                      to={link.to}
                      onClick={() => setOpen(false)}
                      className={itemClass}
                      {...(link.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                    >
                      {content}
                    </Link>
                  </AnimateIcon>
                ) : (
                  <AnimateIcon key={link.label} animateOnHover animateOnTap asChild>
                    <button
                      onClick={() => {
                        setOpen(false)
                        link.onClick?.()
                      }}
                      className={itemClass}
                    >
                      {content}
                    </button>
                  </AnimateIcon>
                )
              })}
            </div>
          ))}

          {/* `flex justify-between` (no `grid grid-cols-3`): cada link mide
              su propio texto en vez de repartirse en tercios iguales —
              "Derechos de autor" no cabía en un tercio y se recortaba
              (`truncate`), ocultándose. Sin `truncate` ni ancho forzado, los
              tres caben en una sola línea con espacio parejo entre ellos. */}
          <div className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3 text-[11px] text-white/40">
            {FOOTER_LINKS.map((link) => (
              <Link key={link.label} to={link.to!} onClick={() => setOpen(false)} className="whitespace-nowrap transition-colors hover:text-white/70">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
