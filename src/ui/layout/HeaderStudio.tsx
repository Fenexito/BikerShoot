import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { ThemeSwitcherInline } from '../studio/ThemeSwitcherInline'
import { useAuth } from '../../features/auth/AuthContext'
import { usePhotographerDetails } from '../../features/photographer/usePhotographerDetails'
import { r2Url } from '../../lib/r2'
import { IconUser, IconLogOut, IconArchive, IconCreditCard, IconSettings, IconSparkles, IconImages, IconCart, IconPlus } from '../shared/icons'
import { InitialsAvatar } from '../shared/InitialsAvatar'
import { ProfileMenu } from '../shared/ProfileMenu'
import { NotificationsMenu } from '../shared/NotificationsMenu'
import { SocialLinks } from '../shared/SocialLinks'
import { MobileBottomNav } from '../shared/MobileBottomNav'
import { useAutoHideHeader } from '../shared/useAutoHideHeader'
import { HeaderBackSlot } from '../shared/HeaderBackSlot'
import { cn } from '../../lib/cn'

const NAV_ITEMS = [
  { to: '/studio/eventos', label: 'Eventos' },
  { to: '/studio/pedidos', label: 'Pedidos' },
  { to: '/studio/almacenamiento', label: 'Almacenamiento' },
  { to: '/studio/planes', label: 'Planes' },
]

export function HeaderStudio() {
  const { user, profile, signOut } = useAuth()
  const { data: details } = usePhotographerDetails(user?.id)
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      navigate('/')
    } finally {
      setSigningOut(false)
    }
  }

  const avatarUrl = profile?.avatar_url ? (profile.avatar_url.startsWith('http') ? profile.avatar_url : r2Url(profile.avatar_url)) : null
  const profileIncomplete = !!details && (!details.bio || !details.city || !details.whatsapp)
  const hidden = useAutoHideHeader()

  return (
    <>
      <div
        className={cn(
          'fixed inset-x-0 top-0 z-30 px-3 pt-3 transition-transform duration-300 md:sticky md:top-4 md:px-6 md:pt-0 md:!translate-y-0',
          hidden ? '-translate-y-[calc(100%+1rem)]' : 'translate-y-0',
        )}
      >
        <header className="mx-auto flex h-16 max-w-screen-xl items-center gap-4 rounded-full border border-border bg-background/90 px-4 shadow-sm backdrop-blur-md md:px-6">
          <HeaderBackSlot />
          <Link to="/studio" className="shrink-0 font-studio text-lg font-bold tracking-tight2">
            MotoShots Studio
          </Link>
          <nav className="ml-2 hidden flex-1 items-center gap-1 text-sm font-medium md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-full px-3.5 py-2 transition-colors duration-150',
                    isActive ? 'bg-foreground/10 font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <NotificationsMenu />
            <div className="hidden md:block">
              <ProfileMenu
                name={profile?.display_name ?? 'Estudio'}
                email={user?.email}
                avatar={
                  avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <InitialsAvatar name={profile?.display_name ?? 'S'} className="h-full w-full bg-accent text-sm text-accent-foreground" />
                  )
                }
                socialLinks={
                  <SocialLinks
                    instagramUrl={details?.instagram_url}
                    facebookUrl={details?.facebook_url}
                    tiktokUrl={details?.tiktok_url}
                    iconClassName="text-white/50 hover:text-white"
                  />
                }
                editProfile={profileIncomplete ? { label: 'Completar perfil', to: '/studio/perfil' } : undefined}
                themeSwitcher={<ThemeSwitcherInline />}
                sections={[
                  [
                    { to: '/studio/perfil', label: 'Mi perfil', icon: <IconUser className="h-4 w-4" /> },
                    { to: '/studio/almacenamiento', label: 'Almacenamiento', icon: <IconArchive className="h-4 w-4" /> },
                    { to: '/studio/planes', label: 'Planes y facturación', icon: <IconCreditCard className="h-4 w-4" /> },
                  ],
                  [
                    { to: '/studio/ajustes', label: 'Configuración', icon: <IconSettings className="h-4 w-4" /> },
                    { to: '/changelog', label: 'Novedades', icon: <IconSparkles className="h-4 w-4" /> },
                    { onClick: handleSignOut, label: signingOut ? 'Saliendo…' : 'Cerrar sesión', icon: <IconLogOut className="h-4 w-4" />, tone: 'danger' },
                  ],
                ]}
              />
            </div>
          </div>
        </header>
      </div>

      <MobileBottomNav
        items={[
          { to: '/studio/eventos', label: 'Eventos', icon: <IconImages className="h-full w-full" /> },
          { to: '/studio/pedidos', label: 'Pedidos', icon: <IconCart className="h-full w-full" /> },
          { to: '/studio/almacenamiento', label: 'Espacio', icon: <IconArchive className="h-full w-full" /> },
          { to: '/studio/perfil', label: 'Perfil', icon: <IconUser className="h-full w-full" /> },
        ]}
        primary={{ to: '/studio/eventos/new', label: 'Crear', icon: <IconPlus className="h-full w-full" /> }}
        activeClassName="text-accent"
      />
    </>
  )
}
