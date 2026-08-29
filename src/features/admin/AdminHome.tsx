import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Card } from '../../ui/flat/Card'

async function fetchCounts() {
  const [{ count: pendingPhotographers }, { count: openBugs }, { count: totalEvents }, { count: totalPhotos }] = await Promise.all([
    supabase.from('photographer_details').select('profile_id', { count: 'exact', head: true }).eq('onboarding_completed', true).eq('approved', false),
    supabase.from('bug_reports').select('id', { count: 'exact', head: true }).eq('status', 'abierto'),
    supabase.from('events').select('id', { count: 'exact', head: true }),
    supabase.from('photos').select('id', { count: 'exact', head: true }),
  ])
  return { pendingPhotographers: pendingPhotographers ?? 0, openBugs: openBugs ?? 0, totalEvents: totalEvents ?? 0, totalPhotos: totalPhotos ?? 0 }
}

export function AdminHome() {
  const { data } = useQuery({ queryKey: ['admin-counts'], queryFn: fetchCounts })

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 font-flat">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Resumen</h1>
      <p className="mb-10 text-muted-foreground">Estado general de la plataforma.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/admin/aprobar-fotografos">
          <Card tint={data && data.pendingPhotographers > 0 ? 'amber' : 'default'}>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Fotógrafos pendientes</p>
            <p className="mt-2 text-3xl font-bold">{data?.pendingPhotographers ?? '—'}</p>
          </Card>
        </Link>
        <Link to="/admin/bug-reports">
          <Card tint={data && data.openBugs > 0 ? 'amber' : 'default'}>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Bugs abiertos</p>
            <p className="mt-2 text-3xl font-bold">{data?.openBugs ?? '—'}</p>
          </Card>
        </Link>
        <Card tint="blue">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Eventos totales</p>
          <p className="mt-2 text-3xl font-bold">{data?.totalEvents ?? '—'}</p>
        </Card>
        <Card tint="emerald">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Fotos totales</p>
          <p className="mt-2 text-3xl font-bold">{data?.totalPhotos ?? '—'}</p>
        </Card>
      </div>
    </div>
  )
}
