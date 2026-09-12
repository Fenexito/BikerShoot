import { useMemo } from 'react'
import { SkeletonRows } from '../../ui/shared/Skeleton'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { Card } from '../../ui/flat/Card'
import { FancySelect } from '../../ui/shared/FancySelect'
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

interface PendingFeeRow {
  photographer_id: string
  display_name: string
  total: number
  count: number
}

function usePendingServiceFeesByPhotographer() {
  return useQuery({
    queryKey: ['admin-pending-service-fees'],
    queryFn: async (): Promise<PendingFeeRow[]> => {
      const { data, error } = await supabase
        .from('order_items')
        .select('photographer_id, service_fee, photographer:profiles(display_name)')
        .eq('is_courtesy', false)
        .is('service_fee_settled_at', null)
        .gt('service_fee', 0)
      if (error) throw error
      const byPhotographer = new Map<string, PendingFeeRow>()
      for (const row of (data ?? []) as unknown as { photographer_id: string; service_fee: number; photographer: { display_name: string } | null }[]) {
        const existing = byPhotographer.get(row.photographer_id)
        if (existing) {
          existing.total += Number(row.service_fee)
          existing.count += 1
        } else {
          byPhotographer.set(row.photographer_id, {
            photographer_id: row.photographer_id,
            display_name: row.photographer?.display_name ?? 'Fotógrafo',
            total: Number(row.service_fee),
            count: 1,
          })
        }
      }
      return Array.from(byPhotographer.values()).sort((a, b) => b.total - a.total)
    },
  })
}

export function StoragePlansAdmin() {
  const { data: plans = [] } = useStoragePlans()
  const { data: usage = [], isLoading } = usePhotographerUsage()
  const { data: pendingFees = [], isLoading: feesLoading } = usePendingServiceFeesByPhotographer()
  const push = useToastStore((s) => s.push)

  const planById = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans])

  async function settleFees(photographerId: string, displayName: string) {
    const { error } = await supabase
      .from('order_items')
      .update({ service_fee_settled_at: new Date().toISOString() })
      .eq('photographer_id', photographerId)
      .eq('is_courtesy', false)
      .is('service_fee_settled_at', null)
    if (error) {
      push({ type: 'error', title: 'No se pudo liquidar', description: error.message })
      return
    }
    push({ type: 'success', title: `Tarifas de ${displayName} liquidadas` })
    queryClient.invalidateQueries({ queryKey: ['admin-pending-service-fees'] })
  }

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

      <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <div key={row.profile_id} className="rounded-3xl border border-border bg-card p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">{row.profiles?.display_name ?? 'Fotógrafo'}</p>
                <div className="flex items-center gap-3">
                  {overLimit && <Badge tone="accent">Sobre el límite</Badge>}
                  <FancySelect
                    value={row.storage_plan_id}
                    onChange={(v) => changePlan(row.profile_id, v)}
                    options={plans.map((p) => ({ value: p.id, label: p.name }))}
                    clearable={false}
                    className="w-40"
                  />
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

      <h2 className="mb-4 mt-14 text-xl font-bold tracking-tight">Tarifas de servicio pendientes de liquidar</h2>
      <p className="mb-4 text-sm text-muted-foreground">Q2 por foto vendida (no cortesía), acumulado hasta que se factura junto al plan de cada fotógrafo.</p>
      {feesLoading && <SkeletonRows count={3} />}
      {!feesLoading && pendingFees.length === 0 && <p className="text-muted-foreground">No hay tarifas pendientes.</p>}
      <div className="flex flex-col gap-3">
        {pendingFees.map((row) => (
          <div key={row.photographer_id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card p-4">
            <div>
              <p className="font-bold">{row.display_name}</p>
              <p className="text-sm text-muted-foreground">{row.count} fotos vendidas sin liquidar</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-lg font-bold text-primary">Q{row.total.toFixed(2)}</p>
              <button
                onClick={() => settleFees(row.photographer_id, row.display_name)}
                className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
              >
                Marcar liquidado
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
