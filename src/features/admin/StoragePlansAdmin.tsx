import { useMemo } from 'react'
import { SkeletonRows } from '../../ui/shared/Skeleton'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { Card } from '../../ui/flat/Card'
import { Select } from '../../ui/flat/Select'
import { Badge } from '../../ui/flat/Badge'
import { useToastStore } from '../../ui/overlays/toastStore'

interface StoragePlan {
  id: string
  name: string
  gb_limit: number
  price_monthly_gtq: number
  sort_order: number
}

interface PhotographerRow {
  profile_id: string
  storage_plan_id: string
  profiles: { display_name: string } | null
}

function useStoragePlans() {
  return useQuery({
    queryKey: ['storage-plans'],
    queryFn: async (): Promise<StoragePlan[]> => {
      const { data, error } = await supabase.from('storage_plans').select('*').order('sort_order')
      if (error) throw error
      return data ?? []
    },
  })
}

function usePhotographerUsage() {
  return useQuery({
    queryKey: ['admin-photographer-usage'],
    queryFn: async () => {
      const [{ data: photographers, error: e1 }, { data: photos, error: e2 }] = await Promise.all([
        supabase.from('photographer_details').select('profile_id, storage_plan_id, profiles(display_name)'),
        supabase.from('photos').select('photographer_id, size_bytes'),
      ])
      if (e1) throw e1
      if (e2) throw e2

      const usageByPhotographer = new Map<string, number>()
      for (const photo of photos ?? []) {
        usageByPhotographer.set(photo.photographer_id, (usageByPhotographer.get(photo.photographer_id) ?? 0) + (photo.size_bytes ?? 0))
      }

      return (photographers as unknown as PhotographerRow[]).map((p) => ({
        ...p,
        usageBytes: usageByPhotographer.get(p.profile_id) ?? 0,
      }))
    },
  })
}

function formatGB(bytes: number) {
  return (bytes / 1024 / 1024 / 1024).toFixed(2)
}

export function StoragePlansAdmin() {
  const { data: plans = [] } = useStoragePlans()
  const { data: usage = [], isLoading } = usePhotographerUsage()
  const push = useToastStore((s) => s.push)

  const planById = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans])

  async function changePlan(profileId: string, planId: string) {
    const { error } = await supabase.from('photographer_details').update({ storage_plan_id: planId }).eq('profile_id', profileId)
    if (error) {
      push({ type: 'error', title: 'No se pudo cambiar el plan', description: error.message })
      return
    }
    push({ type: 'success', title: 'Plan actualizado' })
    queryClient.invalidateQueries({ queryKey: ['admin-photographer-usage'] })
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 font-flat">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Planes de almacenamiento</h1>
      <p className="mb-8 text-muted-foreground">
        Precios basados en el costo real de Cloudflare R2 ($0.015/GB-mes, sin costo de salida de datos).
      </p>

      <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <Card key={plan.id} tint={plan.id === 'gratis' ? 'default' : plan.id === 'basico' ? 'blue' : plan.id === 'pro' ? 'emerald' : 'amber'}>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{plan.name}</p>
            <p className="mt-2 text-2xl font-bold">{plan.gb_limit} GB</p>
            <p className="mt-1 text-lg font-semibold text-primary">
              {plan.price_monthly_gtq === 0 ? 'Gratis' : `Q${plan.price_monthly_gtq}/mes`}
            </p>
          </Card>
        ))}
      </div>

      <h2 className="mb-4 text-xl font-bold tracking-tight">Uso por fotógrafo</h2>
      {isLoading && <SkeletonRows count={4} />}
      {!isLoading && usage.length === 0 && <p className="text-muted-foreground">No hay fotógrafos todavía.</p>}

      <div className="flex flex-col gap-3">
        {usage.map((row) => {
          const plan = planById.get(row.storage_plan_id)
          const limitBytes = (plan?.gb_limit ?? 0) * 1024 * 1024 * 1024
          const pct = limitBytes > 0 ? Math.min(100, (row.usageBytes / limitBytes) * 100) : 0
          const overLimit = row.usageBytes > limitBytes

          return (
            <div key={row.profile_id} className="rounded-lg bg-muted p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">{row.profiles?.display_name ?? 'Fotógrafo'}</p>
                <div className="flex items-center gap-3">
                  {overLimit && <Badge tone="accent">Sobre el límite</Badge>}
                  <Select value={row.storage_plan_id} onChange={(e) => changePlan(row.profile_id, e.target.value)} className="w-40">
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-background">
                <div
                  className={`h-full transition-all ${overLimit ? 'bg-red-500' : 'bg-primary'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatGB(row.usageBytes)} GB de {plan?.gb_limit ?? 0} GB
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
