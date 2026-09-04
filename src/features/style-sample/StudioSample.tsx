import { useEffect } from 'react'
import { Button } from '../../ui/studio/Button'
import { Input } from '../../ui/studio/Input'
import { Card } from '../../ui/studio/Card'
import { Badge } from '../../ui/studio/Badge'
import { ThemeToggle } from '../../ui/studio/ThemeToggle'
import { useStudioTheme } from '../../ui/studio/themeStore'

export function StudioSample() {
  const theme = useStudioTheme((s) => s.theme)

  useEffect(() => {
    document.body.className = `theme-studio ${theme === 'dark' ? 'dark' : ''}`
    return () => {
      document.body.className = ''
    }
  }, [theme])

  return (
    <div className="min-h-screen bg-background px-6 py-16 text-foreground md:px-16 md:py-24">
      <div className="mx-auto flex max-w-5xl flex-col gap-24">
        <header className="flex items-center justify-between border-b border-border pb-6">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Bold Typography — Studio
          </span>
          <ThemeToggle />
        </header>

        <section>
          <span className="text-sm font-medium uppercase tracking-wide text-accent">
            Fotógrafos profesionales
          </span>
          <h1 className="mt-4 font-studio text-6xl font-extrabold leading-tight tracking-tight2 md:text-8xl">
            Tu trabajo,
            <br />
            expuesto en grande.
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Sube tus fotos de evento, gestiona pedidos y cobra sin fricción. MotoShots Studio
            es la herramienta que respeta tu trabajo.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-8">
            <Button variant="primary" size="lg">
              Empezar ahora
            </Button>
            <Button variant="ghost" size="lg">
              Ver planes
            </Button>
          </div>
        </section>

        <section className="border-t border-border pt-16">
          <h2 className="mb-8 font-studio-display text-3xl italic text-foreground">
            “El detalle es lo único que importa.”
          </h2>

          <div className="grid gap-8 md:grid-cols-3">
            <Card>
              <Badge>Eventos</Badge>
              <h3 className="mt-4 font-studio text-2xl font-bold">Carga rápida</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Sube cientos de fotos por evento con procesamiento automático de variantes.
              </p>
            </Card>
            <Card highlighted>
              <h3 className="mt-4 font-studio text-2xl font-bold">Plan Pro</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Más almacenamiento, estadísticas avanzadas y prioridad en soporte.
              </p>
            </Card>
            <Card>
              <Badge>Pagos</Badge>
              <h3 className="mt-4 font-studio text-2xl font-bold">Cobros directos</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Tarjeta y transferencia, con conciliación automática de pedidos.
              </p>
            </Card>
          </div>
        </section>

        <section className="border-t border-border pt-16">
          <h2 className="mb-8 font-studio text-4xl font-bold tracking-tight2">Crear cuenta</h2>
          <div className="grid max-w-md gap-4">
            <Input label="Correo" type="email" placeholder="tu@estudio.com" />
            <Input label="Contraseña" type="password" placeholder="••••••••" />
            <Button variant="secondary" size="default" className="mt-2">
              Continuar
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
