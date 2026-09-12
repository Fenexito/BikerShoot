import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  usePhotographerDetails,
  usePhotographerUsageBytes,
  useStoragePlans,
  useStorageAddons,
  useFeatureAddons,
  usePendingServiceFees,
  type StoragePlanInfo,
} from './usePhotographerDetails'
import { queryClient } from '../../lib/queryClient'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/studio/Button'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { useToastStore } from '../../ui/overlays/toastStore'
import { confirmDialog } from '../../ui/overlays/confirmStore'
import { Accordion } from '../../ui/shared/Accordion'
import { Skeleton } from '../../ui/shared/Skeleton'
import { cn } from '../../lib/cn'

const FAQ_ITEMS = [
  {
    question: '¿Puedo cambiar de plan cuando quiera?',
    answer: 'Sí. Mejorar de plan aplica de inmediato y reinicia tu ciclo de cobro ese mismo día. Bajar de plan se programa para tu próxima renovación, así no pierdes espacio que ya estás usando a mitad de mes.',
  },
  {
    question: '¿Qué pasa con mis fotos si me quedo sin espacio?',
    answer: 'Puedes seguir vendiendo lo que ya subiste, pero no podrás subir fotos nuevas hasta liberar espacio (ver Almacenamiento) o mejorar de plan.',
  },
  {
    question: '¿Cobran comisión por cada venta?',
    answer:
      'No sobre tu precio — recibes el 100% de lo que publicas. Hay una tarifa de servicio que paga el biker (se suma a lo que ya te transfiere): Q2 por una sola foto, bajando proporcionalmente en pedidos con más fotos tuyas, con un tope de Q10 sin importar cuántas compre. Se liquida junto a tu factura de plan.',
  },
  {
    question: '¿Puedo cancelar en cualquier momento?',
    answer: 'Sí, puedes bajar al plan Gratis cuando quieras — el cambio entra en tu próxima renovación, igual que cualquier otra reducción de plan.',
  },
  {
    question: '¿Las fotos que ya vendí siguen ocupando espacio de mi plan?',
    answer: 'Sí, hasta que las liberes desde Almacenamiento. Ahí puedes borrar el preview y el respaldo crudo de una foto ya vendida sin afectar al comprador — la entrega final que recibió nunca se toca ni desaparece, la conserva para siempre.',
  },
  {
    question: '¿Qué son las fotos destacadas y ocupan espacio de mi plan?',
    answer: 'Sí cuentan dentro de tu espacio. Se suben desde el editor de cada evento, en alta calidad y sin marca de agua, para mostrar tu mejor trabajo en tu perfil y el del evento — nunca están a la venta ni disponibles para descarga por un biker.',
  },
  {
    question: '¿Qué pasa si cancelo un pedido después de confirmarlo?',
    answer: 'El biker recibe una notificación con el motivo que escribas y pierde acceso a esas fotos específicas. Es una acción que no se puede deshacer, por eso te pedimos escribir el número de pedido para confirmar.',
  },
  {
    question: '¿Por qué mis pedidos tienen un número con letras al final?',
    answer: 'Es el código corto del pedido (ej. #000938-Mendz) — el sufijo sale del nombre de tu estudio, para que tú y el biker puedan referenciar el pedido por WhatsApp sin confundirlo con el de otro fotógrafo en compras con varios estudios.',
  },
  {
    question: '¿Puedo tener colaboradores subiendo fotos a mi cuenta?',
    answer: 'Todavía no, pero está en el roadmap — la idea es que un estudio con varios fotógrafos cubriendo distintos puntos pueda dar acceso a cuentas secundarias sin compartir su contraseña principal.',
  },
]

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
    features: ['~400 fotos aprox.', '1 evento activo a la vez'],
  },
  starter: {
    tagline: 'Para el fotógrafo que recién empieza a cobrar por sus fotos.',
    features: ['~2,000 fotos aprox.', 'Eventos activos ilimitados', 'Cupones de descuento propios'],
  },
  basico: {
    tagline: 'Para el fotógrafo que ya cubre rodadas con regularidad.',
    features: ['~5,000 fotos aprox.', 'Eventos activos ilimitados', 'Cupones y recordatorios automáticos'],
  },
  plus: {
    tagline: 'Para quien ya vende seguido y quiere ver qué le funciona.',
    features: ['~12,000 fotos aprox.', 'Analítica de ventas', 'Insignia verificado + prioridad de visibilidad'],
  },
  pro: {
    tagline: 'Para rodadas grandes con varios puntos de foto.',
    features: ['~30,000 fotos aprox.', 'Marca de agua personalizable', 'Soporte prioritario + cortesías ampliadas'],
  },
  estudio: {
    tagline: 'Para estudios con alto volumen de eventos simultáneos.',
    features: ['~60,000 fotos aprox.', 'Todo lo de Pro', 'Cuentas de equipo (próximamente)'],
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
        'flex flex-col rounded-3xl p-6',
        isCurrent ? 'bg-foreground/5' : 'border border-border bg-card',
      )}
    >
      <div className="flex items-center gap-2">
        <h3 className="text-2xl font-bold tracking-tight">{plan.name}</h3>
        {isCurrent && (
          <span className="rounded-full bg-foreground px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-background">
            Tu plan
          </span>
        )}
        {isPending && (
          <span className="rounded-full bg-foreground px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-background">
            Próximo
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{copy?.tagline}</p>

      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-4xl font-bold">
          {plan.price_monthly_gtq === 0 ? 'Gratis' : `Q${plan.price_monthly_gtq}`}
        </span>
        {plan.price_monthly_gtq > 0 && <span className="text-xs text-muted-foreground">/ mes</span>}
      </div>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{plan.gb_limit} GB de espacio</p>

      <ul className="mt-6 flex flex-1 flex-col gap-2.5 text-sm">
        {copy?.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-[10px] text-foreground">✓</span>
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
            variant={isDowngrade ? 'secondary' : 'dark'}
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
  const { data: storageAddons = [] } = useStorageAddons()
  const { data: featureAddons = [] } = useFeatureAddons()
  const { data: pendingFees = 0 } = usePendingServiceFees(user?.id)
  const push = useToastStore((s) => s.push)
  const [busy, setBusy] = useState(false)
  const [addonBusy, setAddonBusy] = useState<string | null>(null)

  if (!details || !plans) {
    return (
      <div className={STUDIO_PAGE_WIDE}>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-3 h-4 w-96" />
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-80 w-full rounded-3xl" />
          ))}
        </div>
      </div>
    )
  }

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

  async function toggleAddon(kind: 'storage' | 'feature', addonId: string, label: string) {
    const field = kind === 'storage' ? 'storage_addon_ids' : 'feature_addon_ids'
    const current = kind === 'storage' ? details!.storage_addon_ids : details!.feature_addon_ids
    const active = current.includes(addonId)
    const next = active ? current.filter((id) => id !== addonId) : [...current, addonId]
    setAddonBusy(addonId)
    const { error } = await supabase.from('photographer_details').update({ [field]: next }).eq('profile_id', user!.id)
    setAddonBusy(null)
    if (error) {
      push({ type: 'error', title: 'No se pudo actualizar', description: error.message })
      return
    }
    push({ type: 'success', title: active ? `${label} desactivado` : `${label} activado` })
    queryClient.invalidateQueries({ queryKey: ['photographer_details', user!.id] })
  }

  return (
    <div className={STUDIO_PAGE_WIDE}>
      <h1 className="font-studio text-3xl font-bold tracking-tight2 md:text-4xl">Planes y facturación</h1>
      <p className="mt-2 text-muted-foreground">Elige el espacio que necesitas según cuántos eventos y fotos manejas al mes.</p>

      {currentPlan && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-muted p-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Plan activo</p>
            <p className="mt-1 font-studio text-xl font-bold">{currentPlan.name} · {formatBytes(usageBytes)} usados de {currentPlan.gb_limit} GB</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ciclo iniciado el {formatDate(details.plan_started_at)} · próxima renovación el {formatDate(details!.plan_renews_at)}
            </p>
            {pendingFees > 0 && (
              <p className="mt-2 text-sm">
                <span className="font-semibold">Q{pendingFees.toFixed(2)}</span> en tarifas de servicio acumuladas — se suman a tu próxima
                factura de plan.
              </p>
            )}
          </div>
          {pendingPlan && (
            <div className="flex items-center gap-3 rounded-full bg-background px-5 py-3">
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

      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan, i) => (
          <div key={plan.id} className="animate-card-in" style={{ animationDelay: `${i * 60}ms` }}>
            <PlanCard
              plan={plan}
              isCurrent={plan.id === details.storage_plan_id}
              isPending={plan.id === details.pending_plan_id}
              isDowngrade={!!currentPlan && plan.gb_limit < currentPlan.gb_limit}
              busy={busy}
              onSelect={() => selectPlan(plan)}
            />
          </div>
        ))}
      </div>

      <div className="mt-14 rounded-3xl bg-muted p-8">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Todos los planes incluyen</p>
        <ul className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {COMMON_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <span className="mt-0.5 text-foreground">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-14">
        <h2 className="font-studio text-2xl font-bold tracking-tight2">Espacio adicional</h2>
        <p className="mt-1 text-sm text-muted-foreground">Súmalo sobre tu plan actual si te falta un poco de espacio a mitad de mes — no reemplaza tu plan.</p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {storageAddons.map((addon) => {
            const active = details.storage_addon_ids.includes(addon.id)
            return (
              <div key={addon.id} className={cn('flex items-center justify-between gap-3 rounded-2xl border p-5', active ? 'border-foreground bg-foreground/5' : 'border-border bg-card')}>
                <div>
                  <p className="font-semibold">{addon.name}</p>
                  <p className="text-sm text-muted-foreground">Q{addon.price_monthly_gtq}/mes</p>
                </div>
                <Button
                  variant={active ? 'secondary' : 'dark'}
                  size="sm"
                  disabled={addonBusy === addon.id}
                  onClick={() => toggleAddon('storage', addon.id, addon.name)}
                >
                  {active ? 'Quitar' : 'Agregar'}
                </Button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-14">
        <h2 className="font-studio text-2xl font-bold tracking-tight2">Extras</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Funciones nativas de un plan más alto, disponibles sueltas sobre el tuyo — compara contra subir de plan antes de acumular varios.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {featureAddons.map((addon) => {
            const active = details.feature_addon_ids.includes(addon.id)
            const isNative = !!currentPlan && !!addon.native_plan_id && plans.findIndex((p) => p.id === addon.native_plan_id) <= plans.findIndex((p) => p.id === currentPlan.id)
            return (
              <div key={addon.id} className={cn('flex items-center justify-between gap-3 rounded-2xl border p-5', active || isNative ? 'border-foreground bg-foreground/5' : 'border-border bg-card')}>
                <div>
                  <p className="font-semibold">{addon.name}</p>
                  <p className="text-sm text-muted-foreground">{isNative ? 'Incluido en tu plan actual' : `Q${addon.price_monthly_gtq}/mes suelto`}</p>
                </div>
                {isNative ? (
                  <span className="rounded-full bg-foreground px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-background">Incluido</span>
                ) : (
                  <Button variant={active ? 'secondary' : 'dark'} size="sm" disabled={addonBusy === addon.id} onClick={() => toggleAddon('feature', addon.id, addon.name)}>
                    {active ? 'Quitar' : 'Agregar'}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mx-auto mt-20 max-w-2xl">
        <h2 className="text-center font-studio text-3xl font-bold tracking-tight2">Preguntas frecuentes</h2>
        <div className="mt-8">
          <Accordion items={FAQ_ITEMS} defaultOpen={null} />
        </div>
      </div>
    </div>
  )
}
