import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '../../ui/overlays/Modal'
import { Button } from '../../ui/primitives/Button'
import { Input } from '../../ui/primitives/Input'
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
        className="fixed bottom-5 left-5 z-40 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-card hover:bg-slate-800"
      >
        🐞 Reportar bug
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Reportar un problema">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Página</label>
            <select className="h-10 rounded-lg border border-slate-300 px-3 text-sm" {...register('page')}>
              {Object.entries(pageLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Tipo de bug</label>
            <select className="h-10 rounded-lg border border-slate-300 px-3 text-sm" {...register('kind')}>
              {Object.entries(kindLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Descripción</label>
            <textarea
              rows={4}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="¿Qué esperabas que pasara y qué pasó en realidad?"
              {...register('description')}
            />
            {errors.description && (
              <span className="text-xs text-danger-600">{errors.description.message}</span>
            )}
          </div>

          <Input label="Ruta actual" value={location.pathname} disabled readOnly />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Enviar reporte
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
