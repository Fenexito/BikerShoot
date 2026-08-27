import { Link } from 'react-router-dom'
import { Button } from '../../ui/flat/Button'
import { Card } from '../../ui/flat/Card'
import { Badge } from '../../ui/flat/Badge'

export function Landing() {
  return (
    <div className="font-flat">
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary px-6 py-28 text-white md:px-16">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-16 left-0 h-56 w-56 rotate-12 bg-white/10" />
        <div className="pointer-events-none absolute right-1/4 top-10 h-24 w-24 rounded-full bg-amber-400/20" />

        <div className="relative mx-auto max-w-5xl text-center">
          <Badge tone="accent">Fotografía de motociclismo</Badge>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight md:text-6xl">
            Tus fotos de moto, encontradas en segundos.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-white/90">
            Miles de fotos de eventos, rodadas y encuentros. Búscalas por fecha, fotógrafo o
            ubicación y llévate las tuyas en alta calidad.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link to="/signup">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90">
                Buscar mis fotos
              </Button>
            </Link>
            <Link to="/studio/signup">
              <Button
                variant="outline"
                size="lg"
                className="border-white text-white hover:bg-white hover:text-primary"
              >
                Soy fotógrafo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Elige tu portal */}
      <section className="mx-auto max-w-5xl px-6 py-20 md:px-16">
        <h2 className="mb-2 text-center text-3xl font-bold tracking-tight">¿Cómo quieres entrar?</h2>
        <p className="mb-12 text-center text-muted-foreground">Dos experiencias, un mismo lugar.</p>

        <div className="grid gap-6 md:grid-cols-2">
          <Card tint="blue" className="cursor-default hover:scale-100">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white text-3xl">
              🏍️
            </div>
            <h3 className="mt-5 text-2xl font-bold">Soy biker</h3>
            <p className="mt-2 text-muted-foreground">
              Busca tus fotos por evento o ubicación, compra y descarga en alta calidad.
            </p>
            <div className="mt-6 flex gap-3">
              <Link to="/login" className="flex-1">
                <Button variant="secondary" className="w-full">
                  Iniciar sesión
                </Button>
              </Link>
              <Link to="/signup" className="flex-1">
                <Button className="w-full">Crear cuenta</Button>
              </Link>
            </div>
          </Card>

          <Card tint="amber" className="cursor-default hover:scale-100">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white text-3xl">
              📷
            </div>
            <h3 className="mt-5 text-2xl font-bold">Soy fotógrafo</h3>
            <p className="mt-2 text-muted-foreground">
              Sube tus eventos, gestiona pedidos y cobra directamente en MotoShots Studio.
            </p>
            <div className="mt-6 flex gap-3">
              <Link to="/studio/login" className="flex-1">
                <Button variant="secondary" className="w-full">
                  Iniciar sesión
                </Button>
              </Link>
              <Link to="/studio/signup" className="flex-1">
                <Button className="w-full bg-amber-500 hover:bg-amber-600">Crear estudio</Button>
              </Link>
            </div>
          </Card>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="bg-muted px-6 py-20 md:px-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center text-3xl font-bold tracking-tight">Cómo funciona</h2>
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
                📥
              </div>
              <h3 className="mt-4 text-xl font-bold">Descarga</h3>
              <p className="mt-2 text-muted-foreground">Tus fotos en alta calidad, al instante.</p>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
