import { Routes, Route } from 'react-router-dom'
import { PortalLayout } from './app/PortalLayout'
import { PlaceholderPage } from './features/auth/PlaceholderPage'
import { ChangelogPage } from './features/changelog/ChangelogPage'
import { StudioSample } from './features/style-sample/StudioSample'
import { FlatSample } from './features/style-sample/FlatSample'
import { Landing } from './features/home/Landing'
import { BikerLogin } from './features/auth/BikerLogin'
import { BikerSignup } from './features/auth/BikerSignup'
import { BikerForgotPassword } from './features/auth/BikerForgotPassword'
import { StudioLogin } from './features/auth/StudioLogin'
import { StudioSignup } from './features/auth/StudioSignup'
import { StudioForgotPassword } from './features/auth/StudioForgotPassword'
import { ResetPassword } from './features/auth/ResetPassword'
import { RequireBiker } from './features/auth/RequireBiker'
import { RequireStudio } from './features/auth/RequireStudio'
import { BikerProfilePage } from './features/biker/BikerProfilePage'
import { Home as BikerHome } from './features/biker/Home'
import { Search as BikerSearch } from './features/biker/Search'
import { Events as BikerEvents } from './features/biker/Events'
import { EventDetail as BikerEventDetail } from './features/biker/EventDetail'
import { PhotographersList } from './features/biker/PhotographersList'
import { PhotographerProfile } from './features/biker/PhotographerProfile'
import { Checkout as BikerCheckout } from './features/biker/Checkout'
import { OrderSuccess } from './features/biker/OrderSuccess'
import { Favorites as BikerFavorites } from './features/biker/Favorites'
import { History as BikerHistory } from './features/biker/History'
import { RouteMap } from './features/biker/RouteMap'
import { StudioOnboarding } from './features/photographer/StudioOnboarding'
import { StudioProfilePage } from './features/photographer/StudioProfilePage'
import { StudioStorage } from './features/photographer/StudioStorage'
import { StudioHome } from './features/photographer/StudioHome'
import { StudioEvents } from './features/photographer/StudioEvents'
import { StudioEventView } from './features/photographer/StudioEventView'
import { StudioEventEditor } from './features/photographer/StudioEventEditor'
import { StudioUpload } from './features/photographer/StudioUpload'
import { StudioOrders } from './features/photographer/StudioOrders'
import { StudioOrderDetail } from './features/photographer/StudioOrderDetail'
import { RequireAdmin } from './features/admin/RequireAdmin'
import { ApprovePhotographers } from './features/admin/ApprovePhotographers'
import { AdminHome } from './features/admin/AdminHome'
import { BugReportsAdmin } from './features/admin/BugReportsAdmin'
import { ReleasesAdmin } from './features/admin/ReleasesAdmin'
import { StoragePlansAdmin } from './features/admin/StoragePlansAdmin'
import { AuthCallback } from './features/auth/AuthCallback'

export default function App() {
  return (
    <Routes>
      {/* Muestras de los dos sistemas de diseño — temporal, para validar antes de aplicar al sitio */}
      <Route path="/style-sample/studio" element={<StudioSample />} />
      <Route path="/style-sample/flat" element={<FlatSample />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

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
        <Route path="/studio/estadisticas" element={<RequireStudio><PlaceholderPage title="Estadísticas" /></RequireStudio>} />
        <Route path="/studio/carga-rapida" element={<RequireStudio><StudioUpload /></RequireStudio>} />
        <Route path="/studio/perfil" element={<RequireStudio><StudioProfilePage /></RequireStudio>} />
        <Route path="/studio/almacenamiento" element={<RequireStudio><StudioStorage /></RequireStudio>} />

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
