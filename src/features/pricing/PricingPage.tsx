import { Link } from 'react-router-dom'
import { useStoragePlans, useStorageAddons, useFeatureAddons } from '../photographer/usePhotographerDetails'
import { Button } from '../../ui/flat/Button'
import { Card } from '../../ui/flat/Card'
import { Skeleton } from '../../ui/shared/Skeleton'

const PLAN_TAGLINES: Record<string, string> = {
  gratis: 'Para conocer la plataforma con tu primer evento.',
  starter: 'Para el fotógrafo que recién empieza a cobrar por sus fotos.',
  basico: 'Para el fotógrafo que ya cubre rodadas con regularidad.',
  plus: 'Para quien ya vende seguido y quiere ver qué le funciona.',
  pro: 'Para rodadas grandes con varios puntos de foto.',
  estudio: 'Para estudios con alto volumen de eventos simultáneos.',
}

const FAQ = [
  {
    q: '¿Cobran comisión por cada venta?',
    a: 'No sobre tu precio — recibes el 100% de lo que publicas. Hay una tarifa de servicio que paga el biker (aparte de tu precio): Q2 por una sola foto, y baja proporcionalmente en pedidos con más fotos tuyas, con un tope de Q10 sin importar cuántas compre. Se liquida junto a tu factura de plan mensual.',
  },
  {
    q: '¿Puedo poner mi propio descuento por comprar varias fotos?',
    a: 'Sí — desde tu panel defines tu propia tabla de "cuántas fotos por cuánto", que se calcula sobre todas tus fotos en un mismo pedido, sin importar de qué evento o punto vengan.',
  },
  {
    q: '¿Puedo regalar fotos a un cliente?',
    a: 'Sí, desde el detalle de cualquier pedido real — el margen para hacerlo crece con el tamaño del pedido, para que no se vuelva un descuento disfrazado.',
  },
  {
    q: '¿Qué pasa si me quedo sin espacio a mitad de mes?',
    a: 'Puedes agregar bloques de espacio adicional sobre tu plan actual, sin tener que subir de plan completo.',
  },
]

export function PricingPage() {
  const { data: plans } = useStoragePlans()
  const { data: storageAddons = [] } = useStorageAddons()
  const { data: featureAddons = [] } = useFeatureAddons()

  return (
    <div className="font-flat">
      <section className="px-6 pb-16 pt-16 text-center md:px-16 md:pt-24">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          Para fotógrafos
        </span>
        <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
          Un plan por tu almacenamiento. Cero comisión sobre tu precio.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Publica tus eventos, vende directo desde la app, y quédate con el 100% de lo que cobras por cada foto.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-4 md:px-8">
        {!plans ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-full rounded-3xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={plan.id === 'pro' ? 'cursor-default border-2 border-primary hover:scale-100' : 'cursor-default hover:scale-100'}
              >
                {plan.id === 'pro' && (
                  <span className="mb-3 inline-block rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    El más elegido
                  </span>
                )}
                <h3 className="text-xl font-bold tracking-tight">{plan.name}</h3>
                <p className="mt-1 min-h-[2.5rem] text-sm text-muted-foreground">{PLAN_TAGLINES[plan.id]}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold">{plan.price_monthly_gtq === 0 ? 'Gratis' : `Q${plan.price_monthly_gtq}`}</span>
                  {plan.price_monthly_gtq > 0 && <span className="text-xs text-muted-foreground">/ mes</span>}
                </div>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{plan.gb_limit} GB de espacio</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {plan.max_active_events === 1 ? '1 evento activo a la vez' : 'Eventos activos ilimitados'}
                </p>
              </Card>
            ))}
          </div>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿Te falta espacio a mitad de mes?{' '}
          {storageAddons.map((a, i) => (
            <span key={a.id}>
              {i > 0 && ' · '}
              <strong className="text-foreground">{a.name}</strong> por Q{a.price_monthly_gtq}/mes
            </span>
          ))}{' '}
          — sobre cualquier plan pagado, sin cambiar de plan.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16 md:px-8">
        <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">Extras à la carte</h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-muted-foreground">
          Funciones nativas de un plan más alto, disponibles sueltas sobre el tuyo — sin forzarte a subir de plan por una sola cosa.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {featureAddons.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5">
              <span className="font-semibold">{f.name}</span>
              <span className="shrink-0 text-sm text-muted-foreground">+Q{f.price_monthly_gtq}/mes</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-muted px-4 py-16 md:px-8">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Tu propia tabla de precios por volumen</h2>
            <p className="mt-3 text-muted-foreground">
              Define cuánto cobras por 2, 3, 5 o más fotos en un mismo pedido — se calcula sobre todas tus fotos en ese pedido,
              sin importar de qué evento o punto vengan. Sin tabla propia, cada foto se cobra a tu precio normal.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Cortesías para tus clientes frecuentes</h2>
            <p className="mt-3 text-muted-foreground">
              Regala fotos desde el detalle de cualquier pedido real. El margen para hacerlo crece con el tamaño del pedido — y
              en el plan Pro (o con el extra "Cortesías ampliadas") tienes todavía más margen.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-4 py-16 md:px-8">
        <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">Preguntas frecuentes</h2>
        <div className="mt-8 flex flex-col gap-6">
          {FAQ.map((item) => (
            <div key={item.q}>
              <h3 className="font-bold">{item.q}</h3>
              <p className="mt-1 text-muted-foreground">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 pb-24 text-center md:px-16">
        <Link to="/studio/signup">
          <Button size="lg">Crear cuenta de fotógrafo gratis</Button>
        </Link>
      </section>
    </div>
  )
}
