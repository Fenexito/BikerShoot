import { useState } from 'react'
import { SkeletonRows } from '../../ui/shared/Skeleton'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { Badge } from '../../ui/flat/Badge'
import { Select } from '../../ui/flat/Select'
import { useToastStore } from '../../ui/overlays/toastStore'
import type { BugReport, BugReportStatus } from '../bug-reports/types'

const STATUS_LABEL: Record<BugReportStatus, string> = {
  abierto: 'Abierto',
  en_progreso: 'En progreso',
  resuelto: 'Resuelto',
  descartado: 'Descartado',
}
const PAGE_LABEL: Record<string, string> = {
  publico: 'Sitio público',
  'app-biker': 'Portal biker',
  'studio-fotografo': 'Portal fotógrafo',
  admin: 'Admin',
  otro: 'Otro',
}
const KIND_LABEL: Record<string, string> = {
  visual: 'Visual',
  funcional: 'Funcional',
  rendimiento: 'Rendimiento',
  datos: 'Datos',
  otro: 'Otro',
}
const STATUS_TONE: Record<BugReportStatus, 'accent' | 'secondary' | 'primary'> = {
  abierto: 'accent',
  en_progreso: 'primary',
  resuelto: 'secondary',
  descartado: 'primary',
}

async function fetchReports(): Promise<BugReport[]> {
  const { data, error } = await supabase.from('bug_reports').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export function BugReportsAdmin() {
  const push = useToastStore((s) => s.push)
  const { data: reports = [], isLoading, error } = useQuery({ queryKey: ['admin-bug-reports'], queryFn: fetchReports })
  const [filter, setFilter] = useState<BugReportStatus | 'todos'>('todos')

  async function setStatus(id: string, status: BugReportStatus) {
    const { error } = await supabase.from('bug_reports').update({ status }).eq('id', id)
    if (error) {
      push({ type: 'error', title: 'No se pudo actualizar', description: error.message })
      return
    }
    queryClient.invalidateQueries({ queryKey: ['admin-bug-reports'] })
  }

  const filtered = filter === 'todos' ? reports : reports.filter((r) => r.status === filter)

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 font-flat">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Reportes de bugs</h1>
      <p className="mb-8 text-muted-foreground">{reports.length} reportes en total</p>

      <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="mb-8 w-56">
        <option value="todos">Todos</option>
        {Object.entries(STATUS_LABEL).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </Select>

      {isLoading && <SkeletonRows count={4} />}
      {error && <p className="text-red-600">No se pudieron cargar los reportes.</p>}
      {!isLoading && filtered.length === 0 && <p className="text-muted-foreground">No hay reportes en esta categoría.</p>}

      <div className="flex flex-col gap-3">
        {filtered.map((r) => (
          <div key={r.id} className="rounded-3xl border border-border bg-card p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="secondary">{PAGE_LABEL[r.page] ?? r.page}</Badge>
                <Badge tone="accent">{KIND_LABEL[r.kind] ?? r.kind}</Badge>
                <span className="text-xs text-muted-foreground">{r.route}</span>
              </div>
              <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
            </div>
            <p className="mb-3 text-sm">{r.description}</p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
              <div className="flex gap-2">
                {(['abierto', 'en_progreso', 'resuelto', 'descartado'] as BugReportStatus[])
                  .filter((s) => s !== r.status)
                  .map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(r.id, s)}
                      className="rounded-full border border-border px-3 py-1 text-xs font-medium transition-colors hover:bg-background"
                    >
                      Marcar {STATUS_LABEL[s].toLowerCase()}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
