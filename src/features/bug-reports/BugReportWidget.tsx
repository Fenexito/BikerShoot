import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getPortalRoot } from '../../ui/shared/portalRoot'
import { IconClose } from '../../ui/shared/icons'
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
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const push = useToastStore((s) => s.push)

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
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 left-5 z-40 flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-3 text-sm font-medium text-white shadow-lg transition-colors hover:bg-neutral-800"
      >
        🐞 Reportar bug
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto p-4 pt-16 sm:pt-24">
            <div className="fixed inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <div className="relative z-10 w-full max-w-lg animate-menu-in rounded-3xl border border-white/10 bg-neutral-900 p-6 text-white shadow-2xl sm:p-8">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold">Reportar un problema</h2>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                >
                  <IconClose className="h-4 w-4" />
                </button>
              </div>

              <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
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

                <p className="text-xs text-white/40">Ruta actual: {location.pathname}</p>

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
