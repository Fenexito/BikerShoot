import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getPortalRoot } from '../../ui/shared/portalRoot'
import { IconChevronRight } from '../../ui/shared/icons'
import { AnimateIcon } from '../../ui/animate-icons/icon'
import { X } from '../../ui/animate-icons/icons/X'
import { cn } from '../../lib/cn'
import { useToastStore } from '../../ui/overlays/toastStore'
import { supabase } from '../../lib/supabase'
import type { BugReportKind, BugReportPage } from './types'

const schema = z.object({
  page: z.enum(['publico', 'app-biker', 'studio-fotografo', 'admin', 'otro']),
  kind: z.enum(['visual', 'funcional', 'rendimiento', 'datos', 'otro']),
  description: z.string().min(10, 'Describe el problema con al menos 10 caracteres'),
})

type FormValues = z.infer<typeof schema>

function guessPage(pathname: string): BugReportPage {
  if (pathname.startsWith('/app')) return 'app-biker'
  if (pathname.startsWith('/studio')) return 'studio-fotografo'
  if (pathname.startsWith('/admin')) return 'admin'
  return 'publico'
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

/** Etiqueta legible de dónde vino el reporte — mucho más útil para investigar
 * que solo la ruta cruda ("/studio/eventos/3f2a...-editar"). Cubre las
 * páginas reales de la app; lo que no reconoce cae de vuelta a la ruta. */
function describeRoute(pathname: string): string {
  const p = pathname.replace(UUID_RE, ':id').replace(/\/$/, '') || '/'
  const map: Record<string, string> = {
    '/': 'Landing pública',
    '/login': 'Login (biker)',
    '/signup': 'Registro (biker)',
    '/studio/login': 'Login (Studio)',
    '/studio/signup': 'Registro (Studio)',
    '/app': 'Inicio (biker)',
    '/app/buscar': 'Búsqueda de fotos',
    '/app/mapa': 'Mapa de puntos',
    '/app/eventos': 'Lista de eventos (biker)',
    '/app/eventos/:id': 'Detalle de evento (biker, público)',
    '/app/fotografos': 'Lista de fotógrafos',
    '/app/fotografos/:id': 'Perfil de fotógrafo (público)',
    '/app/favoritos': 'Favoritos',
    '/app/historial': 'Mis compras',
    '/app/historial/:id': 'Detalle de pedido (biker)',
    '/app/checkout': 'Carrito',
    '/app/pedido-confirmado': 'Confirmación de compra',
    '/app/perfil': 'Perfil (biker)',
    '/studio': 'Inicio (Studio)',
    '/studio/eventos': 'Lista de eventos (Studio)',
    '/studio/eventos/new': 'Crear evento (editor)',
    '/studio/eventos/:id': 'Vista de evento (Studio)',
    '/studio/eventos/:id/editar': 'Editor de evento (Studio)',
    '/studio/pedidos': 'Lista de pedidos (Studio)',
    '/studio/pedidos/:id': 'Detalle de pedido (Studio)',
    '/studio/almacenamiento': 'Almacenamiento (Studio)',
    '/studio/planes': 'Planes y facturación (Studio)',
    '/studio/perfil': 'Perfil público del Studio',
    '/studio/ajustes': 'Configuración (Studio)',
  }
  return map[p] ?? pathname
}

const pageLabels: Record<BugReportPage, string> = {
  publico: 'Sitio público',
  'app-biker': 'Portal biker (/app)',
  'studio-fotografo': 'Portal fotógrafo (/studio)',
  admin: 'Admin',
  otro: 'Otro',
}

const kindLabels: Record<BugReportKind, string> = {
  visual: 'Visual / estilos',
  funcional: 'Funcional (algo no hace lo que debería)',
  rendimiento: 'Rendimiento / lentitud',
  datos: 'Datos incorrectos',
  otro: 'Otro',
}

const selectClass =
  'h-11 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition-colors focus:border-white/30'

export function BugReportWidget() {
  const [expanded, setExpanded] = useState(false)
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const push = useToastStore((s) => s.push)
  const contextLabel = describeRoute(location.pathname)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      page: guessPage(location.pathname),
      kind: 'funcional',
      description: '',
    },
  })

  useEffect(() => {
    if (!expanded) return
    const timer = setTimeout(() => setExpanded(false), 3000)
    return () => clearTimeout(timer)
  }, [expanded])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const onSubmit = async (values: FormValues) => {
    const { error } = await supabase.from('bug_reports').insert({
      page: values.page,
      route: location.pathname,
      context_label: contextLabel,
      kind: values.kind,
      description: values.description,
      status: 'abierto',
    })

    if (error) {
      push({ type: 'error', title: 'No se pudo enviar el reporte', description: error.message })
      return
    }

    push({ type: 'success', title: 'Gracias, reporte enviado' })
    reset()
    setOpen(false)
    setExpanded(false)
  }

  return (
    <>
      {/* `env(safe-area-inset-bottom)` sumado al offset móvil — sin eso, en
          dispositivos con una franja segura grande el menú inferior real
          (que sí la suma en su propio padding) termina más alto de lo que
          este botón asumía, y se solapan. */}
      {/* Un solo botón que CRECE/ENCOGE (no dos botones que se intercambian
          de golpe) — la pestañita angosta se estira hacia la píldora
          completa y el ícono gira 180° mientras el texto aparece con un
          leve desliz, y todo se revierte igual de suave al colapsar (por
          inactividad o tras enviar el reporte). `overflow-hidden` recorta el
          texto mientras el ancho todavía no da lugar, así nunca se ve
          "roto" a la mitad de la animación. */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 z-40 flex items-center md:bottom-5">
        <button
          onClick={() => (expanded ? setOpen(true) : setExpanded(true))}
          aria-label={expanded ? 'Reportar un problema' : 'Mostrar botón de reportar bug'}
          className={cn(
            'flex h-11 shrink-0 animate-bug-widget-in items-center overflow-hidden rounded-r-full bg-neutral-900 text-white shadow-lg transition-[width] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:bg-neutral-800',
            expanded ? 'w-[172px] pl-4 pr-5' : 'w-6 justify-center',
          )}
        >
          <span
            className={cn(
              'shrink-0 text-base transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
              expanded ? 'rotate-0' : 'rotate-180',
            )}
          >
            {expanded ? '🐞' : <IconChevronRight className="h-4 w-4 text-white/60" />}
          </span>
          <span
            className={cn(
              'ml-2 whitespace-nowrap text-sm font-medium transition-all duration-200',
              expanded ? 'translate-x-0 opacity-100 delay-150' : 'pointer-events-none -translate-x-1 opacity-0',
            )}
          >
            Reportar bug
          </span>
        </button>
      </div>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto p-4 pt-16 sm:pt-24">
            <div className="fixed inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <div className="relative z-10 w-full max-w-lg animate-menu-in rounded-3xl border border-white/10 bg-neutral-900 p-6 text-white shadow-2xl sm:p-8">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold">Reportar un problema</h2>
                <AnimateIcon animateOnHover animateOnTap asChild>
                  <button
                    onClick={() => setOpen(false)}
                    aria-label="Cerrar"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                  >
                    <X size={16} />
                  </button>
                </AnimateIcon>
              </div>

              <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
                <div className="rounded-2xl bg-white/5 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Se reporta desde</p>
                  <p className="mt-0.5 text-sm font-semibold">{contextLabel}</p>
                  <p className="mt-0.5 truncate text-xs text-white/40">{location.pathname}</p>
                </div>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Página</span>
                  <select className={selectClass} {...register('page')}>
                    {Object.entries(pageLabels).map(([value, label]) => (
                      <option key={value} value={value} className="text-black">
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Tipo de bug</span>
                  <select className={selectClass} {...register('kind')}>
                    {Object.entries(kindLabels).map(([value, label]) => (
                      <option key={value} value={value} className="text-black">
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Descripción</span>
                  <textarea
                    rows={4}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-white/30"
                    placeholder="¿Qué esperabas que pasara y qué pasó en realidad?"
                    {...register('description')}
                  />
                  {errors.description && <span className="text-xs text-red-400">{errors.description.message}</span>}
                </label>

                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full px-5 py-2.5 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Enviando…' : 'Enviar reporte'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          getPortalRoot(),
        )}
    </>
  )
}
