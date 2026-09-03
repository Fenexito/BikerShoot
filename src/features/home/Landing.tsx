import { Link } from 'react-router-dom'
import { Button } from '../../ui/flat/Button'
import { Card } from '../../ui/flat/Card'

export function Landing() {
  return (
    <div className="font-flat">
      {/* Hero */}
      <section className="px-6 pb-24 pt-16 text-center md:px-16 md:pt-24">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-4xl shadow-lg shadow-primary/20">
          🏍️
        </div>
        <h1 className="mx-auto mt-8 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
          Tus fotos de moto, encontradas en segundos.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Miles de fotos de rodadas, pistas y encuentros por todo Guatemala. Búscalas por fecha,
          fotógrafo o ruta y llévate las tuyas en alta calidad.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link to="/signup">
            <Button size="lg">Buscar mis fotos</Button>
          </Link>
          <Link to="/studio/signup">
            <Button variant="outline" size="lg">
              Soy fotógrafo →
            </Button>
          </Link>
        </div>
      </section>

      {/* Elige tu portal */}
      <section className="mx-auto max-w-5xl px-6 py-10 md:px-16">
        <div className="grid gap-6 md:grid-cols-2">
          <Card tint="blue" className="cursor-default hover:scale-100">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">
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
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">
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
      <section className="px-6 py-20 md:px-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-2 text-center text-3xl font-bold tracking-tight md:text-4xl">Cómo funciona</h2>
          <p className="mb-12 text-center text-muted-foreground">Tres pasos, sin complicaciones.</p>
          <div className="grid gap-6 md:grid-cols-3">
            <Card tint="blue">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-primary shadow-sm transition-transform duration-200 group-hover:scale-110">
                🔍
              </div>
              <h3 className="mt-4 text-xl font-bold">Busca</h3>
              <p className="mt-2 text-muted-foreground">Filtra por fecha, evento, ruta o fotógrafo.</p>
            </Card>
            <Card tint="emerald">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-secondary shadow-sm transition-transform duration-200 group-hover:scale-110">
                🛒
              </div>
              <h3 className="mt-4 text-xl font-bold">Compra</h3>
              <p className="mt-2 text-muted-foreground">Tarjeta o transferencia, como prefieras.</p>
            </Card>
            <Card tint="amber">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-accent shadow-sm transition-transform duration-200 group-hover:scale-110">
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
