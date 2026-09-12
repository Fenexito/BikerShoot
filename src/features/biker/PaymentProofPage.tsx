import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { Button } from '../../ui/flat/Button'
import { Card } from '../../ui/flat/Card'
import { Skeleton } from '../../ui/shared/Skeleton'
import { useToastStore } from '../../ui/overlays/toastStore'
import { IconCart } from '../../ui/shared/icons'

interface BankDetails {
  bank_name: string | null
  bank_account_holder: string | null
  bank_account_number: string | null
  bank_account_type: string | null
}

interface PhotographerDue {
  photographerId: string
  photographerName: string
  itemCount: number
  total: number
  bank: BankDetails | null
}

function normalizeOne<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function useOrderPaymentInfo(orderId: string | undefined) {
  return useQuery({
    queryKey: ['order-payment-info', orderId],
    queryFn: async (): Promise<{ dues: PhotographerDue[]; grandTotal: number }> => {
      const { data, error } = await supabase
        .from('order_items')
        .select(
          'photographer_id, price, service_fee, is_courtesy, photographer:profiles(display_name, photographer_details(bank_name, bank_account_holder, bank_account_number, bank_account_type))',
        )
        .eq('order_id', orderId)
      if (error) throw error

      const byPhotographer = new Map<string, PhotographerDue>()
      for (const row of (data ?? []) as unknown as {
        photographer_id: string
        price: number
        service_fee: number
        is_courtesy: boolean
        photographer: { display_name: string; photographer_details: BankDetails | BankDetails[] | null } | null
      }[]) {
        const existing = byPhotographer.get(row.photographer_id)
        const amount = row.is_courtesy ? 0 : Number(row.price) + Number(row.service_fee)
        if (existing) {
          existing.total += amount
          existing.itemCount += 1
        } else {
          byPhotographer.set(row.photographer_id, {
            photographerId: row.photographer_id,
            photographerName: row.photographer?.display_name ?? 'Fotógrafo',
            itemCount: 1,
            total: amount,
            bank: normalizeOne(row.photographer?.photographer_details ?? null),
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
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.from('order_payment_proofs').select('photographer_id, proof_path').eq('order_id', orderId)
      if (error) throw error
      const map: Record<string, string> = {}
      for (const row of data ?? []) map[row.photographer_id] = row.proof_path
      return map
    },
    enabled: !!orderId,
  })
}

function PhotographerDueCard({ due, orderId, hasProof }: { due: PhotographerDue; orderId: string; hasProof: boolean }) {
  const push = useToastStore((s) => s.push)
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState(false)

  const bankLines = due.bank
    ? [
        due.bank.bank_name && `Banco: ${due.bank.bank_name}`,
        due.bank.bank_account_holder && `Titular: ${due.bank.bank_account_holder}`,
        due.bank.bank_account_number && `Cuenta: ${due.bank.bank_account_number}`,
        due.bank.bank_account_type && `Tipo: ${due.bank.bank_account_type}`,
      ].filter(Boolean)
    : []

  async function copyBankInfo() {
    const text = [...bankLines, `Monto a transferir: Q${due.total}`].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      push({ type: 'error', title: 'No se pudo copiar', description: 'Cópialo manualmente.' })
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      const { data, error } = await supabase.functions.invoke('r2-payment-proof-upload-url', {
        body: { orderId, photographerId: due.photographerId, fileName: file.name, contentType: file.type },
      })
      if (error || !data?.uploadUrl) throw new Error(error?.message ?? 'No se pudo obtener la URL de subida')

      const putRes = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!putRes.ok) throw new Error(`R2 respondió ${putRes.status}`)

      const { error: upsertError } = await supabase
        .from('order_payment_proofs')
        .upsert({ order_id: orderId, photographer_id: due.photographerId, proof_path: data.proofPath }, { onConflict: 'order_id,photographer_id' })
      if (upsertError) throw upsertError

      push({ type: 'success', title: 'Comprobante subido', description: `${due.photographerName} lo verá para confirmar tu pago.` })
      queryClient.invalidateQueries({ queryKey: ['order-payment-proofs', orderId] })
    } catch (err) {
      push({ type: 'error', title: 'No se pudo subir el comprobante', description: (err as Error).message })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card className="cursor-default hover:scale-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold">{due.photographerName}</p>
          <p className="text-sm text-muted-foreground">
            {due.itemCount} foto{due.itemCount === 1 ? '' : 's'}
          </p>
        </div>
        <p className="text-xl font-bold text-primary">Q{due.total}</p>
      </div>

      {bankLines.length === 0 ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
          Este fotógrafo todavía no registró sus datos bancarios. Escríbele para coordinar el pago.
        </p>
      ) : (
        <div className="mt-4 rounded-2xl bg-muted p-4 text-sm">
          {bankLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <button onClick={copyBankInfo} className="mt-2 text-xs font-semibold text-primary hover:underline">
            {copied ? '✓ Copiado' : 'Copiar datos'}
          </button>
        </div>
      )}

      <div className="mt-4 border-t border-border pt-4">
        {hasProof ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-secondary">✓ Comprobante subido — puedes reemplazarlo si te equivocaste</p>
        ) : (
          <p className="text-sm text-muted-foreground">Sube la captura de tu comprobante de transferencia para este fotógrafo.</p>
        )}
        <label className="mt-2 flex h-11 w-full cursor-pointer items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-90">
          {uploading ? 'Subiendo…' : hasProof ? 'Reemplazar comprobante' : 'Subir comprobante'}
          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => handleFile(e.target.files?.[0])} />
        </label>
      </div>
    </Card>
  )
}

export function PaymentProofPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const { data, isLoading } = useOrderPaymentInfo(orderId)
  const { data: proofs = {} } = useExistingProofs(orderId)

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-2xl px-3 py-6 font-flat md:px-8 md:py-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-48 w-full rounded-3xl" />
      </div>
    )
  }

  const allUploaded = data.dues.every((d) => !!proofs[d.photographerId])

  return (
    <div className="mx-auto max-w-2xl px-3 py-6 font-flat md:px-8 md:py-10">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">✓</span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">Completa tu pago por transferencia</h1>
      <p className="mt-2 text-muted-foreground">
        {data.dues.length > 1
          ? 'Tu pedido incluye varios fotógrafos — transfiere el monto exacto a CADA UNO por separado, y sube el comprobante correspondiente.'
          : 'Transfiere el monto exacto y sube la captura de tu comprobante.'}
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {data.dues.map((due) => (
          <PhotographerDueCard key={due.photographerId} due={due} orderId={orderId!} hasProof={!!proofs[due.photographerId]} />
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
        <Link to="/app/historial">
          <Button size="lg" className="mt-2">
            <IconCart className="h-4 w-4" /> Ir a Mis compras
          </Button>
        </Link>
      </div>
    </div>
  )
}
