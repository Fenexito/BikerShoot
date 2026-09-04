import { useQuery } from '@tanstack/react-query'
import { SkeletonRows } from '../../ui/shared/Skeleton'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { Button } from '../../ui/flat/Button'
import { Card } from '../../ui/flat/Card'
import { Badge } from '../../ui/flat/Badge'
import { useToastStore } from '../../ui/overlays/toastStore'

interface PhotographerRow {
  profile_id: string
  bio: string | null
  city: string | null
  whatsapp: string | null
  onboarding_completed: boolean
  approved: boolean
  profiles: { display_name: string; phone: string | null } | null
}

async function fetchPhotographers(): Promise<PhotographerRow[]> {
  const { data, error } = await supabase
    .from('photographer_details')
    .select('profile_id, bio, city, whatsapp, onboarding_completed, approved, profiles(display_name, phone)')
    .order('onboarding_completed', { ascending: false })
  if (error) throw error
  return (data as unknown as PhotographerRow[]) ?? []
}

export function ApprovePhotographers() {
  const push = useToastStore((s) => s.push)
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin_photographers'],
    queryFn: fetchPhotographers,
  })

  async function setApproved(profileId: string, approved: boolean) {
    const { error } = await supabase
      .from('photographer_details')
      .update({ approved, approved_at: approved ? new Date().toISOString() : null })
      .eq('profile_id', profileId)

    if (error) {
      push({ type: 'error', title: 'No se pudo actualizar', description: error.message })
      return
    }
    push({ type: 'success', title: approved ? 'Fotógrafo aprobado' : 'Aprobación retirada' })
    queryClient.invalidateQueries({ queryKey: ['admin_photographers'] })
  }

  const pending = data?.filter((p) => p.onboarding_completed && !p.approved) ?? []
  const approved = data?.filter((p) => p.approved) ?? []
  const incomplete = data?.filter((p) => !p.onboarding_completed) ?? []

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 font-flat">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Aprobar fotógrafos</h1>
      <p className="mb-10 text-muted-foreground">
        Solo los fotógrafos aprobados pueden publicar eventos y vender fotos.
      </p>

      {isLoading && <SkeletonRows count={4} />}
      {error && <p className="text-red-600">No se pudo cargar la lista.</p>}

      {pending.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Pendientes de aprobación ({pending.length})
          </h2>
          <div className="flex flex-col gap-3">
            {pending.map((p) => (
              <Card key={p.profile_id} tint="amber" className="cursor-default hover:scale-100">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-bold">{p.profiles?.display_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.city ?? 'Sin ciudad'} · {p.whatsapp ?? 'Sin contacto'}
                    </p>
                    {p.bio && <p className="mt-1 max-w-xl text-sm text-muted-foreground">{p.bio}</p>}
                  </div>
                  <Button size="sm" onClick={() => setApproved(p.profile_id, true)}>
                    Aprobar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {approved.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Aprobados ({approved.length})
          </h2>
          <div className="flex flex-col gap-3">
            {approved.map((p) => (
              <Card key={p.profile_id} tint="emerald" className="cursor-default hover:scale-100">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-bold">{p.profiles?.display_name}</p>
                    <p className="text-sm text-muted-foreground">{p.city ?? 'Sin ciudad'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone="secondary">Aprobado</Badge>
                    <Button size="sm" variant="secondary" onClick={() => setApproved(p.profile_id, false)}>
                      Retirar aprobación
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {incomplete.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Sin completar onboarding ({incomplete.length})
          </h2>
          <div className="flex flex-col gap-3">
            {incomplete.map((p) => (
              <Card key={p.profile_id} className="cursor-default opacity-70 hover:scale-100">
                <p className="font-bold">{p.profiles?.display_name || 'Sin nombre aún'}</p>
                <p className="text-sm text-muted-foreground">Todavía no termina su registro.</p>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
