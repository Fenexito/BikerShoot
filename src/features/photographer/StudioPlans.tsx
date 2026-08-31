import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { usePhotographerDetails, usePhotographerUsageBytes, useStoragePlans, type StoragePlanInfo } from './usePhotographerDetails'
import { queryClient } from '../../lib/queryClient'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/studio/Button'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { useToastStore } from '../../ui/overlays/toastStore'
import { confirmDialog } from '../../ui/overlays/confirmStore'
import { cn } from '../../lib/cn'

function formatBytes(n: number) {
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(0)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })
}

const PLAN_COPY: Record<string, { tagline: string; features: string[] }> = {
  gratis: {
    tagline: 'Para conocer la plataforma con tu primer evento.',
    features: ['~400 fotos aprox.', '1-2 eventos pequeños activos', 'Soporte por WhatsApp'],
  },
  basico: {
    tagline: 'Para el fotógrafo que ya cubre rodadas con regularidad.',
    features: ['~4,000 fotos aprox.', '2-4 eventos activos al mes', 'Soporte por WhatsApp'],
  },
  pro: {
    tagline: 'Para rodadas grandes con varios puntos de foto.',
    features: ['~20,000 fotos aprox.', 'Eventos con muchos puntos', 'Soporte por WhatsApp prioritario'],
  },
  estudio: {
    tagline: 'Para estudios con alto volumen de eventos simultáneos.',
    features: ['~100,000 fotos aprox.', 'Eventos y puntos ilimitados', 'Soporte por WhatsApp prioritario'],
  },
}

const COMMON_FEATURES = [
  'Sin comisión adicional por venta',
  'Marca de agua automática en vistas previas',
  'Entregas y descargas ilimitadas para tus compradores',
  'Respaldo del archivo original de cada foto',
]

function PlanCard({
  plan,
  isCurrent,
  isPending,
  isDowngrade,
  busy,
  onSelect,
}: {
  plan: StoragePlanInfo
  isCurrent: boolean
  isPending: boolean
  isDowngrade: boolean
  busy: boolean
  onSelect: () => void
}) {
  const copy = PLAN_COPY[plan.id]
  return (
    <div
      className={cn(
        'relative flex flex-col border p-6',
        isCurrent ? 'border-2 border-accent bg-accent/5' : 'border-border',
      )}
    >
      {isCurrent && (
        <span className="absolute -top-3 left-4 inline-flex w-fit items-center gap-1.5 bg-background border border-accent px-2 py-1 font-studio-mono text-[10px] font-bold uppercase tracking-wider2 text-accent">
          Tu plan actual
        </span>
      )}
      {isPending && (
        <span className="absolute -top-3 left-4 inline-flex w-fit items-center gap-1.5 bg-background border border-foreground px-2 py-1 font-studio-mono text-[10px] font-bold uppercase tracking-wider2">
          Entra en tu próxima renovación
        </span>
      )}
      <h3 className="font-studio text-2xl font-bold tracking-tight2">{plan.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{copy?.tagline}</p>

      <div className="mt-5 flex items-baseline gap-1">
        <span className="font-studio text-4xl font-bold">
          {plan.price_monthly_gtq === 0 ? 'Gratis' : `Q${plan.price_monthly_gtq}`}
        </span>
        {plan.price_monthly_gtq > 0 && <span className="font-studio-mono text-xs text-muted-foreground">/ mes</span>}
      </div>
      <p className="mt-1 font-studio-mono text-xs uppercase tracking-wider2 text-muted-foreground">{plan.gb_limit} GB de espacio</p>

      <ul className="mt-6 flex flex-1 flex-col gap-2 text-sm">
        {copy?.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {isCurrent ? (
          <Button variant="secondary" size="sm" className="w-full justify-center" disabled>
            Plan activo
          </Button>
        ) : isPending ? (
          <Button variant="ghost" size="sm" className="w-full justify-center" disabled>
            Cambio programado
          </Button>
        ) : (
          <Button
            variant={isDowngrade ? 'secondary' : 'primary'}
            size="sm"
            className="w-full justify-center"
            disabled={busy}
            onClick={onSelect}
          >
            {isDowngrade ? 'Bajar a este plan' : 'Mejorar a este plan'}
          </Button>
        )}
      </div>
    </div>
  )
}

export function StudioPlans() {
  const { user } = useAuth()
  const { data: details } = usePhotographerDetails(user?.id)
  const { data: usageBytes = 0 } = usePhotographerUsageBytes(user?.id)
  const { data: plans } = useStoragePlans()
  const push = useToastStore((s) => s.push)
  const [busy, setBusy] = useState(false)

  if (!details || !plans) return <p className="px-6 py-16 text-center text-muted-foreground">Cargando…</p>

  const currentPlan = details.storage_plan
  const pendingPlan = plans.find((p) => p.id === details.pending_plan_id)

  async function selectPlan(plan: StoragePlanInfo) {
    if (!currentPlan) return
    const isUpgrade = plan.gb_limit >= currentPlan.gb_limit

    if (isUpgrade) {
      const now = new Date()
      const renews = new Date(now.getTime())
      renews.setMonth(renews.getMonth() + 1)
      const ok = await confirmDialog.ask({
        title: `¿Cambiar al plan ${plan.name}?`,
        description:
          plan.price_monthly_gtq > 0
            ? `Tu ciclo de facturación se reinicia hoy. Próximo cobro: Q${plan.price_monthly_gtq} el ${formatDate(renews.toISOString())}.`
            : 'Este plan no tiene costo.',
        confirmLabel: 'Confirmar cambio',
      })
      if (!ok) return
      setBusy(true)
      const { error } = await supabase
        .from('photographer_details')
        .update({
          storage_plan_id: plan.id,
          plan_started_at: now.toISOString(),
          plan_renews_at: renews.toISOString(),
          pending_plan_id: null,
        })
        .eq('profile_id', user!.id)
      setBusy(false)
      if (error) {
        push({ type: 'error', title: 'No se pudo cambiar de plan', description: error.message })
        return
      }
      push({ type: 'success', title: `Ahora estás en el plan ${plan.name}` })
      queryClient.invalidateQueries({ queryKey: ['photographer_details', user!.id] })
      return
    }

    const ok = await confirmDialog.ask({
      title: `¿Bajar al plan ${plan.name}?`,
      description: `Seguirás con ${currentPlan.name} hasta el ${formatDate(details!.plan_renews_at)}. Ese día tu plan cambia a ${plan.name} automáticamente.`,
      confirmLabel: 'Programar cambio',
    })
    if (!ok) return
    setBusy(true)
    const { error } = await supabase.from('photographer_details').update({ pending_plan_id: plan.id }).eq('profile_id', user!.id)
    setBusy(false)
    if (error) {
      push({ type: 'error', title: 'No se pudo programar el cambio', description: error.message })
      return
    }
    push({ type: 'success', title: `Cambio a ${plan.name} programado para el ${formatDate(details!.plan_renews_at)}` })
    queryClient.invalidateQueries({ queryKey: ['photographer_details', user!.id] })
  }

  async function cancelPendingChange() {
    setBusy(true)
    const { error } = await supabase.from('photographer_details').update({ pending_plan_id: null }).eq('profile_id', user!.id)
    setBusy(false)
    if (error) {
      push({ type: 'error', title: 'No se pudo cancelar', description: error.message })
      return
    }
    push({ type: 'success', title: 'Cambio de plan cancelado' })
    queryClient.invalidateQueries({ queryKey: ['photographer_details', user!.id] })
  }

  return (
    <div className={STUDIO_PAGE_WIDE}>
      <h1 className="font-studio text-3xl font-bold tracking-tight2 md:text-4xl">Planes y facturación</h1>
      <p className="mt-2 text-muted-foreground">Elige el espacio que necesitas según cuántos eventos y fotos manejas al mes.</p>

      {currentPlan && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border border-border p-5">
          <div>
            <p className="font-studio-mono text-[10px] uppercase tracking-wider2 text-muted-foreground">Plan activo</p>
            <p className="mt-1 font-studio text-xl font-bold">{currentPlan.name} · {formatBytes(usageBytes)} usados de {currentPlan.gb_limit} GB</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ciclo iniciado el {formatDate(details.plan_started_at)} · próxima renovación el {formatDate(details!.plan_renews_at)}
            </p>
          </div>
          {pendingPlan && (
            <div className="flex items-center gap-3 border border-foreground px-4 py-3">
              <p className="text-sm">
                Pasarás a <span className="font-bold">{pendingPlan.name}</span> el {formatDate(details!.plan_renews_at)}
              </p>
              <Button variant="ghost" size="sm" disabled={busy} onClick={cancelPendingChange}>
                Cancelar cambio
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrent={plan.id === details.storage_plan_id}
            isPending={plan.id === details.pending_plan_id}
            isDowngrade={!!currentPlan && plan.gb_limit < currentPlan.gb_limit}
            busy={busy}
            onSelect={() => selectPlan(plan)}
          />
        ))}
      </div>

      <div className="mt-10 border-t border-border pt-8">
        <p className="font-studio-mono text-[10px] uppercase tracking-wider2 text-muted-foreground">Todos los planes incluyen</p>
        <ul className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {COMMON_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <span className="mt-0.5 text-accent">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
