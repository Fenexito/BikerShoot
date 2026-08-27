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
import { StudioOnboarding } from './features/photographer/StudioOnboarding'
import { StudioProfilePage } from './features/photographer/StudioProfilePage'
import { RequireAdmin } from './features/admin/RequireAdmin'
import { ApprovePhotographers } from './features/admin/ApprovePhotographers'

export default function App() {
  return (
    <Routes>
      {/* Muestras de los dos sistemas de diseño — temporal, para validar antes de aplicar al sitio */}
      <Route path="/style-sample/studio" element={<StudioSample />} />
      <Route path="/style-sample/flat" element={<FlatSample />} />

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
        <Route path="/app" element={<RequireBiker><PlaceholderPage title="Portal Biker" /></RequireBiker>} />
        <Route path="/app/buscar" element={<RequireBiker><PlaceholderPage title="Buscar fotos" /></RequireBiker>} />
        <Route path="/app/fotografos" element={<RequireBiker><PlaceholderPage title="Fotógrafos (biker)" /></RequireBiker>} />
        <Route path="/app/historial" element={<RequireBiker><PlaceholderPage title="Historial" /></RequireBiker>} />
        <Route path="/app/perfil" element={<RequireBiker><BikerProfilePage /></RequireBiker>} />
        <Route path="/app/checkout" element={<RequireBiker><PlaceholderPage title="Carrito / Checkout" /></RequireBiker>} />

        {/* Fotógrafo (requiere sesión de studio) */}
        <Route path="/studio/onboarding" element={<RequireStudio skipOnboardingCheck><StudioOnboarding /></RequireStudio>} />
        <Route path="/studio" element={<RequireStudio><PlaceholderPage title="Portal Fotógrafo" /></RequireStudio>} />
        <Route path="/studio/eventos" element={<RequireStudio><PlaceholderPage title="Eventos (studio)" /></RequireStudio>} />
        <Route path="/studio/pedidos" element={<RequireStudio><PlaceholderPage title="Pedidos" /></RequireStudio>} />
        <Route path="/studio/estadisticas" element={<RequireStudio><PlaceholderPage title="Estadísticas" /></RequireStudio>} />
        <Route path="/studio/carga-rapida" element={<RequireStudio><PlaceholderPage title="Carga rápida" /></RequireStudio>} />
        <Route path="/studio/perfil" element={<RequireStudio><StudioProfilePage /></RequireStudio>} />

        {/* Admin */}
        <Route path="/admin" element={<RequireAdmin><PlaceholderPage title="Admin" /></RequireAdmin>} />
        <Route path="/admin/bug-reports" element={<RequireAdmin><PlaceholderPage title="Reportes de bugs" /></RequireAdmin>} />
        <Route path="/admin/aprobar-fotografos" element={<RequireAdmin><ApprovePhotographers /></RequireAdmin>} />
      </Route>
    </Routes>
  )
}
