import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'

export function StudioSettings() {
  return (
    <div className={STUDIO_PAGE_WIDE}>
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Configuración</h1>
      <p className="mt-2 text-muted-foreground">Próximamente: preferencias de cuenta, notificaciones y seguridad.</p>
      <div className="mt-10 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border py-20 text-center">
        <span className="text-4xl opacity-40">⚙️</span>
        <p className="font-semibold">Todavía no hay ajustes configurables</p>
      </div>
    </div>
  )
}
