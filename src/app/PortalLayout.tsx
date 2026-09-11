import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { cn } from '../lib/cn'
import { HeaderPublic } from '../ui/layout/HeaderPublic'
import { HeaderUser } from '../ui/layout/HeaderUser'
import { HeaderStudio } from '../ui/layout/HeaderStudio'
import { HeaderAdmin } from '../ui/layout/HeaderAdmin'
import { Footer } from '../ui/layout/Footer'
import { Toaster } from '../ui/overlays/Toaster'
import { ConfirmDialog } from '../ui/overlays/ConfirmDialog'
import { TypedConfirmDialog } from '../ui/overlays/TypedConfirmDialog'
import { SegmentPickerDialog } from '../ui/overlays/SegmentPickerDialog'
import { ScrollRestoration } from './ScrollRestoration'
import { BugReportWidget } from '../features/bug-reports/BugReportWidget'
import { useStudioTheme } from '../ui/studio/themeStore'
import { useFlatTheme } from '../ui/flat/themeStore'
import { RouteFallback } from '../ui/shared/RouteFallback'

const AUTH_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/studio/login',
  '/studio/signup',
  '/studio/forgot-password',
  '/studio/onboarding',
]

// Estas páginas de entrada al portal Studio siempre se ven oscuras,
// sin importar qué tema haya elegido el usuario la última vez dentro de
// la app ya autenticada — son la primera impresión de marca, no un lugar
// donde la preferencia guardada deba pisar el diseño.
const STUDIO_ALWAYS_DARK_PATHS = ['/studio/login', '/studio/signup', '/studio/forgot-password']

export function PortalLayout() {
  const { pathname } = useLocation()
  const studioTheme = useStudioTheme((s) => s.theme)
  const flatTheme = useFlatTheme((s) => s.theme)

  const isUserPortal = pathname.startsWith('/app')
  const isStudioPortal = pathname.startsWith('/studio')
  const isAdminPortal = pathname.startsWith('/admin')
  const isAuthPage = AUTH_PATHS.includes(pathname)

  const themeClass = isStudioPortal
    ? cn('theme-studio', STUDIO_ALWAYS_DARK_PATHS.includes(pathname) ? 'dark' : studioTheme)
    : isUserPortal
      ? cn('theme-flat', flatTheme)
      : 'theme-flat'
  const isDark = themeClass.includes('dark')

  // Los colores del tema (incluido --color-background/--color-muted-foreground,
  // que usa la barra de scroll nativa) viven escondidos en `.theme-studio.dark`
  // sobre #portal-theme-root — <html> nunca los ve, así que cualquier estilo
  // puesto directo en `html`/`:root` (como la barra de scroll del documento)
  // siempre resolvía a los valores claros por defecto sin importar el tema
  // activo. Reflejar la misma clase en <html> (y `color-scheme` para que los
  // controles nativos del navegador — scrollbar incluida, en cualquier
  // elemento que llegue a necesitarla — sigan el tema solos) arregla esto de
  // raíz en vez de parchar cada barra de scroll una por una.
  useEffect(() => {
    document.documentElement.className = themeClass
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
  }, [themeClass, isDark])

  return (
    <div
      id="portal-theme-root"
      // `min-h-dvh` (dynamic viewport height) en vez de `min-h-screen`
      // (100vh estático) — en Chrome/Safari de iPhone, la barra del
      // navegador se oculta/aparece al hacer scroll y cambia la altura real
      // visible; con 100vh fijo eso hacía que el layout (y el menú inferior
      // `fixed`) se reajustara de golpe cada vez, sintiéndose brusco. `dvh`
      // sigue el alto visible real en cada momento, así el reacomodo es
      // continuo en vez de un salto.
      className={cn('flex min-h-dvh flex-col bg-background text-foreground transition-colors duration-300', themeClass)}
    >
      <ScrollRestoration />
      {!isAuthPage && (
        isAdminPortal ? <HeaderAdmin /> : isUserPortal ? <HeaderUser /> : isStudioPortal ? <HeaderStudio /> : <HeaderPublic />
      )}
      <div
        className={cn(
          'flex-1',
          // El header del portal biker bajó de alto (h-16 → h-14 en móvil,
          // ver HeaderUser.tsx) para ocupar menos espacio en pantallas
          // chicas — el padding compensatorio baja con él. Studio no tocó
          // su alto, así que se queda con el valor de siempre.
          isUserPortal && !isAuthPage && 'pb-20 pt-[4.25rem] md:pb-0 md:pt-0',
          isStudioPortal && !isAuthPage && 'pb-20 pt-[4.75rem] md:pb-0 md:pt-0',
        )}
      >
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </div>
      {!isUserPortal && !isStudioPortal && !isAdminPortal && !isAuthPage && <Footer />}
      <Toaster />
      <ConfirmDialog />
      <TypedConfirmDialog />
      <SegmentPickerDialog />
      {!isAdminPortal && <BugReportWidget />}
    </div>
  )
}
