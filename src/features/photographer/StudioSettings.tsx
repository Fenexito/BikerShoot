import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { usePhotographerDetails } from './usePhotographerDetails'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { r2Url } from '../../lib/r2'
import { Button } from '../../ui/studio/Button'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { useToastStore } from '../../ui/overlays/toastStore'
import { confirmDialog } from '../../ui/overlays/confirmStore'
import { typedConfirmDialog } from '../../ui/overlays/typedConfirmStore'
import { cn } from '../../lib/cn'
import { IconUser, IconSettings, IconBell, IconUsers } from '../../ui/shared/icons'
import type { NotificationType } from '../notifications/useNotifications'

const NOTIFICATION_TOGGLES: { type: NotificationType; label: string; description: string }[] = [
  { type: 'pedido_nuevo', label: 'Pedido nuevo', description: 'Cuando un biker compra fotos tuyas.' },
  { type: 'pedido_cancelado', label: 'Pedido cancelado', description: 'Cuando cancelas un pedido (te confirma que se envió).' },
  { type: 'fotografo_aprobado', label: 'Cuenta aprobada', description: 'Cuando un administrador aprueba tu cuenta.' },
]

const TABS = [
  { id: 'perfil', label: 'Perfil', icon: IconUser },
  { id: 'cuenta', label: 'Cuenta', icon: IconSettings },
  { id: 'notificaciones', label: 'Notificaciones', icon: IconBell },
  { id: 'equipo', label: 'Equipo', icon: IconUsers },
] as const
type TabId = (typeof TABS)[number]['id']

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

const inputClass = 'w-full rounded-2xl border border-border bg-input px-4 py-2.5 text-sm outline-none focus:border-accent'

/** Mismo patrón observado en vivo en mobbin.com/settings: "Editar" no
 * convierte el valor en un input en el mismo sitio — expande un bloque
 * debajo con una descripción corta, el campo editable y un botón "Guardar";
 * "Editar" se sustituye por "Cancelar" en su mismo lugar mientras tanto. */
function EditableRow({
  label,
  value,
  description,
  placeholder,
  onSave,
  type = 'text',
  multiline = false,
}: {
  label: string
  value: string
  description?: string
  placeholder?: string
  onSave: (next: string) => Promise<void>
  type?: string
  multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(draft)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-b border-border py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{label}</p>
        <button onClick={() => setEditing((e) => !e)} className="shrink-0 text-xs font-semibold text-foreground hover:underline">
          {editing ? 'Cancelar' : 'Editar'}
        </button>
      </div>
      {editing ? (
        <div className="mt-3">
          {description && <p className="mb-2 text-xs text-muted-foreground">{description}</p>}
          {multiline ? (
            <textarea autoFocus rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} className={inputClass} />
          ) : (
            <input autoFocus type={type} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} className={inputClass} />
          )}
          <Button variant="dark" size="sm" className="mt-3" onClick={handleSave} loading={saving}>
            Guardar
          </Button>
        </div>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">{value || placeholder || '—'}</p>
      )}
    </div>
  )
}

function NotificationToggle({ enabled, onChange }: { enabled: boolean; onChange: (next: boolean) => void }) {
  const [checked, setChecked] = useState(enabled)
  useEffect(() => setChecked(enabled), [enabled])

  return (
    <button
      onClick={() => {
        setChecked((c) => !c) // optimista: cambia al instante, sin esperar la vuelta del servidor
        onChange(!checked)
      }}
      role="switch"
      aria-checked={checked}
      className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-foreground' : 'bg-muted')}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  )
}

interface PublicInfoDraft {
  name: string
  city: string
  whatsapp: string
  bio: string
  instagram: string
  facebook: string
  tiktok: string
}

/** Un solo botón "Editar" para todo el bloque de información pública —
 * antes cada línea tenía su propio "Editar", que se sentía excesivo para
 * un grupo de campos que casi siempre se actualizan juntos. */
function PublicInfoSection({ draft: current, onSave }: { draft: PublicInfoDraft; onSave: (next: PublicInfoDraft) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(current)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) setDraft(current)
  }, [current, editing])

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(draft)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section title="Información pública" description="Esto es lo que ve un biker en tu perfil.">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Nombre, ciudad, WhatsApp, bio y redes sociales.</p>
        <Button variant={editing ? 'secondary' : 'dark'} size="sm" onClick={() => setEditing((e) => !e)}>
          {editing ? 'Cancelar' : 'Editar'}
        </Button>
      </div>

      {editing ? (
        <div className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nombre del estudio</span>
            <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ciudad</span>
            <input value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">WhatsApp de contacto</span>
            <input value={draft.whatsapp} onChange={(e) => setDraft((d) => ({ ...d, whatsapp: e.target.value }))} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sobre ti</span>
            <textarea rows={3} value={draft.bio} onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))} placeholder="Cuéntale a los bikers de tu trabajo" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Instagram</span>
            <input value={draft.instagram} onChange={(e) => setDraft((d) => ({ ...d, instagram: e.target.value }))} placeholder="https://instagram.com/tu_estudio" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Facebook</span>
            <input value={draft.facebook} onChange={(e) => setDraft((d) => ({ ...d, facebook: e.target.value }))} placeholder="https://facebook.com/tu_estudio" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">TikTok</span>
            <input value={draft.tiktok} onChange={(e) => setDraft((d) => ({ ...d, tiktok: e.target.value }))} placeholder="https://tiktok.com/@tu_estudio" className={inputClass} />
          </label>
          <Button variant="dark" size="sm" className="self-start" onClick={handleSave} loading={saving}>
            Guardar cambios
          </Button>
        </div>
      ) : (
        <div className="mt-5 flex flex-col divide-y divide-border">
          {[
            ['Nombre del estudio', current.name],
            ['Ciudad', current.city],
            ['WhatsApp', current.whatsapp],
            ['Sobre ti', current.bio],
            ['Instagram', current.instagram],
            ['Facebook', current.facebook],
            ['TikTok', current.tiktok],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-wrap items-baseline justify-between gap-2 py-3 first:pt-0 last:pb-0">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
              <span className="max-w-[70%] truncate text-sm">{value || '—'}</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

export function StudioSettings() {
  const { user, profile, updateProfileLocal, signOut, signOutEverywhere, updatePassword } = useAuth()
  const { data: details } = usePhotographerDetails(user?.id)
  const push = useToastStore((s) => s.push)
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabId>('perfil')

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [editingPassword, setEditingPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const [signingOut, setSigningOut] = useState(false)
  const [signingOutEverywhere, setSigningOutEverywhere] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  function invalidateDetails() {
    if (!user) return
    queryClient.invalidateQueries({ queryKey: ['photographer_details', user.id] })
    queryClient.invalidateQueries({ queryKey: ['public-photographer', user.id] })
  }

  async function savePublicInfo(next: PublicInfoDraft) {
    if (!user) return
    const { error: nameError } = await supabase.from('profiles').update({ display_name: next.name }).eq('id', user.id)
    const { error: detailsError } = await supabase
      .from('photographer_details')
      .update({
        city: next.city || null,
        whatsapp: next.whatsapp || null,
        bio: next.bio || null,
        instagram_url: next.instagram || null,
        facebook_url: next.facebook || null,
        tiktok_url: next.tiktok || null,
      })
      .eq('profile_id', user.id)
    if (nameError || detailsError) {
      push({ type: 'error', title: 'No se pudo guardar', description: (nameError ?? detailsError)?.message })
      throw nameError ?? detailsError
    }
    updateProfileLocal({ display_name: next.name })
    invalidateDetails()
    push({ type: 'success', title: 'Guardado' })
  }

  async function saveDetailsField(field: string, value: string) {
    if (!user) return
    const { error } = await supabase.from('photographer_details').update({ [field]: value || null }).eq('profile_id', user.id)
    if (error) {
      push({ type: 'error', title: 'No se pudo guardar', description: error.message })
      throw error
    }
    invalidateDetails()
    push({ type: 'success', title: 'Guardado' })
  }

  async function handleAvatarFile(file: File | undefined) {
    if (!file || !user) return
    if (!file.type.startsWith('image/')) {
      push({ type: 'error', title: 'La foto de perfil debe ser una imagen' })
      return
    }
    setUploadingAvatar(true)
    try {
      const { data: signed, error: signError } = await supabase.functions.invoke('r2-avatar-upload-url', {
        body: { fileName: file.name, contentType: file.type },
      })
      if (signError || !signed?.uploadUrl) throw new Error(signError?.message ?? 'No se pudo obtener la URL de subida')
      const putRes = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!putRes.ok) throw new Error(`R2 respondió ${putRes.status}`)
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: signed.avatarPath }).eq('id', user.id)
      if (updateError) throw updateError
      updateProfileLocal({ avatar_url: signed.avatarPath })
      queryClient.invalidateQueries({ queryKey: ['public-photographer', user.id] })
      push({ type: 'success', title: 'Foto de perfil actualizada' })
    } catch (err) {
      push({ type: 'error', title: 'No se pudo actualizar la foto', description: (err as Error).message })
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleCoverFile(file: File | undefined) {
    if (!file || !user) return
    if (!file.type.startsWith('image/')) {
      push({ type: 'error', title: 'La portada debe ser una imagen' })
      return
    }
    setUploadingCover(true)
    try {
      const { data: signed, error: signError } = await supabase.functions.invoke('r2-profile-cover-upload-url', {
        body: { fileName: file.name, contentType: file.type },
      })
      if (signError || !signed?.uploadUrl) throw new Error(signError?.message ?? 'No se pudo obtener la URL de subida')
      const putRes = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!putRes.ok) throw new Error(`R2 respondió ${putRes.status}`)
      const { error: updateError } = await supabase.from('photographer_details').update({ profile_cover_path: signed.coverPath }).eq('profile_id', user.id)
      if (updateError) throw updateError
      invalidateDetails()
      push({ type: 'success', title: 'Portada actualizada' })
    } catch (err) {
      push({ type: 'error', title: 'No se pudo actualizar la portada', description: (err as Error).message })
    } finally {
      setUploadingCover(false)
    }
  }

  async function removeCover() {
    if (!user) return
    const { error } = await supabase.from('photographer_details').update({ profile_cover_path: null }).eq('profile_id', user.id)
    if (error) {
      push({ type: 'error', title: 'No se pudo quitar la portada', description: error.message })
      return
    }
    invalidateDetails()
    push({ type: 'success', title: 'Portada removida' })
  }

  async function handleLogoFile(file: File | undefined) {
    if (!file || !user) return
    if (!file.type.startsWith('image/')) {
      push({ type: 'error', title: 'El logo debe ser una imagen' })
      return
    }
    setUploadingLogo(true)
    try {
      const { data: signed, error: signError } = await supabase.functions.invoke('r2-profile-logo-upload-url', {
        body: { fileName: file.name, contentType: file.type },
      })
      if (signError || !signed?.uploadUrl) throw new Error(signError?.message ?? 'No se pudo obtener la URL de subida')
      const putRes = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!putRes.ok) throw new Error(`R2 respondió ${putRes.status}`)
      const { error: updateError } = await supabase.from('photographer_details').update({ logo_path: signed.logoPath }).eq('profile_id', user.id)
      if (updateError) throw updateError
      invalidateDetails()
      push({ type: 'success', title: 'Logo actualizado' })
    } catch (err) {
      push({ type: 'error', title: 'No se pudo actualizar el logo', description: (err as Error).message })
    } finally {
      setUploadingLogo(false)
    }
  }

  async function removeLogo() {
    if (!user) return
    const { error } = await supabase.from('photographer_details').update({ logo_path: null }).eq('profile_id', user.id)
    if (error) {
      push({ type: 'error', title: 'No se pudo quitar el logo', description: error.message })
      return
    }
    invalidateDetails()
    push({ type: 'success', title: 'Logo removido' })
  }

  async function saveEmail(nextEmail: string) {
    const { error } = await supabase.auth.updateUser({ email: nextEmail })
    if (error) {
      push({ type: 'error', title: 'No se pudo actualizar el correo', description: error.message })
      throw error
    }
    push({ type: 'success', title: 'Revisa tu bandeja de entrada', description: 'Te enviamos un enlace para confirmar el nuevo correo.' })
  }

  async function savePassword() {
    if (newPassword.length < 6) {
      push({ type: 'error', title: 'La contraseña debe tener al menos 6 caracteres' })
      return
    }
    setSavingPassword(true)
    const { error } = await updatePassword(newPassword)
    setSavingPassword(false)
    if (error) {
      push({ type: 'error', title: 'No se pudo cambiar la contraseña', description: error })
      return
    }
    push({ type: 'success', title: 'Contraseña actualizada' })
    setNewPassword('')
    setEditingPassword(false)
  }

  async function toggleNotification(type: NotificationType, enabled: boolean) {
    if (!user || !profile) return
    const previous = profile.notification_prefs
    const next = { ...previous, [type]: enabled }
    // Actualiza el estado local al instante (sin pasar por profileLoading) y
    // guarda en el backend en segundo plano — refreshProfile() aquí causaba
    // que el guard de ruta desmontara la página completa por un instante,
    // sintiéndose como una recarga que además perdía la pestaña activa.
    updateProfileLocal({ notification_prefs: next })
    const { error } = await supabase.from('profiles').update({ notification_prefs: next }).eq('id', user.id)
    if (error) {
      updateProfileLocal({ notification_prefs: previous })
      push({ type: 'error', title: 'No se pudo guardar', description: error.message })
    }
  }

  async function handleSignOutClick() {
    const ok = await confirmDialog.ask({ title: '¿Cerrar sesión?', confirmLabel: 'Cerrar sesión' })
    if (!ok) return
    setSigningOut(true)
    try {
      await signOut()
      navigate('/studio/login')
    } finally {
      setSigningOut(false)
    }
  }

  async function handleSignOutEverywhere() {
    const ok = await confirmDialog.ask({
      title: '¿Cerrar sesión en todos los dispositivos?',
      description: 'Cualquier otro navegador o teléfono donde hayas iniciado sesión quedará desconectado.',
      confirmLabel: 'Cerrar sesión en todos lados',
    })
    if (!ok) return
    setSigningOutEverywhere(true)
    try {
      await signOutEverywhere()
      navigate('/studio/login')
    } finally {
      setSigningOutEverywhere(false)
    }
  }

  async function handleDeleteAccount() {
    const ok = await confirmDialog.ask({
      title: '¿Eliminar tu cuenta de fotógrafo?',
      description: 'Esto borra tus eventos, fotos y pedidos por completo. No se puede deshacer.',
      confirmLabel: 'Continuar',
      tone: 'danger',
    })
    if (!ok) return
    const { confirmed } = await typedConfirmDialog.ask({
      title: 'Última confirmación',
      description: 'Los bikers que ya compraron fotos tuyas conservan su entrega descargada, pero perderán acceso a re-descargarla.',
      matchText: user?.email ?? '',
      matchLabel: 'Escribe tu correo para confirmar',
      confirmLabel: 'Eliminar mi cuenta',
    })
    if (!confirmed) return
    setDeletingAccount(true)
    try {
      const { error } = await supabase.functions.invoke('delete-account', { body: {} })
      if (error) throw new Error(error.message)
      navigate('/')
    } catch (err) {
      push({ type: 'error', title: 'No se pudo eliminar la cuenta', description: (err as Error).message })
    } finally {
      setDeletingAccount(false)
    }
  }

  const avatarUrl = profile?.avatar_url ? (profile.avatar_url.startsWith('http') ? profile.avatar_url : r2Url(profile.avatar_url)) : null

  const publicInfo: PublicInfoDraft = {
    name: profile?.display_name ?? '',
    city: details?.city ?? '',
    whatsapp: details?.whatsapp ?? '',
    bio: details?.bio ?? '',
    instagram: details?.instagram_url ?? '',
    facebook: details?.facebook_url ?? '',
    tiktok: details?.tiktok_url ?? '',
  }

  return (
    <div className={STUDIO_PAGE_WIDE}>
      <h1 className="font-studio text-3xl font-bold tracking-tight2 md:text-4xl">Configuración</h1>
      <p className="mt-2 text-muted-foreground">Tu perfil visual, tu cuenta y tus notificaciones.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[180px_1fr]">
        {/* Móvil: pestañas horizontales subrayadas (mismo patrón que el
            propio mobbin.com/settings en su versión angosta). Escritorio:
            lista vertical a la izquierda, la activa marcada con un borde. */}
        <nav className="-mb-px flex gap-5 overflow-x-auto border-b border-border lg:mb-0 lg:flex-col lg:gap-1 lg:border-b-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors lg:border-b-0 lg:border-l-2 lg:px-3 lg:py-2 lg:pb-2 lg:text-left',
                tab === t.id
                  ? 'border-foreground font-bold text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <t.icon className="h-4 w-4 shrink-0" />
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex flex-col gap-6">
          {tab === 'perfil' && (
            <>
              <Section title="Foto de perfil, portada y logo">
                <div className="flex flex-wrap gap-8">
                  <div className="flex items-center gap-4">
                    <button onClick={() => avatarInputRef.current?.click()} className="relative h-16 w-16 shrink-0 rounded-full" disabled={uploadingAvatar}>
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full border-2 border-border object-cover" />
                      ) : (
                        <InitialsAvatar name={profile?.display_name || 'S'} className="h-16 w-16 rounded-full border-2 border-border bg-foreground text-lg text-background" />
                      )}
                    </button>
                    <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatarFile(e.target.files?.[0])} />
                    <div>
                      <p className="text-sm font-semibold">Foto de perfil</p>
                      <button onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} className="text-xs font-semibold text-foreground hover:underline">
                        {uploadingAvatar ? 'Subiendo…' : 'Cambiar'}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <button onClick={() => coverInputRef.current?.click()} className="relative h-16 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-border bg-muted" disabled={uploadingCover}>
                      {details?.profile_cover_path ? (
                        <img src={r2Url(details.profile_cover_path)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-lg opacity-30">📷</span>
                      )}
                    </button>
                    <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverFile(e.target.files?.[0])} />
                    <div>
                      <p className="text-sm font-semibold">Foto de portada</p>
                      <div className="flex gap-2">
                        <button onClick={() => coverInputRef.current?.click()} disabled={uploadingCover} className="text-xs font-semibold text-foreground hover:underline">
                          {uploadingCover ? 'Subiendo…' : 'Cambiar'}
                        </button>
                        {details?.profile_cover_path && (
                          <button onClick={removeCover} className="text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline">
                            Quitar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <button onClick={() => logoInputRef.current?.click()} className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-border bg-muted" disabled={uploadingLogo}>
                      {details?.logo_path ? (
                        <img src={r2Url(details.logo_path)} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <span className="text-lg opacity-30">🖼️</span>
                      )}
                    </button>
                    <input ref={logoInputRef} type="file" accept="image/png,image/*" className="hidden" onChange={(e) => handleLogoFile(e.target.files?.[0])} />
                    <div>
                      <p className="text-sm font-semibold">Logo (opcional)</p>
                      <div className="flex gap-2">
                        <button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo} className="text-xs font-semibold text-foreground hover:underline">
                          {uploadingLogo ? 'Subiendo…' : 'Cambiar'}
                        </button>
                        {details?.logo_path && (
                          <button onClick={removeLogo} className="text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline">
                            Quitar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Section>

              <PublicInfoSection draft={publicInfo} onSave={savePublicInfo} />
            </>
          )}

          {tab === 'cuenta' && (
            <>
              <Section title="Nickname para pedidos" description="Aparece como sufijo del código de tus pedidos (ej. #000938-Mendz) en vez de tu nombre de estudio completo.">
                <EditableRow label="Nickname" value={details?.order_nickname ?? ''} onSave={(v) => saveDetailsField('order_nickname', v)} placeholder={profile?.display_name ?? 'Ej. Mendz'} />
              </Section>

              <Section title="Datos personales">
                <EditableRow label="Correo" value={user?.email ?? ''} type="email" onSave={saveEmail} description="Te enviaremos un enlace de confirmación al nuevo correo." />

                <div className="border-b border-border py-4 last:border-b-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Contraseña</p>
                    <button onClick={() => setEditingPassword((e) => !e)} className="shrink-0 text-xs font-semibold text-foreground hover:underline">
                      {editingPassword ? 'Cancelar' : 'Cambiar'}
                    </button>
                  </div>
                  {editingPassword ? (
                    <div className="mt-3">
                      <input
                        autoFocus
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nueva contraseña"
                        className={inputClass}
                      />
                      <Button variant="dark" size="sm" className="mt-3" onClick={savePassword} loading={savingPassword}>
                        Guardar
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">••••••••</p>
                  )}
                </div>
              </Section>

              <Section title="Administrar cuenta">
                <div className="flex flex-col gap-3 border-b border-border py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Cerrar sesión</p>
                    <p className="text-sm text-muted-foreground">Sales de este dispositivo.</p>
                  </div>
                  <Button variant="secondary" size="sm" className="w-full sm:w-auto" onClick={handleSignOutClick} loading={signingOut}>
                    Cerrar sesión
                  </Button>
                </div>
                <div className="flex flex-col gap-3 border-b border-border py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Cerrar sesión en todos los dispositivos</p>
                    <p className="text-sm text-muted-foreground">Te desconecta de cualquier otro navegador o teléfono donde hayas iniciado sesión.</p>
                  </div>
                  <Button variant="secondary" size="sm" className="w-full sm:w-auto" onClick={handleSignOutEverywhere} loading={signingOutEverywhere}>
                    Cerrar en todos lados
                  </Button>
                </div>
                <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Eliminar cuenta</p>
                    <p className="text-sm text-muted-foreground">Borra tu cuenta, eventos y fotos de forma permanente.</p>
                  </div>
                  <Button variant="danger" size="sm" className="w-full sm:w-auto" onClick={handleDeleteAccount} loading={deletingAccount}>
                    Eliminar cuenta
                  </Button>
                </div>
              </Section>
            </>
          )}

          {tab === 'notificaciones' && (
            <Section title="Notificaciones" description="Elige qué te queremos avisar — siempre puedes reactivarlas.">
              <div className="flex flex-col gap-4">
                {NOTIFICATION_TOGGLES.map((n) => (
                  <div key={n.type} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{n.label}</p>
                      <p className="text-xs text-muted-foreground">{n.description}</p>
                    </div>
                    <NotificationToggle
                      enabled={profile?.notification_prefs?.[n.type] !== false}
                      onChange={(next) => toggleNotification(n.type, next)}
                    />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {tab === 'equipo' && (
            <Section title="Equipo" description="Próximamente.">
              <p className="text-sm text-muted-foreground">
                La idea: invitar cuentas secundarias para que colaboradores puedan subir fotos desde distintos puntos de
                cobertura, sin compartir tu contraseña principal. Todavía no está disponible.
              </p>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}
