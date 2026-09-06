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
import type { NotificationType } from '../notifications/useNotifications'

const NOTIFICATION_TOGGLES: { type: NotificationType; label: string; description: string }[] = [
  { type: 'pedido_nuevo', label: 'Pedido nuevo', description: 'Cuando un biker compra fotos tuyas.' },
  { type: 'pedido_cancelado', label: 'Pedido cancelado', description: 'Cuando cancelas un pedido (te confirma que se envió).' },
  { type: 'fotografo_aprobado', label: 'Cuenta aprobada', description: 'Cuando un administrador aprueba tu cuenta.' },
]

const TABS = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'cuenta', label: 'Cuenta' },
  { id: 'notificaciones', label: 'Notificaciones' },
  { id: 'equipo', label: 'Equipo' },
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

/** Fila "click para editar" — el valor se convierte en un campo editable con
 * un color propio (acento) en el mismo lugar, y el botón Editar se
 * sustituye por Guardar/Cancelar ahí mismo, en vez de abrir un formulario
 * aparte. Deja claro cuándo algo está en modo edición vs. ya guardado. */
function EditableRow({
  label,
  value,
  placeholder,
  onSave,
  type = 'text',
  multiline = false,
}: {
  label: string
  value: string
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

  const fieldClass = 'mt-2 w-full max-w-sm rounded-2xl border-2 border-accent bg-accent/5 px-4 py-2.5 text-sm outline-none'

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        {editing ? (
          multiline ? (
            <textarea autoFocus rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} className={fieldClass} />
          ) : (
            <input autoFocus type={type} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} className={fieldClass} />
          )
        ) : (
          <p className="text-sm text-muted-foreground">{value || placeholder || '—'}</p>
        )}
      </div>
      <div className="shrink-0">
        {editing ? (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button variant="dark" size="sm" onClick={handleSave} loading={saving}>Guardar</Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Editar</Button>
        )}
      </div>
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
      <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  )
}

export function StudioSettings() {
  const { user, profile, refreshProfile, signOut, signOutEverywhere, updatePassword } = useAuth()
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

  async function saveProfileField(field: 'display_name', value: string) {
    if (!user) return
    const { error } = await supabase.from('profiles').update({ [field]: value }).eq('id', user.id)
    if (error) {
      push({ type: 'error', title: 'No se pudo guardar', description: error.message })
      throw error
    }
    await refreshProfile()
    push({ type: 'success', title: 'Guardado' })
  }

  async function saveDetailsField(field: string, value: string) {
    if (!user) return
    const { error } = await supabase.from('photographer_details').update({ [field]: value || null }).eq('profile_id', user.id)
    if (error) {
      push({ type: 'error', title: 'No se pudo guardar', description: error.message })
      throw error
    }
    queryClient.invalidateQueries({ queryKey: ['photographer_details', user.id] })
    queryClient.invalidateQueries({ queryKey: ['public-photographer', user.id] })
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
      await refreshProfile()
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
      queryClient.invalidateQueries({ queryKey: ['photographer_details', user.id] })
      queryClient.invalidateQueries({ queryKey: ['public-photographer', user.id] })
      push({ type: 'success', title: 'Portada actualizada' })
    } catch (err) {
      push({ type: 'error', title: 'No se pudo actualizar la portada', description: (err as Error).message })
    } finally {
      setUploadingCover(false)
    }
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
      queryClient.invalidateQueries({ queryKey: ['photographer_details', user.id] })
      queryClient.invalidateQueries({ queryKey: ['public-photographer', user.id] })
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
    queryClient.invalidateQueries({ queryKey: ['photographer_details', user.id] })
    queryClient.invalidateQueries({ queryKey: ['public-photographer', user.id] })
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
    const next = { ...profile.notification_prefs, [type]: enabled }
    const { error } = await supabase.from('profiles').update({ notification_prefs: next }).eq('id', user.id)
    if (error) {
      push({ type: 'error', title: 'No se pudo guardar', description: error.message })
      return
    }
    await refreshProfile()
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
      matchLabel: `Escribe tu correo (${user?.email}) para confirmar`,
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

  return (
    <div className={STUDIO_PAGE_WIDE}>
      <h1 className="font-studio text-3xl font-bold tracking-tight2 md:text-4xl">Configuración</h1>
      <p className="mt-2 text-muted-foreground">Tu perfil visual, tu cuenta y tus notificaciones.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[200px_1fr]">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'shrink-0 rounded-full px-4 py-2.5 text-left text-sm font-medium transition-colors lg:rounded-2xl',
                tab === t.id ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-border hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex flex-col gap-6">
          {tab === 'perfil' && (
            <>
              <Section title="Foto de perfil y portada">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-4">
                    <button onClick={() => avatarInputRef.current?.click()} className="group relative h-20 w-20 shrink-0 rounded-full" disabled={uploadingAvatar}>
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="h-20 w-20 rounded-full border-2 border-border object-cover" />
                      ) : (
                        <InitialsAvatar name={profile?.display_name || 'S'} className="h-20 w-20 rounded-full border-2 border-border bg-foreground text-xl text-background" />
                      )}
                      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-[9px] font-semibold uppercase tracking-wide text-white opacity-0 transition-opacity group-hover:opacity-100">
                        {uploadingAvatar ? '…' : 'Cambiar'}
                      </span>
                    </button>
                    <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatarFile(e.target.files?.[0])} />
                    <div>
                      <p className="text-sm font-semibold">Foto de perfil</p>
                      <button onClick={() => avatarInputRef.current?.click()} className="text-xs font-semibold text-accent hover:underline">Cambiar</button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => coverInputRef.current?.click()}
                      className="relative h-14 w-24 shrink-0 overflow-hidden rounded-xl border-2 border-border bg-muted"
                      disabled={uploadingCover}
                    >
                      {details?.profile_cover_path ? (
                        <img src={r2Url(details.profile_cover_path)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-lg opacity-30">📷</span>
                      )}
                    </button>
                    <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverFile(e.target.files?.[0])} />
                    <div>
                      <p className="text-sm font-semibold">Foto de portada</p>
                      <button onClick={() => coverInputRef.current?.click()} className="text-xs font-semibold text-accent hover:underline" disabled={uploadingCover}>
                        {uploadingCover ? 'Subiendo…' : 'Cambiar'}
                      </button>
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Logo PNG (opcional)" description="Aparece en vez de tu nombre sobre la animación de portada de tu perfil.">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-border bg-muted">
                    {details?.logo_path ? (
                      <img src={r2Url(details.logo_path)} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-lg opacity-30">🖼️</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => logoInputRef.current?.click()} loading={uploadingLogo}>
                      {details?.logo_path ? 'Cambiar' : 'Subir logo'}
                    </Button>
                    {details?.logo_path && <Button variant="ghost" size="sm" onClick={removeLogo}>Quitar</Button>}
                  </div>
                  <input ref={logoInputRef} type="file" accept="image/png,image/*" className="hidden" onChange={(e) => handleLogoFile(e.target.files?.[0])} />
                </div>
              </Section>

              <Section title="Información pública" description="Esto es lo que ve un biker en tu perfil.">
                <EditableRow label="Nombre del estudio" value={profile?.display_name ?? ''} onSave={(v) => saveProfileField('display_name', v)} />
                <EditableRow label="Ciudad" value={details?.city ?? ''} onSave={(v) => saveDetailsField('city', v)} />
                <EditableRow label="WhatsApp de contacto" value={details?.whatsapp ?? ''} onSave={(v) => saveDetailsField('whatsapp', v)} />
                <EditableRow label="Sobre ti" value={details?.bio ?? ''} onSave={(v) => saveDetailsField('bio', v)} multiline placeholder="Cuéntale a los bikers de tu trabajo" />
                <EditableRow label="Instagram" value={details?.instagram_url ?? ''} onSave={(v) => saveDetailsField('instagram_url', v)} placeholder="https://instagram.com/tu_estudio" />
                <EditableRow label="Facebook" value={details?.facebook_url ?? ''} onSave={(v) => saveDetailsField('facebook_url', v)} placeholder="https://facebook.com/tu_estudio" />
                <EditableRow label="TikTok" value={details?.tiktok_url ?? ''} onSave={(v) => saveDetailsField('tiktok_url', v)} placeholder="https://tiktok.com/@tu_estudio" />
              </Section>
            </>
          )}

          {tab === 'cuenta' && (
            <>
              <Section title="Nickname para pedidos" description="Aparece como sufijo del código de tus pedidos (ej. #000938-Mendz) en vez de tu nombre de estudio completo.">
                <EditableRow label="Nickname" value={details?.order_nickname ?? ''} onSave={(v) => saveDetailsField('order_nickname', v)} placeholder={profile?.display_name ?? 'Ej. Mendz'} />
              </Section>

              <Section title="Datos personales">
                <EditableRow label="Correo" value={user?.email ?? ''} type="email" onSave={saveEmail} />

                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border py-4 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Contraseña</p>
                    {editingPassword ? (
                      <input
                        autoFocus
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nueva contraseña"
                        className="mt-2 w-full max-w-sm rounded-2xl border-2 border-accent bg-accent/5 px-4 py-2.5 text-sm outline-none"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">••••••••</p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {editingPassword ? (
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => { setEditingPassword(false); setNewPassword('') }}>Cancelar</Button>
                        <Button variant="dark" size="sm" onClick={savePassword} loading={savingPassword}>Guardar</Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setEditingPassword(true)}>Cambiar</Button>
                    )}
                  </div>
                </div>
              </Section>

              <Section title="Administrar cuenta">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4">
                  <div>
                    <p className="text-sm font-semibold">Cerrar sesión</p>
                    <p className="text-sm text-muted-foreground">Sales de este dispositivo.</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={handleSignOutClick} loading={signingOut}>Cerrar sesión</Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4">
                  <div>
                    <p className="text-sm font-semibold">Cerrar sesión en todos los dispositivos</p>
                    <p className="text-sm text-muted-foreground">Te desconecta de cualquier otro navegador o teléfono donde hayas iniciado sesión.</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={handleSignOutEverywhere} loading={signingOutEverywhere}>Cerrar en todos lados</Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
                  <div>
                    <p className="text-sm font-semibold">Eliminar cuenta</p>
                    <p className="text-sm text-muted-foreground">Borra tu cuenta, eventos y fotos de forma permanente.</p>
                  </div>
                  <Button variant="danger" size="sm" onClick={handleDeleteAccount} loading={deletingAccount}>Eliminar cuenta</Button>
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
