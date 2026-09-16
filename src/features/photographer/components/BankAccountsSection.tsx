import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { queryClient } from '../../../lib/queryClient'
import { r2Url } from '../../../lib/r2'
import { useBankAccounts, type BankAccount } from '../useBankAccounts'
import { Button } from '../../../ui/studio/Button'
import { ConfirmDeleteButton } from '../../../ui/shared/ConfirmDeleteButton'
import { Trash } from '../../../ui/animate-icons/icons/Trash'
import { CirclePlus } from '../../../ui/animate-icons/icons/CirclePlus'
import { useToastStore } from '../../../ui/overlays/toastStore'
import { cn } from '../../../lib/cn'

const inputClass = 'w-full rounded-2xl border border-border bg-input px-4 py-2.5 text-sm outline-none focus:border-accent'

function invalidate(photographerId: string) {
  queryClient.invalidateQueries({ queryKey: ['bank-accounts', photographerId] })
}

interface Draft {
  bank_name: string
  account_holder: string
  account_number: string
  account_type: string
}

function BankAccountCard({ account, photographerId, startEditing }: { account: BankAccount; photographerId: string; startEditing?: boolean }) {
  const push = useToastStore((s) => s.push)
  const [editing, setEditing] = useState(!!startEditing)
  const [draft, setDraft] = useState<Draft>({
    bank_name: account.bank_name ?? '',
    account_holder: account.account_holder ?? '',
    account_number: account.account_number ?? '',
    account_type: account.account_type ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  function startEdit() {
    setDraft({
      bank_name: account.bank_name ?? '',
      account_holder: account.account_holder ?? '',
      account_number: account.account_number ?? '',
      account_type: account.account_type ?? '',
    })
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('photographer_bank_accounts')
        .update({
          bank_name: draft.bank_name || null,
          account_holder: draft.account_holder || null,
          account_number: draft.account_number || null,
          account_type: draft.account_type || null,
        })
        .eq('id', account.id)
      if (error) throw error
      invalidate(photographerId)
      push({ type: 'success', title: 'Cuenta guardada' })
      setEditing(false)
    } catch (err) {
      push({ type: 'error', title: 'No se pudo guardar', description: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  async function handlePhotoFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      push({ type: 'error', title: 'La foto debe ser una imagen' })
      return
    }
    setUploadingPhoto(true)
    try {
      const { data: signed, error: signError } = await supabase.functions.invoke('r2-bank-info-upload-url', {
        body: { fileName: file.name, contentType: file.type },
      })
      if (signError || !signed?.uploadUrl) throw new Error(signError?.message ?? 'No se pudo obtener la URL de subida')
      const putRes = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!putRes.ok) throw new Error(`R2 respondió ${putRes.status}`)
      const { error: updateError } = await supabase.from('photographer_bank_accounts').update({ info_photo_path: signed.infoPhotoPath }).eq('id', account.id)
      if (updateError) throw updateError
      invalidate(photographerId)
      push({ type: 'success', title: 'Foto actualizada' })
    } catch (err) {
      push({ type: 'error', title: 'No se pudo subir la foto', description: (err as Error).message })
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function removePhoto() {
    const { error } = await supabase.from('photographer_bank_accounts').update({ info_photo_path: null }).eq('id', account.id)
    if (error) {
      push({ type: 'error', title: 'No se pudo quitar la foto', description: error.message })
      return
    }
    invalidate(photographerId)
  }

  async function handleDelete() {
    const { error } = await supabase.from('photographer_bank_accounts').delete().eq('id', account.id)
    if (error) {
      push({ type: 'error', title: 'No se pudo eliminar la cuenta', description: error.message })
      return
    }
    invalidate(photographerId)
    push({ type: 'success', title: 'Cuenta eliminada' })
  }

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-semibold">{account.bank_name || 'Cuenta sin nombre'}</p>
        <div className="flex shrink-0 items-center gap-3">
          <Button variant={editing ? 'secondary' : 'dark'} size="sm" onClick={() => (editing ? setEditing(false) : startEdit())}>
            {editing ? 'Cancelar' : 'Editar'}
          </Button>
          <ConfirmDeleteButton onConfirm={handleDelete} label="Eliminar cuenta" triggerClassName="text-muted-foreground hover:text-red-500">
            <Trash size={16} />
          </ConfirmDeleteButton>
        </div>
      </div>

      {editing ? (
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Banco</span>
            <input value={draft.bank_name} onChange={(e) => setDraft((d) => ({ ...d, bank_name: e.target.value }))} placeholder="Ej. Banco Industrial" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nombre del titular</span>
            <input value={draft.account_holder} onChange={(e) => setDraft((d) => ({ ...d, account_holder: e.target.value }))} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Número de cuenta</span>
            <input value={draft.account_number} onChange={(e) => setDraft((d) => ({ ...d, account_number: e.target.value }))} placeholder="Ej. 123-456789-0" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipo de cuenta</span>
            <input value={draft.account_type} onChange={(e) => setDraft((d) => ({ ...d, account_type: e.target.value }))} placeholder="Monetaria o Ahorro" className={inputClass} />
          </label>

          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Foto de los datos (opcional)</span>
            <p className="mb-2 text-xs text-muted-foreground">Una captura de pantalla de tu cuenta — el biker la ve junto al resto de tus datos al pagar.</p>
            <div className="flex items-center gap-3">
              {account.info_photo_path && <img src={r2Url(account.info_photo_path)} alt="" className="h-16 w-28 shrink-0 rounded-xl border border-border object-cover" />}
              <label className={cn('flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border px-4 text-xs font-semibold hover:bg-muted', uploadingPhoto && 'pointer-events-none opacity-50')}>
                {uploadingPhoto ? 'Subiendo…' : account.info_photo_path ? 'Cambiar foto' : 'Subir foto'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoFile(e.target.files?.[0])} />
              </label>
              {account.info_photo_path && (
                <button onClick={removePhoto} data-no-ripple className="text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline">
                  Quitar
                </button>
              )}
            </div>
          </div>

          <Button variant="dark" size="sm" className="self-start" onClick={handleSave} loading={saving}>
            Guardar
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
          <p>Titular: {account.account_holder || '—'}</p>
          <p>Cuenta: {account.account_number || '—'}</p>
          <p>Tipo: {account.account_type || '—'}</p>
          {account.info_photo_path && <img src={r2Url(account.info_photo_path)} alt="" className="mt-2 h-16 w-28 rounded-xl border border-border object-cover" />}
        </div>
      )}
    </div>
  )
}

/** Antes eran 4 `EditableRow` sueltos (un "Editar" por campo) sobre una
 * sola cuenta posible. Ahora es una lista de tarjetas — cada una con su
 * propio "Editar" único para todos sus campos a la vez (mismo patrón que
 * `PublicInfoSection`), foto opcional, y `ConfirmDeleteButton` (mismo
 * componente que en el visor de evento) para eliminarla — y el fotógrafo
 * puede agregar tantas cuentas como quiera. */
export function BankAccountsSection({ photographerId }: { photographerId: string }) {
  const { data: accounts = [] } = useBankAccounts(photographerId)
  const push = useToastStore((s) => s.push)
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null)

  async function addAccount() {
    const { data, error } = await supabase
      .from('photographer_bank_accounts')
      .insert({ photographer_id: photographerId, sort_order: accounts.length })
      .select()
      .single()
    if (error) {
      push({ type: 'error', title: 'No se pudo agregar la cuenta', description: error.message })
      return
    }
    invalidate(photographerId)
    setNewlyAddedId(data.id)
  }

  return (
    <div className="flex flex-col gap-3">
      {accounts.length === 0 && <p className="text-sm text-muted-foreground">Todavía no has agregado ninguna cuenta bancaria.</p>}
      {accounts.map((a) => (
        <BankAccountCard key={a.id} account={a} photographerId={photographerId} startEditing={a.id === newlyAddedId} />
      ))}
      <button onClick={addAccount} className="mt-1 flex w-fit items-center gap-1.5 text-sm font-semibold text-foreground hover:underline">
        <CirclePlus size={16} /> Agregar cuenta bancaria
      </button>
    </div>
  )
}
