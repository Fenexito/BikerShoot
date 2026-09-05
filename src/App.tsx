import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { PortalLayout } from './app/PortalLayout'
import { RequireBiker } from './features/auth/RequireBiker'
import { RequireStudio } from './features/auth/RequireStudio'
import { RequireAdmin } from './features/admin/RequireAdmin'
import { RouteFallback } from './ui/shared/RouteFallback'

const PlaceholderPage = lazy(() => import('./features/auth/PlaceholderPage').then((m) => ({ default: m.PlaceholderPage })))
const ChangelogPage = lazy(() => import('./features/changelog/ChangelogPage').then((m) => ({ default: m.ChangelogPage })))
const StudioSample = lazy(() => import('./features/style-sample/StudioSample').then((m) => ({ default: m.StudioSample })))
const FlatSample = lazy(() => import('./features/style-sample/FlatSample').then((m) => ({ default: m.FlatSample })))
const Landing = lazy(() => import('./features/home/Landing').then((m) => ({ default: m.Landing })))
const BikerLogin = lazy(() => import('./features/auth/BikerLogin').then((m) => ({ default: m.BikerLogin })))
const BikerSignup = lazy(() => import('./features/auth/BikerSignup').then((m) => ({ default: m.BikerSignup })))
const BikerForgotPassword = lazy(() => import('./features/auth/BikerForgotPassword').then((m) => ({ default: m.BikerForgotPassword })))
const StudioLogin = lazy(() => import('./features/auth/StudioLogin').then((m) => ({ default: m.StudioLogin })))
const StudioSignup = lazy(() => import('./features/auth/StudioSignup').then((m) => ({ default: m.StudioSignup })))
const StudioForgotPassword = lazy(() => import('./features/auth/StudioForgotPassword').then((m) => ({ default: m.StudioForgotPassword })))
const ResetPassword = lazy(() => import('./features/auth/ResetPassword').then((m) => ({ default: m.ResetPassword })))
const BikerProfilePage = lazy(() => import('./features/biker/BikerProfilePage').then((m) => ({ default: m.BikerProfilePage })))
const BikerHome = lazy(() => import('./features/biker/Home').then((m) => ({ default: m.Home })))
const BikerSearch = lazy(() => import('./features/biker/Search').then((m) => ({ default: m.Search })))
const BikerEvents = lazy(() => import('./features/biker/Events').then((m) => ({ default: m.Events })))
const BikerEventDetail = lazy(() => import('./features/biker/EventDetail').then((m) => ({ default: m.EventDetail })))
const PhotographersList = lazy(() => import('./features/biker/PhotographersList').then((m) => ({ default: m.PhotographersList })))
const PhotographerProfile = lazy(() => import('./features/biker/PhotographerProfile').then((m) => ({ default: m.PhotographerProfile })))
const BikerCheckout = lazy(() => import('./features/biker/Checkout').then((m) => ({ default: m.Checkout })))
const OrderSuccess = lazy(() => import('./features/biker/OrderSuccess').then((m) => ({ default: m.OrderSuccess })))
const BikerFavorites = lazy(() => import('./features/biker/Favorites').then((m) => ({ default: m.Favorites })))
const BikerHistory = lazy(() => import('./features/biker/History').then((m) => ({ default: m.History })))
const BikerHistoryOrderDetail = lazy(() => import('./features/biker/HistoryOrderDetail').then((m) => ({ default: m.HistoryOrderDetail })))
const RouteMap = lazy(() => import('./features/biker/RouteMap').then((m) => ({ default: m.RouteMap })))
const StudioOnboarding = lazy(() => import('./features/photographer/StudioOnboarding').then((m) => ({ default: m.StudioOnboarding })))
const StudioProfilePage = lazy(() => import('./features/photographer/StudioProfilePage').then((m) => ({ default: m.StudioProfilePage })))
const StudioSettings = lazy(() => import('./features/photographer/StudioSettings').then((m) => ({ default: m.StudioSettings })))
const StudioStorage = lazy(() => import('./features/photographer/StudioStorage').then((m) => ({ default: m.StudioStorage })))
const StudioPlans = lazy(() => import('./features/photographer/StudioPlans').then((m) => ({ default: m.StudioPlans })))
const StudioHome = lazy(() => import('./features/photographer/StudioHome').then((m) => ({ default: m.StudioHome })))
const StudioEvents = lazy(() => import('./features/photographer/StudioEvents').then((m) => ({ default: m.StudioEvents })))
const StudioEventView = lazy(() => import('./features/photographer/StudioEventView').then((m) => ({ default: m.StudioEventView })))
const StudioEventEditor = lazy(() => import('./features/photographer/StudioEventEditor').then((m) => ({ default: m.StudioEventEditor })))
const StudioOrders = lazy(() => import('./features/photographer/StudioOrders').then((m) => ({ default: m.StudioOrders })))
const StudioOrderDetail = lazy(() => import('./features/photographer/StudioOrderDetail').then((m) => ({ default: m.StudioOrderDetail })))
const ApprovePhotographers = lazy(() => import('./features/admin/ApprovePhotographers').then((m) => ({ default: m.ApprovePhotographers })))
const AdminHome = lazy(() => import('./features/admin/AdminHome').then((m) => ({ default: m.AdminHome })))
const BugReportsAdmin = lazy(() => import('./features/admin/BugReportsAdmin').then((m) => ({ default: m.BugReportsAdmin })))
const ReleasesAdmin = lazy(() => import('./features/admin/ReleasesAdmin').then((m) => ({ default: m.ReleasesAdmin })))
const StoragePlansAdmin = lazy(() => import('./features/admin/StoragePlansAdmin').then((m) => ({ default: m.StoragePlansAdmin })))
const AuthCallback = lazy(() => import('./features/auth/AuthCallback').then((m) => ({ default: m.AuthCallback })))
const PrivacyPage = lazy(() => import('./features/legal/PrivacyPage').then((m) => ({ default: m.PrivacyPage })))
const TermsPage = lazy(() => import('./features/legal/TermsPage').then((m) => ({ default: m.TermsPage })))
const CopyrightPage = lazy(() => import('./features/legal/CopyrightPage').then((m) => ({ default: m.CopyrightPage })))

export default function App() {
  return (
    <Routes>
      {/* Muestras de los dos sistemas de diseño — temporal, para validar antes de aplicar al sitio.
          Suspense individual: estas rutas no viven dentro de PortalLayout, así que no hay
          header/footer persistente que proteger de un remount. */}
      <Route path="/style-sample/studio" element={<Suspense fallback={<RouteFallback />}><StudioSample /></Suspense>} />
      <Route path="/style-sample/flat" element={<Suspense fallback={<RouteFallback />}><FlatSample /></Suspense>} />
      <Route path="/auth/callback" element={<Suspense fallback={<RouteFallback />}><AuthCallback /></Suspense>} />

      <Route element={<PortalLayout />}>
          {/* Público */}
          <Route index element={<Landing />} />
          <Route path="/login" element={<BikerLogin />} />
          <Route path="/signup" element={<BikerSignup />} />
          <Route path="/forgot-password" element={<BikerForgotPassword />} />
          <Route path="/studio/login" element={<StudioLogin />} />
          <Route path="/studio/signup" element={<StudioSignup />} />
          <Route path="/studio/forgot-password" element={<StudioForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/eres-fotografo" element={<PlaceholderPage title="Soy fotógrafo" />} />
          <Route path="/fotografos" element={<PlaceholderPage title="Fotógrafos" />} />
          <Route path="/eventos" element={<PlaceholderPage title="Eventos" />} />
          <Route path="/precios" element={<PlaceholderPage title="Precios" />} />
          <Route path="/changelog" element={<ChangelogPage />} />
          <Route path="/privacidad" element={<PrivacyPage />} />
          <Route path="/terminos" element={<TermsPage />} />
          <Route path="/derechos-de-autor" element={<CopyrightPage />} />

          {/* Biker (requiere sesión) */}
          <Route path="/app" element={<RequireBiker><BikerHome /></RequireBiker>} />
          <Route path="/app/buscar" element={<RequireBiker><BikerSearch /></RequireBiker>} />
          <Route path="/app/eventos" element={<RequireBiker><BikerEvents /></RequireBiker>} />
          <Route path="/app/eventos/:id" element={<RequireBiker><BikerEventDetail /></RequireBiker>} />
          <Route path="/app/mapa" element={<RequireBiker><RouteMap /></RequireBiker>} />
          <Route path="/app/fotografos" element={<RequireBiker><PhotographersList /></RequireBiker>} />
          <Route path="/app/fotografos/:id" element={<RequireBiker><PhotographerProfile /></RequireBiker>} />
          <Route path="/app/favoritos" element={<RequireBiker><BikerFavorites /></RequireBiker>} />
          <Route path="/app/historial" element={<RequireBiker><BikerHistory /></RequireBiker>} />
          <Route path="/app/historial/:id" element={<RequireBiker><BikerHistoryOrderDetail /></RequireBiker>} />
          <Route path="/app/perfil" element={<RequireBiker><BikerProfilePage /></RequireBiker>} />
          <Route path="/app/checkout" element={<RequireBiker><BikerCheckout /></RequireBiker>} />
          <Route path="/app/pedido-confirmado" element={<RequireBiker><OrderSuccess /></RequireBiker>} />

          {/* Fotógrafo (requiere sesión de studio) */}
          <Route path="/studio/onboarding" element={<RequireStudio skipOnboardingCheck><StudioOnboarding /></RequireStudio>} />
          <Route path="/studio" element={<RequireStudio><StudioHome /></RequireStudio>} />
          <Route path="/studio/eventos" element={<RequireStudio><StudioEvents /></RequireStudio>} />
          <Route path="/studio/eventos/new" element={<RequireStudio><StudioEventEditor /></RequireStudio>} />
          <Route path="/studio/eventos/:id" element={<RequireStudio><StudioEventView /></RequireStudio>} />
          <Route path="/studio/eventos/:id/editar" element={<RequireStudio><StudioEventEditor /></RequireStudio>} />
          <Route path="/studio/pedidos" element={<RequireStudio><StudioOrders /></RequireStudio>} />
          <Route path="/studio/pedidos/:id" element={<RequireStudio><StudioOrderDetail /></RequireStudio>} />
          <Route path="/studio/perfil" element={<RequireStudio><StudioProfilePage /></RequireStudio>} />
          <Route path="/studio/ajustes" element={<RequireStudio><StudioSettings /></RequireStudio>} />
          <Route path="/studio/almacenamiento" element={<RequireStudio><StudioStorage /></RequireStudio>} />
          <Route path="/studio/planes" element={<RequireStudio><StudioPlans /></RequireStudio>} />

          {/* Admin */}
          <Route path="/admin" element={<RequireAdmin><AdminHome /></RequireAdmin>} />
          <Route path="/admin/bug-reports" element={<RequireAdmin><BugReportsAdmin /></RequireAdmin>} />
          <Route path="/admin/aprobar-fotografos" element={<RequireAdmin><ApprovePhotographers /></RequireAdmin>} />
          <Route path="/admin/releases" element={<RequireAdmin><ReleasesAdmin /></RequireAdmin>} />
          <Route path="/admin/planes" element={<RequireAdmin><StoragePlansAdmin /></RequireAdmin>} />
      </Route>
    </Routes>
  )
}
