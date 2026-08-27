import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Card } from '../../ui/primitives/Card'
import { Badge } from '../../ui/primitives/Badge'
import type { Release } from './types'

async function fetchReleases(): Promise<Release[]> {
  const { data, error } = await supabase
    .from('releases')
    .select('*')
    .order('released_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export function ChangelogPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['releases'], queryFn: fetchReleases })

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Historial de versiones</h1>

      {isLoading && <p className="text-slate-500">Cargando...</p>}
      {error && <p className="text-danger-600">No se pudo cargar el historial.</p>}

      <div className="flex flex-col gap-4">
        {data?.map((release) => (
          <Card key={release.id}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold">v{release.version}</h2>
              <Badge tone="brand">{new Date(release.released_at).toLocaleDateString()}</Badge>
            </div>
            <p className="mb-2 text-sm text-slate-600">{release.notes}</p>
            <ul className="list-inside list-disc text-sm text-slate-600">
              {release.highlights?.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  )
}
