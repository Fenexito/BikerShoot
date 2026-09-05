import { Suspense } from 'react'
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
import { ScrollRestoration } from './ScrollRestoration'
import { BugReportWidget } from '../features/bug-reports/BugReportWidget'
import { useStudioTheme } from '../ui/studio/themeStore'
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

export function PortalLayout() {
  const { pathname } = useLocation()
  const studioTheme = useStudioTheme((s) => s.theme)

  const isUserPortal = pathname.startsWith('/app')
  const isStudioPortal = pathname.startsWith('/studio')
  const isAdminPortal = pathname.startsWith('/admin')
  const isAuthPage = AUTH_PATHS.includes(pathname)

  const themeClass = isStudioPortal ? cn('theme-studio', studioTheme) : 'theme-flat'

  return (
    <div
      id="portal-theme-root"
      className={cn('flex min-h-screen flex-col bg-background text-foreground transition-colors duration-300', themeClass)}
    >
      <ScrollRestoration />
      {!isAuthPage && (
        isAdminPortal ? <HeaderAdmin /> : isUserPortal ? <HeaderUser /> : isStudioPortal ? <HeaderStudio /> : <HeaderPublic />
      )}
      <div className="flex-1">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </div>
      {!isUserPortal && !isStudioPortal && !isAdminPortal && !isAuthPage && <Footer />}
      <Toaster />
      <ConfirmDialog />
      <TypedConfirmDialog />
      {!isAdminPortal && <BugReportWidget />}
    </div>
  )
}
