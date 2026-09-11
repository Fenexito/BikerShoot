import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { usePublicEvents, useApprovedPhotographers, useSearchPhotos } from './usePublicData'
import { previewUrl, r2Url } from '../../lib/r2'
import { EventCard } from './components/EventCard'
import { PhotographerCard } from './components/PhotographerCard'
import DriftWall from '../../ui/reactbits/DriftWall'
import AccordionGallery from '../../ui/reactbits/AccordionGallery'
import Counter from '../../ui/reactbits/Counter'

const COLLAGE_SPANS = [
  'col-span-2 row-span-2',
  'col-span-1 row-span-1',
  'col-span-1 row-span-2',
  'col-span-2 row-span-1',
  'col-span-1 row-span-1',
  'col-span-1 row-span-1',
  'col-span-2 row-span-1',
  'col-span-1 row-span-2',
  'col-span-1 row-span-1',
  'col-span-2 row-span-2',
]

/** true la primera vez que el elemento referenciado entra en pantalla —
 * usado para no disparar animaciones "de entrada" (contadores, stagger de
 * tarjetas) hasta que el usuario de verdad se desplaza hasta esa sección.
 * Usa un ref por CALLBACK (no `useRef` con un efecto de dependencias fijas)
 * a propósito: el mural de fotos vive detrás de `muralPhotos.length > 0`,
 * que arranca en 0 mientras la búsqueda todavía no responde — con un
 * `useRef` normal, el efecto que arma el `IntersectionObserver` corre una
 * sola vez (sus dependencias nunca cambian) mientras el nodo todavía no
 * existe, y nunca lo vuelve a intentar cuando la sección por fin se monta.
 * Guardar el nodo en estado hace que el efecto SÍ vuelva a correr apenas el
 * elemento aparece en el DOM. */
function useInView<T extends HTMLElement>(threshold = 0.35) {
  const [node, setNode] = useState<T | null>(null)
  const [inView, setInView] = useState(false)
  const ref = useCallback((el: T | null) => setNode(el), [])

  useEffect(() => {
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [node, threshold])

  return [ref, inView] as const
}

/** Sube de 0 hasta `target` con una curva de desaceleración — el `Counter`
 * de reactbits solo sabe MOSTRAR un valor (rodillo de dígitos animado por
 * CSS); este hook es lo que decide qué valor mostrarle en cada instante. */
function useCountUp(target: number, active: boolean, duration = 1400) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!active) return
    let raf = 0
    const start = performance.now()
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(target * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, active, duration])

  return value
}

function StatCounter({ value, label, active, delay = 0 }: { value: number; label: string; active: boolean; delay?: number }) {
  const shown = useCountUp(value, active)
  const places = useMemo(() => {
    const digits = Math.max(1, String(Math.max(1, value)).length)
    return Array.from({ length: digits }, (_, i) => 10 ** (digits - 1 - i))
  }, [value])

  return (
    <div className="flex flex-col items-center gap-1 opacity-0 animate-stat-in" style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}>
      <Counter value={shown} places={places} fontSize={40} gap={1} fontWeight={800} textColor="rgb(var(--color-primary))" />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  )
}

export function Home() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const { data: events = [] } = usePublicEvents()
  const { data: photographers = [] } = useApprovedPhotographers()
  const { data: photos = [] } = useSearchPhotos({})

  const firstName = profile?.display_name?.split(' ')[0] || 'biker'
  const sortedEvents = [...events].sort((a, b) => +new Date(b.event_date) - +new Date(a.event_date))
  const featuredEvent = sortedEvents[0]
  const recentEvents = sortedEvents.slice(1, 5)
  const muralEvents = sortedEvents.slice(0, 6)

  const collagePhotos = useMemo(() => {
    if (photos.length === 0) return []
    const step = Math.max(1, Math.floor(photos.length / 10))
    return Array.from({ length: Math.min(10, photos.length) }, (_, i) => photos[(i * step) % photos.length])
  }, [photos])

  const muralPhotos = useMemo(() => {
    if (photos.length === 0) return []
    const step = Math.max(1, Math.floor(photos.length / 30))
    return Array.from({ length: Math.min(30, photos.length) }, (_, i) => photos[(i * step) % photos.length])
  }, [photos])

  const pointCount = useMemo(() => new Set(events.flatMap((e) => e.event_points.map((p) => p.label))).size, [events])

  const stats = [
    { value: photos.length, label: 'Fotos disponibles' },
    { value: events.length, label: 'Eventos cubiertos' },
    { value: photographers.length, label: 'Fotógrafos activos' },
    { value: pointCount, label: 'Puntos de ruta' },
  ]

  const [statsRef, statsInView] = useInView<HTMLDivElement>()
  const [muralRef, muralInView] = useInView<HTMLDivElement>(0.1)
  const [photogRef, photogInView] = useInView<HTMLDivElement>(0.1)

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    navigate(query ? `/app/buscar?q=${encodeURIComponent(query)}` : '/app/buscar')
  }

  return (
    <div className="font-flat">
      {/* Hero — collage de fotos reales de fondo. `-mt-[4.25rem] md:mt-0`
          cancela el padding móvil que PortalLayout agrega al contenido
          (`pt-[4.25rem]`, para que el header flotante fijo no tape nada) —
          sin esto, esta sección (pensada a sangre completa) dejaba un tramo
          de fondo plano visible entre el header y el collage. En desktop el
          header es `sticky` (no `fixed`) y el padding ya es 0, así que no
          aplica. */}
      <section className="relative isolate -mt-[4.25rem] flex min-h-[560px] items-center overflow-hidden bg-primary md:mt-0 md:min-h-[640px]">
        {collagePhotos.length > 0 && (
          <div className="absolute inset-0 grid grid-cols-4 grid-rows-3 gap-1 md:grid-cols-6">
            {collagePhotos.map((photo, i) => (
              <img
                key={photo.id}
                src={previewUrl(photo)}
                alt=""
                className={`h-full w-full scale-110 animate-[fade-in-up_1s_ease-out_backwards] object-cover ${COLLAGE_SPANS[i % COLLAGE_SPANS.length]}`}
                style={{ animationDelay: `${i * 45}ms` }}
                loading="eager"
              />
            ))}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/80 via-black/60 to-background" />

        <div className="relative mx-auto max-w-3xl px-6 text-center text-white md:px-16">
          <span className="inline-flex animate-[fade-in-up_.5s_ease-out_backwards] items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide backdrop-blur">
            🏍️ Fotos nuevas todas las semanas
          </span>
          <h1
            className="mt-5 animate-[fade-in-up_.6s_ease-out_backwards] text-4xl font-extrabold leading-tight tracking-tight md:text-6xl"
            style={{ animationDelay: '80ms' }}
          >
            Hola {firstName}, tu próxima
            <br className="hidden md:block" /> mejor foto está aquí
          </h1>
          <p className="mt-4 animate-[fade-in-up_.6s_ease-out_backwards] text-lg text-white/85" style={{ animationDelay: '140ms' }}>
            Búscala por evento, ruta o fotógrafo en segundos.
          </p>

          <form
            onSubmit={onSearch}
            className="mx-auto mt-8 flex max-w-xl animate-[fade-in-up_.6s_ease-out_backwards] gap-2"
            style={{ animationDelay: '200ms' }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca por evento, ciudad o fotógrafo..."
              className="h-14 flex-1 rounded-full border-0 bg-white px-5 text-base text-foreground shadow-lg outline-none focus:ring-2 focus:ring-white"
            />
            {/* Botón propio (no el `Button` compartido): sus variantes ya
                traen su propio `bg-*`/`text-*` — agregar otro par distinto
                encima vía `className` los deja a los dos en el string de
                clases a la vez (`cn()` es un `clsx` plano, sin el dedup de
                `tailwind-merge`), y cuál gana depende del orden interno con
                el que Tailwind generó el CSS, no del orden en el que
                aparecen aquí. Ya causó un bug real de header invisible en
                esta misma sesión — mejor evitarlo desde cero que confiar en
                que el orden generado "por suerte" coincida. */}
            <button
              type="submit"
              className="flex h-14 shrink-0 items-center justify-center rounded-full bg-neutral-900 px-8 text-base font-semibold text-white shadow-lg transition-colors hover:bg-neutral-800"
            >
              Buscar
            </button>
          </form>

          <div
            className="mt-6 flex animate-[fade-in-up_.6s_ease-out_backwards] flex-wrap items-center justify-center gap-3 text-sm"
            style={{ animationDelay: '260ms' }}
          >
            <Link to="/app/mapa" className="rounded-full bg-white/15 px-4 py-2 font-semibold backdrop-blur transition-colors hover:bg-white/25">
              🗺️ Buscar por mapa de ruta
            </Link>
            <Link to="/app/eventos" className="rounded-full bg-white/15 px-4 py-2 font-semibold backdrop-blur transition-colors hover:bg-white/25">
              📅 Ver eventos
            </Link>
          </div>
        </div>
      </section>

      {/* Contadores animados — suben de 0 al valor real la primera vez que
          la sección entra en pantalla (ver `useInView`/`useCountUp`), no
          apenas carga la página (para que el usuario de verdad los vea
          "contar" al llegar ahí con el scroll). */}
      <section ref={statsRef} className="border-b border-border bg-background px-6 py-10 md:px-16 md:py-12">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((s, i) => (
            <StatCounter key={s.label} value={s.value} label={s.label} active={statsInView} delay={i * 90} />
          ))}
        </div>
      </section>

      {/* Mural de fotos — pared de miniaturas reales a la deriva, a sangre
          completa. Puramente ambiental (no clicable): transmite volumen y
          variedad antes de que el usuario llegue a buscar algo puntual. */}
      {muralPhotos.length > 0 && (
        <section ref={muralRef} className="relative overflow-hidden bg-neutral-950 py-14">
          <div className="pointer-events-none relative z-10 mb-8 px-6 text-center text-white md:px-16">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Miles de momentos, listos para encontrarse</h2>
            <p className="mt-2 text-white/60">Cada semana suben más fotos de más rodadas, pistas y sesiones.</p>
          </div>
          <div className="w-screen" style={{ height: 360, marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)' }}>
            {muralInView && (
              <DriftWall
                items={muralPhotos.map((p) => ({ image: previewUrl(p) }))}
                columns={Math.max(4, Math.min(10, Math.floor(muralPhotos.length / 3)))}
                tileWidth={190}
                tileHeight={190}
                gap={6}
                radius={12}
                tilt={14}
                turn={-12}
                perspective={950}
                depth={90}
                speed={20}
                variance={0.5}
                parallax={0.4}
                lift={40}
                fade={0.2}
                dim={0.85}
                overlayColor="transparent"
              />
            )}
          </div>
        </section>
      )}

      {/* Momentos recientes */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:px-16">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Momentos recientes</h2>
          <Link to="/app/eventos" className="text-sm font-semibold text-primary">
            Ver todos →
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border py-20 text-center">
            <span className="text-4xl opacity-40">📅</span>
            <p className="font-semibold">Todavía no hay eventos publicados</p>
            <p className="text-sm text-muted-foreground">Vuelve pronto o explora fotógrafos mientras tanto.</p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            {featuredEvent && (
              <div className="lg:col-span-2 lg:row-span-2">
                <Link to={`/app/eventos/${featuredEvent.id}`} className="group block h-full overflow-hidden rounded-3xl border border-border bg-muted transition-all hover:border-primary/30 hover:shadow-sm">
                  <div className="relative flex h-72 items-center justify-center overflow-hidden bg-gradient-to-br from-blue-100 to-emerald-100 lg:h-full">
                    {featuredEvent.cover_path ? (
                      <img src={r2Url(featuredEvent.cover_path)} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <span className="text-6xl opacity-30">🏍️</span>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                      <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
                        {featuredEvent.status === 'activo' ? 'Activo' : 'Cerrado'}
                      </span>
                      <h3 className="mt-3 text-2xl font-extrabold tracking-tight md:text-3xl">{featuredEvent.title}</h3>
                      <p className="mt-1 text-white/85">{featuredEvent.city} · desde Q{featuredEvent.price_per_photo} por foto</p>
                    </div>
                  </div>
                </Link>
              </div>
            )}
            {recentEvents.map((event, i) => (
              <div key={event.id} className="animate-card-in" style={{ animationDelay: `${i * 60}ms` }}>
                <EventCard event={event} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Mural de eventos — acordeón horizontal: pasa el cursor (o toca en
          móvil) sobre cada panel para expandirlo, click para entrar al
          evento. Alternativa más "viva" a una simple grilla de tarjetas
          para presentar los eventos más recientes. */}
      {muralEvents.length >= 3 && (
        <section className="bg-background px-6 py-16 md:px-16">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Explora los últimos eventos</h2>
              <p className="mt-1 text-muted-foreground">Pasa el cursor sobre cada uno — haz clic para entrar.</p>
            </div>
            <AccordionGallery
              items={muralEvents.map((e) => ({
                image: e.cover_path ? r2Url(e.cover_path) : `https://placehold.co/400x600/1e293b/ffffff?text=${encodeURIComponent(e.title)}`,
                label: (
                  <span className="flex flex-col items-start gap-0.5">
                    <span className="text-lg font-bold leading-tight">{e.title}</span>
                    <span className="text-xs font-medium text-white/70">{e.city}</span>
                  </span>
                ),
              }))}
              height={420}
              radius={20}
              expandRatio={0.4}
              tilt={8}
              parallax={0.4}
              accentColor="rgb(var(--color-primary))"
              overlayColor="#000000"
              onOpen={(i) => navigate(`/app/eventos/${muralEvents[i].id}`)}
            />
          </div>
        </section>
      )}

      {/* Fotógrafos destacados */}
      <section ref={photogRef} className="bg-muted px-6 py-16 md:px-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Fotógrafos destacados</h2>
            <Link to="/app/fotografos" className="text-sm font-semibold text-primary">
              Ver todos →
            </Link>
          </div>
          {photographers.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-background py-16 text-center">
              <span className="text-4xl opacity-40">📷</span>
              <p className="font-semibold">Todavía no hay fotógrafos aprobados</p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {photographers.map((p, i) => (
                <div
                  key={p.id}
                  className={photogInView ? 'animate-card-in' : 'opacity-0'}
                  style={{ animationDelay: `${Math.min(i, 10) * 50}ms` }}
                >
                  <PhotographerCard photographer={p} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Tres caminos */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:px-16">
        <h2 className="mb-8 text-center text-2xl font-bold tracking-tight md:text-3xl">¿Por dónde quieres empezar?</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          <Link to="/app/buscar" className="group rounded-3xl border border-border bg-blue-50 p-8 text-center transition-all hover:-translate-y-1 hover:shadow-lg">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm transition-transform duration-200 group-hover:scale-110">🔍</div>
            <h3 className="mt-4 text-lg font-bold">Búsqueda avanzada</h3>
            <p className="mt-1 text-sm text-muted-foreground">Filtra por marca de moto, fecha y más.</p>
          </Link>
          <Link to="/app/mapa" className="group rounded-3xl border border-border bg-emerald-50 p-8 text-center transition-all hover:-translate-y-1 hover:shadow-lg">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm transition-transform duration-200 group-hover:scale-110">🗺️</div>
            <h3 className="mt-4 text-lg font-bold">Mapa de ruta</h3>
            <p className="mt-1 text-sm text-muted-foreground">Encuentra tu punto exacto por hora de salida.</p>
          </Link>
          <Link to="/app/fotografos" className="group rounded-3xl border border-border bg-amber-50 p-8 text-center transition-all hover:-translate-y-1 hover:shadow-lg">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm transition-transform duration-200 group-hover:scale-110">📷</div>
            <h3 className="mt-4 text-lg font-bold">Explorar fotógrafos</h3>
            <p className="mt-1 text-sm text-muted-foreground">Descubre a quién seguir en tu ciudad.</p>
          </Link>
        </div>
      </section>
    </div>
  )
}
