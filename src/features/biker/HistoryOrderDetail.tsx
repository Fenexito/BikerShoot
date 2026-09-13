import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMyOrders, groupOrderByPhotographer, deriveOrderEffectiveStatus, deriveGroupStatus, toGridPhoto, type MyOrderItem, type MyOrderPhotographerGroup } from './useMyOrders'
import { PurchasedPhotoTile, downloadPurchasedPhoto } from './components/PurchasedPhotoTile'
import { PhotoLightbox } from './components/PhotoLightbox'
import { queryClient } from '../../lib/queryClient'
import { buildDeliveredFilename } from '../../lib/download'
import { Button } from '../../ui/flat/Button'
import { StatusPill } from '../../ui/shared/StatusPill'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { OrderStepper } from '../../ui/studio/OrderStepper'
import { formatPointSchedule } from './useCartPricing'
import { getEffectiveStatusStyle, formatOrderCode, type EffectiveOrderStatus } from '../../lib/orderStatus'
import { PlaceholderPage } from '../auth/PlaceholderPage'
import { Skeleton, SkeletonGrid } from '../../ui/shared/Skeleton'
import { useBackButton } from '../../ui/shared/useBackButton'
import { useToastStore } from '../../ui/overlays/toastStore'
import { typedConfirmDialog } from '../../ui/overlays/typedConfirmStore'
import { ActionMenu, type ActionMenuItem } from '../../ui/shared/ActionMenu'
import { useHeaderTransform } from '../../ui/layout/useHeaderTransform'
import { useScrolledPast } from '../../ui/shared/useScrolledPast'
import { supabase } from '../../lib/supabase'
import { IconDownload, IconEye, IconEdit, IconWhatsapp } from '../../ui/shared/icons'
import { Trash } from '../../ui/animate-icons/icons/Trash'
import { buildWhatsAppLink } from '../../lib/whatsapp'

// Misma línea (168px) que usa el header pegajoso de la vista de evento del
// fotógrafo, para decidir qué sección "cuenta" como la que se está viendo.
const STICKY_BAR_LINE = 168

// Con transferencia, el flujo pasa primero por "subir comprobante" — con
// tarjeta ese paso no existe (no hay comprobante manual que subir), así
// que el stepper de cada grupo usa uno u otro flujo según el método de
// pago del pedido.
const FLOW_TRANSFERENCIA: EffectiveOrderStatus[] = ['pendiente_comprobante', 'pendiente_confirmacion', 'en_preparacion', 'entregado']
const FLOW_TARJETA: EffectiveOrderStatus[] = ['pendiente_confirmacion', 'en_preparacion', 'entregado']
const JUST_CLOSED_MS = 1600

/** Agrupa las fotos de UN fotógrafo, dentro de este pedido, por evento y
 * luego por punto (con su horario) — mismo criterio visual que el carrito
 * y el checkout, para que un pedido con fotos de varios puntos no se vea
 * como una sola lista plana sin ningún criterio. */
function groupItemsByEventoPunto(items: MyOrderItem[]) {
  const byEvent = new Map<string, { eventTitle: string; items: MyOrderItem[] }>()
  for (const item of items) {
    const key = item.event?.title ?? ''
    const e = byEvent.get(key) ?? { eventTitle: key, items: [] }
    e.items.push(item)
    byEvent.set(key, e)
  }
  return Array.from(byEvent.values()).map((e) => {
    const byPoint = new Map<string, { label: string | null; timeStart: string | null; timeEnd: string | null; items: MyOrderItem[] }>()
    for (const item of e.items) {
      const label = item.photo?.point?.label ?? null
      const key = label ?? '__sin_punto__'
      const p = byPoint.get(key) ?? { label, timeStart: item.photo?.point?.time_start ?? null, timeEnd: item.photo?.point?.time_end ?? null, items: [] }
      p.items.push(item)
      byPoint.set(key, p)
    }
    return { eventTitle: e.eventTitle, points: Array.from(byPoint.values()) }
  })
}

/** Botón de comprobante por fotógrafo — mientras no hay ninguno, un botón
 * NEGRO bien visible ("Subir Comprobante": es lo único que bloquea todo
 * el pedido, no debería pasar desapercibido). Una vez subido, se
 * convierte en un menú "Comprobantes" con Ver (abre el visor compartido)
 * y Editar (reemplaza el archivo ahí mismo, sin salir de esta página —
 * antes "Editar" navegaba a la página de carga solo para volver a subir
 * el mismo archivo). */
function ProofButton({ orderId, photographerId, photographerName, bikerName, amount, hasProof }: {
  orderId: string
  photographerId: string
  photographerName: string
  bikerName: string
  amount: number
  hasProof: boolean
}) {
  const push = useToastStore((s) => s.push)
  const [menuOpen, setMenuOpen] = useState(false)
  const [replacing, setReplacing] = useState(false)
  // `viewUrl: null` mientras se resuelve — el visor se abre YA (con su
  // animación) mostrando un spinner, en vez de dejar al usuario sin
  // ninguna señal por varios segundos mientras se pide la URL firmada.
  const [proof, setProof] = useState<{ viewUrl: string | null; uploadedAt: string } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [menuOpen])

  async function openViewer() {
    setMenuOpen(false)
    setProof({ viewUrl: null, uploadedAt: '' })
    try {
      const [{ data, error }, { data: row }] = await Promise.all([
        supabase.functions.invoke('r2-payment-proof-view-url', { body: { orderId, photographerId } }),
        supabase.from('order_payment_proofs').select('uploaded_at').eq('order_id', orderId).eq('photographer_id', photographerId).maybeSingle(),
      ])
      if (error || !data?.viewUrl) throw new Error(error?.message ?? 'No se pudo abrir el comprobante')
      setProof({ viewUrl: data.viewUrl, uploadedAt: row?.uploaded_at ?? '' })
    } catch (err) {
      push({ type: 'error', title: 'No se pudo abrir el comprobante', description: (err as Error).message })
      setProof(null)
    }
  }

  async function handleReplace(file: File | undefined) {
    setMenuOpen(false)
    if (!file) return
    setReplacing(true)
    try {
      const { data, error } = await supabase.functions.invoke('r2-payment-proof-upload-url', {
        body: { orderId, photographerId, fileName: file.name, contentType: file.type },
      })
      if (error || !data?.uploadUrl) throw new Error(error?.message ?? 'No se pudo obtener la URL de subida')
      const putRes = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!putRes.ok) throw new Error(`R2 respondió ${putRes.status}`)
      const { error: upsertError } = await supabase
        .from('order_payment_proofs')
        .upsert({ order_id: orderId, photographer_id: photographerId, proof_path: data.proofPath }, { onConflict: 'order_id,photographer_id' })
      if (upsertError) throw upsertError
      push({ type: 'success', title: 'Comprobante actualizado' })
      queryClient.invalidateQueries({ queryKey: ['my-orders'] })
    } catch (err) {
      push({ type: 'error', title: 'No se pudo actualizar el comprobante', description: (err as Error).message })
    } finally {
      setReplacing(false)
    }
  }

  if (!hasProof) {
    // Negro resaltado (variant="dark") a propósito — es el único bloqueo
    // real para que el pedido avance, así que no debería mimetizarse con
    // el resto de botones secundarios de la página.
    return (
      <Link to={`/app/checkout/pago/${orderId}`}>
        <Button variant="dark" size="sm">Subir Comprobante</Button>
      </Link>
    )
  }

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          disabled={replacing}
          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-50"
        >
          {replacing ? 'Actualizando…' : 'Comprobantes'} <span className="text-xs text-muted-foreground">▾</span>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-52 origin-top overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 py-1.5 text-white shadow-2xl animate-menu-in">
            <button onClick={openViewer} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-white/90 transition-colors hover:bg-white/10">
              <IconEye className="h-4 w-4 shrink-0" /> Ver comprobante
            </button>
            <label className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-white/90 transition-colors hover:bg-white/10">
              <IconEdit className="h-4 w-4 shrink-0" /> Editar comprobante
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleReplace(e.target.files?.[0])} />
            </label>
          </div>
        )}
      </div>
      {proof && (
        <PhotoLightbox
          photos={[
            {
              id: `proof-${photographerId}`,
              event_id: '',
              photographer_id: photographerId,
              point_id: null,
              storage_path: null,
              preview_path: null,
              raw_path: null,
              delivered_path: null,
              price: amount,
              moto_brand: null,
              featured: false,
              original_filename: null,
              created_at: '',
              eventTitle: '',
              photographerName,
            },
          ]}
          index={0}
          onClose={() => setProof(null)}
          onNavigate={() => {}}
          mode="purchased"
          loading={!proof.viewUrl}
          resolveSrc={() => proof.viewUrl ?? undefined}
          infoRows={[
            { label: 'Enviado a', value: photographerName },
            { label: 'Enviado por', value: bikerName },
            ...(proof.uploadedAt ? [{ label: 'Fecha', value: new Date(proof.uploadedAt).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) }] : []),
            { label: 'Monto', value: `Q${amount}` },
          ]}
        />
      )}
    </>
  )
}

/** Descarga TODAS las fotos entregadas de un fotógrafo de una sola vez —
 * solo aparece cuando ese fotógrafo ya completó su parte del pedido. Baja
 * cada archivo en secuencia (con una pausa corta entre cada uno) en vez de
 * simultáneo — los navegadores bloquean/preguntan permiso para varias
 * descargas a la vez si llegan todas de golpe. Sigue existiendo la
 * descarga individual por si el biker solo quiere una en particular. */
function DownloadAllButton({ items, photographerLabel, orderNumber }: { items: MyOrderItem[]; photographerLabel: string; orderNumber: number | null }) {
  const push = useToastStore((s) => s.push)
  const [downloading, setDownloading] = useState(false)

  async function handleDownloadAll() {
    setDownloading(true)
    try {
      for (const item of items) {
        if (!item.photo?.delivered_path) continue
        const filename = buildDeliveredFilename(photographerLabel, orderNumber, item.position, item.photo.original_filename)
        await downloadPurchasedPhoto(item.photo_id, filename)
        await new Promise((r) => setTimeout(r, 400))
      }
    } catch (err) {
      push({ type: 'error', title: 'No se pudo descargar todo', description: (err as Error).message })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Button variant="secondary" size="sm" loading={downloading} onClick={handleDownloadAll}>
      <IconDownload className="h-4 w-4" /> Descargar todas
    </Button>
  )
}

export function HistoryOrderDetail() {
  const { id } = useParams()
  useBackButton('/app/historial')
  const { user, profile } = useAuth()
  const push = useToastStore((s) => s.push)
  const { data: orders = [], isLoading } = useMyOrders(user?.id)
  const order = orders.find((o) => o.id === id)
  const photographerGroups = order ? groupOrderByPhotographer(order) : []
  const flow = order?.payment_method === 'transferencia' ? FLOW_TRANSFERENCIA : FLOW_TARJETA
  const flowLabels = flow.map((s) => getEffectiveStatusStyle(s).label)
  const proofPhotographerIds = new Set(order?.order_payment_proofs.map((p) => p.photographer_id) ?? [])
  const overallStatus = order ? deriveOrderEffectiveStatus(order) : null
  const overallStyle = overallStatus ? getEffectiveStatusStyle(overallStatus) : null

  // Header interactivo — el mismo header global se transforma (crossfade),
  // también en móvil (`mobileEnabled`) — ver headerTransformStore. Además de
  // detectar qué fotógrafo se está viendo, guarda su `photographerId` — el
  // grupo "activo" es el que alimenta las acciones del menú de tres puntos
  // (comprobante/WhatsApp/cancelar).
  const scrolledPast = useScrolledPast(140)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    function onScroll() {
      let current: string | null = null
      for (const group of photographerGroups) {
        const el = groupRefs.current[group.photographerId]
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.top <= STICKY_BAR_LINE && rect.bottom >= STICKY_BAR_LINE) {
          current = group.photographerId
          break
        }
      }
      setActiveGroupId(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photographerGroups.length, order?.id])

  const activeGroup = photographerGroups.find((g) => g.photographerId === activeGroupId) ?? photographerGroups[0] ?? null
  const activePhotographerName = activeGroup && photographerGroups.length > 1 ? activeGroup.photographerName : null

  // Comprobante desde el menú de tres puntos — apunta siempre al grupo
  // ACTIVO (el fotógrafo cuya sección se está viendo). La tarjeta de cada
  // fotógrafo conserva su propio botón "Comprobantes" (con el mismo Ver/
  // Editar) para cuando hay varios y no se quiere depender del scroll.
  const [headerProof, setHeaderProof] = useState<{ viewUrl: string | null; uploadedAt: string; photographerId: string; photographerName: string } | null>(null)
  const proofInputRef = useRef<HTMLInputElement>(null)

  async function openHeaderProofViewer(photographerId: string, photographerName: string) {
    if (!order) return
    setHeaderProof({ viewUrl: null, uploadedAt: '', photographerId, photographerName })
    try {
      const [{ data, error }, { data: row }] = await Promise.all([
        supabase.functions.invoke('r2-payment-proof-view-url', { body: { orderId: order.id, photographerId } }),
        supabase.from('order_payment_proofs').select('uploaded_at').eq('order_id', order.id).eq('photographer_id', photographerId).maybeSingle(),
      ])
      if (error || !data?.viewUrl) throw new Error(error?.message ?? 'No se pudo abrir el comprobante')
      setHeaderProof((cur) => (cur ? { ...cur, viewUrl: data.viewUrl, uploadedAt: row?.uploaded_at ?? '' } : cur))
    } catch (err) {
      push({ type: 'error', title: 'No se pudo abrir el comprobante', description: (err as Error).message })
      setHeaderProof(null)
    }
  }

  async function handleHeaderProofReplace(file: File | undefined, photographerId: string) {
    if (!file || !order) return
    try {
      const { data, error } = await supabase.functions.invoke('r2-payment-proof-upload-url', {
        body: { orderId: order.id, photographerId, fileName: file.name, contentType: file.type },
      })
      if (error || !data?.uploadUrl) throw new Error(error?.message ?? 'No se pudo obtener la URL de subida')
      const putRes = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!putRes.ok) throw new Error(`R2 respondió ${putRes.status}`)
      const { error: upsertError } = await supabase
        .from('order_payment_proofs')
        .upsert({ order_id: order.id, photographer_id: photographerId, proof_path: data.proofPath }, { onConflict: 'order_id,photographer_id' })
      if (upsertError) throw upsertError
      push({ type: 'success', title: 'Comprobante actualizado' })
      queryClient.invalidateQueries({ queryKey: ['my-orders'] })
    } catch (err) {
      push({ type: 'error', title: 'No se pudo actualizar el comprobante', description: (err as Error).message })
    }
  }

  // OJO: la cancelación SOLO es válida mientras ESE fotógrafo sigue
  // "pendiente_pago" (el biker aún no subió/el fotógrafo aún no confirmó el
  // pago) — una vez confirmado, cancelar deja de ser unilateral y el biker
  // debe acordarlo directamente con el fotógrafo (WhatsApp, ya disponible
  // en el mismo menú).
  function canCancelGroup(group: MyOrderPhotographerGroup) {
    return deriveGroupStatus(group.items) === 'pendiente_pago'
  }

  async function cancelGroup(group: MyOrderPhotographerGroup) {
    if (!order) return
    const orderCode = String(order.order_number ?? '').padStart(6, '0')
    const { confirmed, extraValue } = await typedConfirmDialog.ask({
      title: `Esto cancela tu pedido con ${group.photographerName} — perderás acceso a estas fotos.`,
      description: 'Esta acción no se puede deshacer desde aquí.',
      matchText: orderCode,
      matchLabel: 'Escribe el número de pedido para confirmar',
      confirmLabel: 'Cancelar pedido',
      extraFieldLabel: 'Motivo de la cancelación',
      extraFieldPlaceholder: 'El fotógrafo verá este motivo',
    })
    if (!confirmed) return
    const { error } = await supabase
      .from('order_items')
      .update({ status: 'cancelado', cancelled_at: new Date().toISOString(), cancellation_reason: extraValue || null })
      .in('id', group.items.map((i) => i.id))
    if (error) {
      push({ type: 'error', title: 'No se pudo cancelar', description: error.message })
      return
    }
    push({ type: 'success', title: 'Pedido cancelado' })
    queryClient.invalidateQueries({ queryKey: ['my-orders'] })
  }

  const actionMenuItems: ActionMenuItem[] = activeGroup
    ? [
        ...(order?.payment_method === 'transferencia' && proofPhotographerIds.has(activeGroup.photographerId)
          ? [
              { label: 'Ver comprobante', icon: <IconEye className="h-4 w-4" />, onClick: () => openHeaderProofViewer(activeGroup.photographerId, activeGroup.photographerName) },
              { label: 'Editar comprobante', icon: <IconEdit className="h-4 w-4" />, onClick: () => proofInputRef.current?.click() },
            ]
          : []),
        ...(activeGroup.photographerPhone
          ? [
              {
                label: 'WhatsApp',
                icon: <IconWhatsapp className="h-4 w-4" />,
                tone: 'success' as const,
                href: buildWhatsAppLink(
                  activeGroup.photographerPhone,
                  `Hola ${activeGroup.photographerName}, soy ${profile?.display_name ?? 'un biker'} 👋 Te escribo por mi pedido ${formatOrderCode(order?.order_number ?? null)}: ${window.location.origin}/studio/pedidos/${order?.id}`,
                ),
              },
            ]
          : []),
        ...(canCancelGroup(activeGroup)
          ? [{ label: 'Cancelar Pedido', icon: <Trash size={16} />, tone: 'danger' as const, onClick: () => cancelGroup(activeGroup) }]
          : []),
      ]
    : []

  useHeaderTransform(
    order && overallStyle ? (
      // En móvil, estado+código van en su propia fila y el nombre del
      // fotógrafo activo en una fila debajo — con el texto tan chico, todo
      // en una sola línea se perdía y no se alcanzaba a leer a quién se
      // estaba viendo. En escritorio (`sm:`) se queda como una sola línea.
      <div className="flex w-full min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-center gap-2 sm:contents">
          <StatusPill dot={overallStyle.dot} text={overallStyle.text} label={overallStyle.label} className="shrink-0 text-xs font-bold uppercase tracking-wide" />
          <span className="truncate text-xs text-muted-foreground sm:hidden">{formatOrderCode(order.order_number)}</span>
        </div>
        <p className="hidden min-w-0 flex-1 truncate text-base font-bold sm:block">
          {formatOrderCode(order.order_number)}
          {activePhotographerName && <span className="ml-2 text-sm font-normal text-muted-foreground">· {activePhotographerName}</span>}
        </p>
        {activePhotographerName && <p className="truncate text-sm font-semibold sm:hidden">{activePhotographerName}</p>}
      </div>
    ) : null,
    scrolledPast,
    { mobileEnabled: true, suppressAutoHide: true, hideSearchTrigger: true, hideCartTrigger: true, actionsSlot: <ActionMenu items={actionMenuItems} /> },
  )

  // Un solo visor para TODO el pedido — las flechas navegan entre todas
  // las fotos compradas aquí (sin importar de qué fotógrafo/evento/punto
  // sean), no solo las de la tarjeta donde se hizo click.
  const allPhotos = useMemo(() => (order ? order.order_items.map(toGridPhoto).filter((p): p is NonNullable<typeof p> => !!p) : []), [order])
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [downloading, setDownloading] = useState(false)
  // Con tantas fotos parecidas, al cerrar el visor es fácil perder de vista
  // cuál era la que se estaba viendo — mismo resalte breve que usa Buscar.
  const [justClosedId, setJustClosedId] = useState<string | null>(null)
  const openPhoto = openIndex != null ? allPhotos[openIndex] : null
  const openItem = openPhoto ? order?.order_items.find((i) => i.photo_id === openPhoto.id) : null
  const canDownloadOpen = openItem && (openItem.status === 'en_preparacion' || openItem.status === 'entregado') && openItem.photo?.delivered_path

  function closeLightbox() {
    if (openPhoto) {
      const closedId = openPhoto.id
      setJustClosedId(closedId)
      setTimeout(() => setJustClosedId((cur) => (cur === closedId ? null : cur)), JUST_CLOSED_MS)
    }
    setOpenIndex(null)
  }

  async function handleDownloadOpen() {
    if (!openPhoto || !openItem || !order) return
    setDownloading(true)
    try {
      const filename = buildDeliveredFilename(openItem.photographer?.display_name ?? 'MotoShots', order.order_number, openItem.position, openPhoto.original_filename)
      await downloadPurchasedPhoto(openPhoto.id, filename)
    } catch (err) {
      push({ type: 'error', title: 'No se pudo descargar', description: (err as Error).message })
    } finally {
      setDownloading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-6 font-flat md:px-8 md:py-10">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="mt-3 h-4 w-1/3" />
        <SkeletonGrid count={6} className="mt-8" />
      </div>
    )
  }

  if (!order) return <PlaceholderPage title="Pedido no encontrado" />

  // Un solo evento (sin importar cuántas fotos) muestra su nombre; varios
  // eventos del mismo fotógrafo muestran cuántos son, en vez de uno solo
  // arbitrario que sería engañoso.
  function eventLabelFor(items: MyOrderItem[]) {
    const titles = Array.from(new Set(items.map((i) => i.event?.title).filter(Boolean)))
    return titles.length === 1 ? titles[0] : `${titles.length} eventos`
  }

  return (
    <div className="mx-auto max-w-6xl px-3 py-6 font-flat md:px-8 md:py-10">
      <input
        ref={proofInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (activeGroup) handleHeaderProofReplace(e.target.files?.[0], activeGroup.photographerId)
        }}
      />

      {/* Mismo estilo que el pedido visto por el fotógrafo: una tarjeta por
          fotógrafo (o UNA sola si el pedido tiene un solo fotógrafo) con
          avatar, código de pedido, pago+comprobante+whatsapp junto al
          status, y el stepper de 4 pasos debajo. */}
      <div className="flex flex-col gap-6">
        {photographerGroups.map((group) => {
          const groupStyle = getEffectiveStatusStyle(group.effectiveStatus)
          // Mismo patrón que el pedido visto por el fotógrafo: en
          // escritorio, pago+comprobante+whatsapp viven junto al status a
          // la derecha (una sola fila); en móvil no caben ahí, así que
          // bajan a su propia fila debajo del nombre.
          const paymentActions = (
            <>
              <span className="rounded-full bg-muted px-3 py-1.5 text-sm font-semibold">
                {order.payment_method === 'tarjeta' ? 'Tarjeta' : 'Transferencia'} · Q{group.totalToPay}
              </span>
              {/* Botón de comprobante propio de ESTE fotógrafo — un
                  pedido con varios fotógrafos necesita uno por cada uno,
                  no un solo botón genérico para todo el pedido. */}
              {order.payment_method === 'transferencia' && (
                <ProofButton
                  orderId={order.id}
                  photographerId={group.photographerId}
                  photographerName={group.photographerName}
                  bikerName={profile?.display_name ?? 'Biker'}
                  amount={group.totalToPay}
                  hasProof={proofPhotographerIds.has(group.photographerId)}
                />
              )}
              {group.photographerPhone && (
                <a
                  href={buildWhatsAppLink(
                    group.photographerPhone,
                    `Hola ${group.photographerName}, soy ${profile?.display_name ?? 'un biker'} 👋 Te escribo por mi pedido ${formatOrderCode(order.order_number)}: ${window.location.origin}/studio/pedidos/${order.id}`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white transition-opacity hover:opacity-90"
                  title="Escribir por WhatsApp"
                  aria-label="Escribir por WhatsApp"
                >
                  <IconWhatsapp className="h-4 w-4" />
                </a>
              )}
              {/* Solo cuando ESTE fotógrafo ya entregó todo lo suyo —
                  bajar todas de un tirón en vez de una por una. */}
              {group.effectiveStatus === 'entregado' && (
                <DownloadAllButton items={group.items} photographerLabel={group.photographerName} orderNumber={order.order_number} />
              )}
            </>
          )
          return (
            <div
              key={group.photographerId}
              ref={(el) => { groupRefs.current[group.photographerId] = el }}
              className="rounded-3xl border border-border bg-card p-4 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <InitialsAvatar name={group.photographerName} className="h-12 w-12 shrink-0 bg-foreground text-base text-background sm:h-14 sm:w-14" />
                  <div className="min-w-0">
                    <Link to={`/app/fotografos/${group.photographerId}`} className="truncate text-lg font-bold tracking-tight hover:underline sm:text-xl">
                      {group.photographerName}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground sm:text-sm">{formatOrderCode(order.order_number)} · {eventLabelFor(group.items)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="hidden items-center gap-2 lg:flex">{paymentActions}</div>
                  <StatusPill dot={groupStyle.dot} text={groupStyle.text} label={groupStyle.label} className="shrink-0 text-sm font-bold" />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 lg:hidden">{paymentActions}</div>

              {group.effectiveStatus !== 'cancelado' && (
                <OrderStepper steps={flowLabels} currentIndex={Math.max(0, flow.indexOf(group.effectiveStatus))} className="mb-2 mt-6" />
              )}

              {/* Agrupado por evento → punto (con horario) — el status ya
                  se muestra UNA vez arriba para todo el grupo, así que cada
                  miniatura se ve limpia, sin repetir el mismo pill en cada
                  una. */}
              <div className="flex flex-col gap-5">
                {groupItemsByEventoPunto(group.items).map((event) => (
                  <div key={event.eventTitle}>
                    <p className="mb-2 text-sm font-semibold">{event.eventTitle}</p>
                    <div className="flex flex-col gap-3">
                      {event.points.map((point) => {
                        const schedule = formatPointSchedule(point.timeStart, point.timeEnd)
                        return (
                          <div key={point.label ?? '__sin_punto__'}>
                            {point.label && (
                              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                                {point.label}
                                {schedule && <span className="ml-1.5 font-normal">{schedule}</span>}
                              </p>
                            )}
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                              {point.items.map((item) => (
                                <PurchasedPhotoTile
                                  key={item.id}
                                  photoId={item.photo_id}
                                  photo={item.photo}
                                  status={item.status}
                                  showStatusPill={false}
                                  justClosed={item.photo_id === justClosedId}
                                  downloadFilename={buildDeliveredFilename(item.photographer?.display_name ?? 'MotoShots', order.order_number, item.position, item.photo?.original_filename)}
                                  onClick={() => setOpenIndex(allPhotos.findIndex((p) => p.id === item.photo_id))}
                                />
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {openPhoto && openIndex != null && (
        <PhotoLightbox
          photos={allPhotos}
          index={openIndex}
          onClose={closeLightbox}
          onNavigate={setOpenIndex}
          mode="purchased"
          resolveSrc={(p) => (p.delivered_path ? queryClient.getQueryData<string | null>(['delivered-view-url', p.id]) ?? undefined : undefined)}
          cornerSlot={
            canDownloadOpen ? (
              <button
                onClick={handleDownloadOpen}
                disabled={downloading}
                className="flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <IconDownload className="h-4 w-4" /> {downloading ? 'Descargando…' : 'Descargar'}
              </button>
            ) : undefined
          }
        />
      )}

      {headerProof && (
        <PhotoLightbox
          photos={[
            {
              id: `proof-${headerProof.photographerId}`,
              event_id: '',
              photographer_id: headerProof.photographerId,
              point_id: null,
              storage_path: null,
              preview_path: null,
              raw_path: null,
              delivered_path: null,
              price: 0,
              moto_brand: null,
              featured: false,
              original_filename: null,
              created_at: '',
              eventTitle: '',
              photographerName: headerProof.photographerName,
            },
          ]}
          index={0}
          onClose={() => setHeaderProof(null)}
          onNavigate={() => {}}
          mode="purchased"
          loading={!headerProof.viewUrl}
          resolveSrc={() => headerProof.viewUrl ?? undefined}
          infoRows={[
            { label: 'Enviado a', value: headerProof.photographerName },
            { label: 'Enviado por', value: profile?.display_name ?? 'Biker' },
            ...(headerProof.uploadedAt ? [{ label: 'Fecha', value: new Date(headerProof.uploadedAt).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) }] : []),
          ]}
        />
      )}
    </div>
  )
}
