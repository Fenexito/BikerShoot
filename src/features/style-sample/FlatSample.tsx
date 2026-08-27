import { useEffect } from 'react'
import { Button } from '../../ui/flat/Button'
import { Input } from '../../ui/flat/Input'
import { Card } from '../../ui/flat/Card'
import { Badge } from '../../ui/flat/Badge'

export function FlatSample() {
  useEffect(() => {
    document.body.className = 'theme-flat'
    return () => {
      document.body.className = ''
    }
  }, [])

  return (
    <div className="min-h-screen bg-background font-flat text-foreground">
      <section className="relative overflow-hidden bg-primary px-6 py-24 text-white md:px-16">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute bottom-0 left-10 h-40 w-40 rotate-12 bg-white/10" />
        <div className="relative mx-auto max-w-5xl">
          <Badge tone="accent">Nuevo</Badge>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight md:text-6xl">
            Encuentra tus fotos de moto en segundos.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/90">
            Busca por evento, fotógrafo o ubicación. Compra tus fotos favoritas al instante.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button size="lg" className="bg-white text-primary hover:bg-white/90">
              Buscar mis fotos
            </Button>
            <Button variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-primary">
              Soy fotógrafo
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 md:px-16">
        <h2 className="mb-10 text-3xl font-bold tracking-tight">Cómo funciona</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <Card tint="blue">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white text-primary transition-transform duration-200 group-hover:scale-110">
              🔍
            </div>
            <h3 className="mt-4 text-xl font-bold">Busca</h3>
            <p className="mt-2 text-muted-foreground">Filtra por fecha, evento o fotógrafo.</p>
          </Card>
          <Card tint="emerald">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white text-secondary transition-transform duration-200 group-hover:scale-110">
              🛒
            </div>
            <h3 className="mt-4 text-xl font-bold">Compra</h3>
            <p className="mt-2 text-muted-foreground">Tarjeta o transferencia, como prefieras.</p>
          </Card>
          <Card tint="amber">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white text-accent transition-transform duration-200 group-hover:scale-110">
              📷
            </div>
            <h3 className="mt-4 text-xl font-bold">Descarga</h3>
            <p className="mt-2 text-muted-foreground">Tus fotos en alta calidad, sin marca de agua.</p>
          </Card>
        </div>
      </section>

      <section className="bg-muted px-6 py-20 md:px-16">
        <div className="mx-auto max-w-md">
          <h2 className="mb-6 text-2xl font-bold">Crear cuenta</h2>
          <div className="grid gap-4">
            <Input label="Correo" type="email" placeholder="tu@correo.com" />
            <Input label="Contraseña" type="password" placeholder="••••••••" />
            <Button size="lg">Crear cuenta</Button>
          </div>
        </div>
      </section>
    </div>
  )
}
