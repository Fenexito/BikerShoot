import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Card } from '../../ui/flat/Card'
import { Badge } from '../../ui/flat/Badge'
import { SkeletonRows } from '../../ui/shared/Skeleton'
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
    <div className="mx-auto max-w-3xl px-4 py-16 font-flat md:px-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight md:text-3xl">Historial de versiones</h1>
      <p className="mb-8 text-muted-foreground">Novedades y mejoras de MotoShots.</p>

      {isLoading && <SkeletonRows count={4} />}
      {error && <p className="text-red-600">No se pudo cargar el historial.</p>}

      {!isLoading && data?.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border py-20 text-center">
          <span className="text-4xl opacity-40">📋</span>
          <p className="font-semibold">Todavía no hay versiones publicadas</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {data?.map((release) => (
          <Card key={release.id} className="cursor-default hover:scale-100">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">v{release.version}</h2>
              <Badge tone="accent">{new Date(release.released_at).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })}</Badge>
            </div>
            {release.notes && <p className="mb-2 text-sm text-muted-foreground">{release.notes}</p>}
            {release.highlights && release.highlights.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                {release.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 text-primary">✓</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
