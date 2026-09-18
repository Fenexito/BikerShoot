import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { r2Url } from '../../lib/r2'
import { Button } from '../../ui/flat/Button'
import { Skeleton } from '../../ui/shared/Skeleton'
import { useToastStore } from '../../ui/overlays/toastStore'
import { useBackButton } from '../../ui/shared/useBackButton'
import { IconCart } from '../../ui/shared/icons'
import { AnimateIcon } from '../../ui/animate-icons/icon'
import { Upload } from '../../ui/animate-icons/icons/Upload'
import { Eye } from '../../ui/animate-icons/icons/Eye'
import { Edit } from '../../ui/animate-icons/icons/Edit'
import { Check } from '../../ui/animate-icons/icons/Check'
import { PhotoLightbox } from './components/PhotoLightbox'

interface BankAccountInfo {
  bank_name: string | null
  account_holder: string | null
  account_number: string | null
  account_type: string | null
  info_photo_path: string | null
}

interface PhotographerDue {
  photographerId: string
  photographerName: string
  itemCount: number
  priceTotal: number
  serviceFeeTotal: number
  total: number
  bankAccounts: BankAccountInfo[]
}

function useOrderPaymentInfo(orderId: string | undefined) {
  return useQuery({
    queryKey: ['order-payment-info', orderId],
    queryFn: async (): Promise<{ dues: PhotographerDue[]; grandTotal: number }> => {
      const { data, error } = await supabase
        .from('order_items')
        .select(
          'photographer_id, price, service_fee, is_courtesy, photographer:profiles(display_name, photographer_bank_accounts(bank_name, account_holder, account_number, account_type, info_photo_path))',
        )
        .eq('order_id', orderId)
      if (error) throw error

      const byPhotographer = new Map<string, PhotographerDue>()
      for (const row of (data ?? []) as unknown as {
        photographer_id: string
        price: number
        service_fee: number
        is_courtesy: boolean
        photographer: { display_name: string; photographer_bank_accounts: BankAccountInfo[] | null } | null
      }[]) {
        const existing = byPhotographer.get(row.photographer_id)
        // Las cortesías no cobran nada — ni precio ni tarifa de servicio.
        const price = row.is_courtesy ? 0 : Number(row.price)
        const serviceFee = row.is_courtesy ? 0 : Number(row.service_fee)
        if (existing) {
          existing.priceTotal += price
          existing.serviceFeeTotal += serviceFee
          existing.total += price + serviceFee
          existing.itemCount += 1
        } else {
          byPhotographer.set(row.photographer_id, {
            photographerId: row.photographer_id,
            photographerName: row.photographer?.display_name ?? 'Fotógrafo',
            itemCount: 1,
            priceTotal: price,
            serviceFeeTotal: serviceFee,
            total: price + serviceFee,
            bankAccounts: row.photographer?.photographer_bank_accounts ?? [],
          })
        }
      }
      const dues = Array.from(byPhotographer.values())
      return { dues, grandTotal: dues.reduce((s, d) => s + d.total, 0) }
    },
    enabled: !!orderId,
  })
}

function useExistingProofs(orderId: string | undefined) {
  return useQuery({
    queryKey: ['order-payment-proofs', orderId],
    queryFn: async (): Promise<Record<string, { proofPath: string; uploadedAt: string }>> => {
      const { data, error } = await supabase.from('order_payment_proofs').select('photographer_id, proof_path, uploaded_at').eq('order_id', orderId)
      if (error) throw error
      const map: Record<string, { proofPath: string; uploadedAt: string }> = {}
      for (const row of data ?? []) map[row.photographer_id] = { proofPath: row.proof_path, uploadedAt: row.uploaded_at }
      return map
    },
    enabled: !!orderId,
  })
}

/** URL firmada del comprobante ya subido — se pide en cuanto `hasProof` es
 * cierto (no solo al hacer click en "Ver"), así para cuando el usuario
 * hace click el visor ya tiene la imagen lista casi siempre; si no, el
 * visor se abre igual mostrando su propio loader hasta que llegue (ver
 * `loading` en PhotoLightbox), en vez de dejar al usuario esperando
 * afuera. También sirve para la miniatura junto a "Ver"/"Reemplazar". */
function useProofViewUrl(orderId: string | undefined, photographerId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['payment-proof-view-url', orderId, photographerId],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.functions.invoke('r2-payment-proof-view-url', { body: { orderId, photographerId } })
      if (error || !data?.viewUrl) return null
      return data.viewUrl as string
    },
    enabled: enabled && !!orderId,
    staleTime: 5 * 60 * 1000,
  })
}

/** Sube con PUT vía XMLHttpRequest (no `fetch`) porque `fetch` no expone
 * progreso de subida en todos los navegadores — XHR sí, con el evento
 * `upload.onprogress`, necesario para la barra de "Subiendo… 42%". */
function uploadWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2 respondió ${xhr.status}`)))
    xhr.onerror = () => reject(new Error('Falló la conexión al subir el archivo'))
    xhr.send(file)
  })
}

function BankAccountBlock({ account, total }: { account: BankAccountInfo; total: number }) {
  const push = useToastStore((s) => s.push)
  const [copied, setCopied] = useState(false)

  const lines = [
    account.bank_name && `Banco: ${account.bank_name}`,
    account.account_holder && `Titular: ${account.account_holder}`,
    account.account_number && `Cuenta: ${account.account_number}`,
    account.account_type && `Tipo: ${account.account_type}`,
  ].filter((l): l is string => !!l)

  async function copy() {
    try {
      await navigator.clipboard.writeText([...lines, `Monto a transferir: Q${total}`].join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      push({ type: 'error', title: 'No se pudo copiar', description: 'Cópialo manualmente.' })
    }
  }

  return (
    <div className="rounded-2xl bg-muted p-4 text-sm">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {account.info_photo_path && <img src={r2Url(account.info_photo_path)} alt="Datos de la cuenta" className="mt-2 h-28 w-full rounded-xl border border-border object-cover" />}
      <button onClick={copy} className="mt-2 text-xs font-semibold text-primary hover:underline">
        {copied ? '✓ Copiado' : 'Copiar datos'}
      </button>
    </div>
  )
}

function PhotographerDueCard({ due, orderId, bikerName, proof }: { due: PhotographerDue; orderId: string; bikerName: string; proof: { proofPath: string; uploadedAt: string } | undefined }) {
  const push = useToastStore((s) => s.push)
  const [progress, setProgress] = useState<number | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const hasProof = !!proof
  const { data: proofViewUrl } = useProofViewUrl(orderId, due.photographerId, hasProof)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setProgress(0)
    try {
      const { data, error } = await supabase.functions.invoke('r2-payment-proof-upload-url', {
        body: { orderId, photographerId: due.photographerId, fileName: file.name, contentType: file.type },
      })
      if (error || !data?.uploadUrl) throw new Error(error?.message ?? 'No se pudo obtener la URL de subida')

      await uploadWithProgress(data.uploadUrl, file, setProgress)

      const { error: upsertError } = await supabase
        .from('order_payment_proofs')
        .upsert({ order_id: orderId, photographer_id: due.photographerId, proof_path: data.proofPath }, { onConflict: 'order_id,photographer_id' })
      if (upsertError) throw upsertError

      push({ type: 'success', title: 'Comprobante subido', description: `${due.photographerName} lo verá para confirmar tu pago.` })
      queryClient.invalidateQueries({ queryKey: ['order-payment-proofs', orderId] })
      queryClient.invalidateQueries({ queryKey: ['payment-proof-view-url', orderId, due.photographerId] })
    } catch (err) {
      push({ type: 'error', title: 'No se pudo subir el comprobante', description: (err as Error).message })
    } finally {
      setProgress(null)
    }
  }

  const uploading = progress !== null

  return (
    <div className="rounded-3xl border border-border bg-card p-4 md:p-5">
      {/* El nombre del fotógrafo es la info PRINCIPAL de la tarjeta — todo
          lo demás (fotos, tarifa, total) cuelga de él. */}
      <p className="text-lg font-bold tracking-tight">{due.photographerName}</p>
      <p className="text-sm text-muted-foreground">
        {due.itemCount} foto{due.itemCount === 1 ? '' : 's'}
      </p>

      {/* Desglose: precio de las fotos (ya con cualquier descuento
          aplicado, viene calculado así desde el carrito) + tarifa de
          servicio correspondiente = el total que el biker debe
          transferir a ESTE fotógrafo. */}
      <div className="mt-3 flex flex-col gap-1 rounded-2xl bg-muted px-4 py-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Fotos</span>
          <span className="font-medium">Q{due.priceTotal}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Tarifa de servicio</span>
          <span className="font-medium">Q{due.serviceFeeTotal}</span>
        </div>
        <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5">
          <span className="font-semibold">Total a transferir</span>
          <span className="text-lg font-bold text-primary">Q{due.total}</span>
        </div>
      </div>

      {due.bankAccounts.length === 0 ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
          Este fotógrafo todavía no registró sus datos bancarios. Escríbele para coordinar el pago.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {due.bankAccounts.map((account, i) => (
            <BankAccountBlock key={i} account={account} total={due.total} />
          ))}
        </div>
      )}

      <div className="mt-4 border-t border-border pt-4">
        {hasProof ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-secondary">
            <Check size={16} /> Comprobante subido
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Sube la captura de tu comprobante de transferencia para este fotógrafo.</p>
        )}

        {uploading && (
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all duration-150" style={{ width: `${progress}%` }} />
          </div>
        )}

        <div className="mt-2 flex items-center gap-2">
          {/* Miniatura del comprobante ya subido — mientras se resuelve la
              URL firmada, un loader chico en vez de un hueco vacío. */}
          {hasProof && !uploading && (
            <button
              onClick={() => setViewerOpen(true)}
              className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted"
              aria-label="Ver comprobante"
            >
              {proofViewUrl ? (
                <img src={proofViewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
              )}
            </button>
          )}
          {hasProof && !uploading && (
            <AnimateIcon animateOnHover animateOnTap asChild>
              <Button variant="secondary" className="flex-1 gap-1.5" onClick={() => setViewerOpen(true)}>
                <Eye size={16} /> Ver comprobante
              </Button>
            </AnimateIcon>
          )}
          <AnimateIcon animateOnHover animateOnTap asChild>
            <label className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90">
              {!uploading && (hasProof ? <Edit size={16} /> : <Upload size={16} />)}
              {uploading ? `Subiendo… ${progress}%` : hasProof ? 'Reemplazar' : 'Subir comprobante'}
              <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => handleFile(e.target.files?.[0])} />
            </label>
          </AnimateIcon>
        </div>
      </div>

      {viewerOpen && (
        <PhotoLightbox
          photos={[
            {
              id: `proof-${due.photographerId}`,
              event_id: '',
              photographer_id: due.photographerId,
              point_id: null,
              storage_path: null,
              preview_path: null,
              thumbnail_path: null,
              raw_path: null,
              delivered_path: null,
              price: due.total,
              moto_brand: null,
              featured: false,
              original_filename: null,
              created_at: '',
              eventTitle: '',
              photographerName: due.photographerName,
            },
          ]}
          index={0}
          onClose={() => setViewerOpen(false)}
          onNavigate={() => {}}
          mode="purchased"
          loading={!proofViewUrl}
          resolveSrc={() => proofViewUrl ?? undefined}
          infoRows={[
            { label: 'Enviado a', value: due.photographerName },
            { label: 'Enviado por', value: bikerName },
            ...(proof?.uploadedAt ? [{ label: 'Fecha', value: new Date(proof.uploadedAt).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }) }] : []),
            { label: 'Monto', value: `Q${due.total}` },
          ]}
        />
      )}
    </div>
  )
}

export function PaymentProofPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const { profile } = useAuth()
  const { data, isLoading } = useOrderPaymentInfo(orderId)
  const { data: proofs = {} } = useExistingProofs(orderId)
  // Reservado en el header — 'back' regresa en el historial del navegador
  // sin importar de dónde vino (carrito, el pedido en Mis compras, o un
  // link directo desde la página del evento).
  useBackButton('back')

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-6 font-flat md:px-8 md:py-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-48 w-full rounded-3xl" />
      </div>
    )
  }

  const allUploaded = data.dues.every((d) => !!proofs[d.photographerId])

  return (
    <div className="mx-auto max-w-6xl px-3 py-6 font-flat md:px-8 md:py-10">
      {/* "Ir a Mis compras" siempre arriba a la izquierda; una vez que ya
          subió todo, "Ver mi pedido" aparece al lado opuesto — el camino
          más directo de vuelta al pedido en vez de la lista completa. */}
      <div className="flex items-center justify-between gap-3">
        <Link to="/app/historial">
          <Button variant="secondary" size="sm">
            <IconCart className="h-4 w-4" /> Ir a Mis compras
          </Button>
        </Link>
        {allUploaded && orderId && (
          <Link to={`/app/historial/${orderId}`}>
            <Button size="sm">Ver mi pedido</Button>
          </Link>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Check size={20} />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Completa tu pago por transferencia</h1>
          <p className="mt-1 text-muted-foreground">
            {data.dues.length > 1
              ? 'Tu pedido incluye varios fotógrafos — transfiere el monto exacto a CADA UNO por separado, y sube el comprobante correspondiente.'
              : 'Transfiere el monto exacto y sube la captura de tu comprobante.'}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {data.dues.map((due) => (
          <PhotographerDueCard key={due.photographerId} due={due} orderId={orderId!} bikerName={profile?.display_name ?? 'Biker'} proof={proofs[due.photographerId]} />
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between rounded-2xl bg-muted px-5 py-4">
        <span className="text-sm text-muted-foreground">Total del pedido (referencia, no se paga de un solo golpe)</span>
        <span className="font-bold">Q{data.grandTotal}</span>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 text-center">
        {allUploaded ? (
          <p className="text-sm font-semibold text-secondary">✓ Ya subiste todos los comprobantes — cada fotógrafo confirmará tu pago desde su panel.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Puedes salir y volver a esta página cuando quieras para terminar de subir tus comprobantes.</p>
        )}
      </div>
    </div>
  )
}
