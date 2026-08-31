// Los overlays deben portalear dentro del wrapper temático (#portal-theme-root en
// PortalLayout.tsx) en vez de document.body — si no, pierden las variables CSS de
// tema (theme-studio/theme-flat, claro/oscuro) y caen a los valores de :root.
export function getPortalRoot(): Element {
  return document.getElementById('portal-theme-root') ?? document.body
}
