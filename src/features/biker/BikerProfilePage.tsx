import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useBikerDetails } from './useBikerDetails'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { r2Url } from '../../lib/r2'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { IconUser, IconSettings, IconBell } from '../../ui/shared/icons'
import { useToastStore } from '../../ui/overlays/toastStore'
import { confirmDialog } from '../../ui/overlays/confirmStore'
import { typedConfirmDialog } from '../../ui/overlays/typedConfirmStore'
import { Skeleton } from '../../ui/shared/Skeleton'
import { SettingsSection, SettingsEditableRow, SettingsNotificationToggle, settingsInputClass } from '../../ui/shared/SettingsPrimitives'
import { cn } from '../../lib/cn'
import type { NotificationType } from '../notifications/useNotifications'

const NOTIFICATION_TOGGLES: { type: NotificationType; label: string; description: string }[] = [
  { type: 'pedido_entregado', label: 'Foto lista', description: 'Cuando el fotógrafo entrega tu foto comprada.' },
  { type: 'pedido_cancelado', label: 'Pedido cancelado', description: 'Si un fotógrafo cancela un pedido tuyo.' },
]

const TABS = [
  { id: 'perfil', label: 'Perfil', icon: IconUser },
  { id: 'cuenta', label: 'Cuenta', icon: IconSettings },
  { id: 'notificaciones', label: 'Notificaciones', icon: IconBell },
] as const
type TabId = (typeof TABS)[number]['id']

/** Misma configuración visual y de funciones que `StudioSettings.tsx`
 * (pestañas a la derecha, filas "Editar" que se expanden, mismo patrón de
 * subida de foto de perfil) — antes esta página era un único formulario
 * plano sin ninguna de estas funciones (sin foto de perfil, sin cambiar
 * correo/contraseña, sin cerrar sesión en todos lados, sin eliminar
 * cuenta). Los campos en sí son distintos (biker no tiene portada, logo ni
 * equipo), pero la estructura y el nivel de funciones ahora es equivalente. */
export function BikerProfilePage() {
  const { user, profile, updateProfileLocal, refreshProfile, signOut, signOutEverywhere, updatePassword } = useAuth()
  const { data: details, isLoading } = useBikerDetails(user?.id)
  const push = useToastStore((s) => s.push)
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabId>('perfil')

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [editingPassword, setEditingPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const [signingOut, setSigningOut] = useState(false)
  const [signingOutEverywhere, setSigningOutEverywhere] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  function invalidateDetails() {
    if (!user) return
    queryClient.invalidateQueries({ queryKey: ['biker_details', user.id] })
  }

  async function saveProfileField(field: 'display_name' | 'phone', value: string) {
    if (!user) return
    const { error } = await supabase.from('profiles').update({ [field]: value || null }).eq('id', user.id)
    if (error) {
      push({ type: 'error', title: 'No se pudo guardar', description: error.message })
      throw error
    }
    await refreshProfile()
    push({ type: 'success', title: 'Guardado' })
  }

  async function saveDetailsField(field: 'city' | 'moto_brand' | 'moto_model', value: string) {
    if (!user) return
    const { error } = await supabase.from('biker_details').update({ [field]: value || null }).eq('profile_id', user.id)
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
      push({ type: 'success', title: 'Foto de perfil actualizada' })
    } catch (err) {
      push({ type: 'error', title: 'No se pudo actualizar la foto', description: (err as Error).message })
    } finally {
      setUploadingAvatar(false)
    }
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
      navigate('/')
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
      navigate('/')
    } finally {
      setSigningOutEverywhere(false)
    }
  }

  async function handleDeleteAccount() {
    const ok = await confirmDialog.ask({
      title: '¿Eliminar tu cuenta?',
      description: 'Esto borra tu perfil y tu historial de pedidos. No se puede deshacer.',
      confirmLabel: 'Continuar',
      tone: 'danger',
    })
    if (!ok) return
    const { confirmed } = await typedConfirmDialog.ask({
      title: 'Última confirmación',
      description: 'Las fotos que ya compraste y descargaste se quedan en tu dispositivo, pero perderás acceso a re-descargarlas.',
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

  if (isLoading || !profile) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 font-flat md:px-8">
        <Skeleton className="h-8 w-40" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[180px_1fr]">
          <Skeleton className="h-32 w-full lg:h-64" />
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    )
  }

  const avatarUrl = profile?.avatar_url ? (profile.avatar_url.startsWith('http') ? profile.avatar_url : r2Url(profile.avatar_url)) : null

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 font-flat md:px-8">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Configuración</h1>
      <p className="mt-2 text-muted-foreground">Tu perfil, tu cuenta y tus notificaciones.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[180px_1fr]">
        {/* Móvil: pestañas horizontales subrayadas. Escritorio: lista
            vertical a la izquierda, la activa marcada con un borde — mismo
            patrón que StudioSettings. */}
        <nav className="-mb-px flex gap-5 overflow-x-auto border-b border-border lg:mb-0 lg:flex-col lg:gap-1 lg:border-b-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors lg:border-b-0 lg:border-l-2 lg:px-3 lg:py-2 lg:pb-2 lg:text-left',
                tab === t.id ? 'border-foreground font-bold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <t.icon className="h-4 w-4 shrink-0" />
              {t.label}
            </button>
          ))}
        </nav>

        <div key={tab} className="flex flex-col gap-6 animate-tab-in">
          {tab === 'perfil' && (
            <SettingsSection title="Foto de perfil">
              <div className="flex items-center gap-4">
                <button onClick={() => avatarInputRef.current?.click()} className="relative h-16 w-16 shrink-0 rounded-full" disabled={uploadingAvatar}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full border-2 border-border object-cover" />
                  ) : (
                    <InitialsAvatar name={profile?.display_name || 'B'} className="h-16 w-16 rounded-full border-2 border-border bg-primary text-lg text-white" />
                  )}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatarFile(e.target.files?.[0])} />
                <div>
                  <p className="text-sm font-semibold">{profile.display_name || 'Tu perfil'}</p>
                  <button onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} className="text-xs font-semibold text-foreground hover:underline">
                    {uploadingAvatar ? 'Subiendo…' : 'Cambiar foto'}
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-col divide-y divide-border border-t border-border">
                <SettingsEditableRow label="Nombre" value={profile.display_name ?? ''} onSave={(v) => saveProfileField('display_name', v)} />
                <SettingsEditableRow label="Teléfono" value={profile.phone ?? ''} placeholder="Opcional" onSave={(v) => saveProfileField('phone', v)} />
                <SettingsEditableRow label="Ciudad" value={details?.city ?? ''} placeholder="Opcional" onSave={(v) => saveDetailsField('city', v)} />
                <SettingsEditableRow label="Marca de moto" value={details?.moto_brand ?? ''} placeholder="Ej. Yamaha" onSave={(v) => saveDetailsField('moto_brand', v)} />
                <SettingsEditableRow label="Modelo" value={details?.moto_model ?? ''} placeholder="Ej. MT-07" onSave={(v) => saveDetailsField('moto_model', v)} />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Tu marca y modelo nos ayudan a mostrarte fotos más relevantes cuando busques.</p>
            </SettingsSection>
          )}

          {tab === 'cuenta' && (
            <>
              <SettingsSection title="Datos de acceso">
                <SettingsEditableRow label="Correo" value={user?.email ?? ''} type="email" onSave={saveEmail} description="Te enviaremos un enlace de confirmación al nuevo correo." />
                <div className="border-b border-border py-4 last:border-b-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Contraseña</p>
                    <button onClick={() => setEditingPassword((e) => !e)} className="shrink-0 text-xs font-semibold text-foreground hover:underline">
                      {editingPassword ? 'Cancelar' : 'Cambiar'}
                    </button>
                  </div>
                  {editingPassword ? (
                    <div className="mt-3 flex flex-col">
                      <input
                        autoFocus
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nueva contraseña"
                        className={settingsInputClass}
                      />
                      <button
                        onClick={savePassword}
                        disabled={savingPassword}
                        className="mt-3 flex h-10 items-center justify-center gap-2 self-start rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {savingPassword && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                        Guardar
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">••••••••</p>
                  )}
                </div>
              </SettingsSection>

              <SettingsSection title="Administrar cuenta">
                <div className="flex flex-col gap-3 border-b border-border py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Cerrar sesión</p>
                    <p className="text-sm text-muted-foreground">Sales de este dispositivo.</p>
                  </div>
                  <button
                    onClick={handleSignOutClick}
                    disabled={signingOut}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-muted px-5 text-sm font-semibold text-foreground transition-colors hover:bg-border disabled:opacity-50 sm:w-auto"
                  >
                    {signingOut ? 'Saliendo…' : 'Cerrar sesión'}
                  </button>
                </div>
                <div className="flex flex-col gap-3 border-b border-border py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Cerrar sesión en todos los dispositivos</p>
                    <p className="text-sm text-muted-foreground">Te desconecta de cualquier otro navegador o teléfono donde hayas iniciado sesión.</p>
                  </div>
                  <button
                    onClick={handleSignOutEverywhere}
                    disabled={signingOutEverywhere}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-muted px-5 text-sm font-semibold text-foreground transition-colors hover:bg-border disabled:opacity-50 sm:w-auto"
                  >
                    {signingOutEverywhere ? 'Saliendo…' : 'Cerrar en todos lados'}
                  </button>
                </div>
                <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Eliminar cuenta</p>
                    <p className="text-sm text-muted-foreground">Borra tu cuenta y tu historial de forma permanente.</p>
                  </div>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-red-600 px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto"
                  >
                    {deletingAccount ? 'Eliminando…' : 'Eliminar cuenta'}
                  </button>
                </div>
              </SettingsSection>
            </>
          )}

          {tab === 'notificaciones' && (
            <SettingsSection title="Notificaciones" description="Elige qué te queremos avisar — siempre puedes reactivarlas.">
              <div className="flex flex-col gap-4">
                {NOTIFICATION_TOGGLES.map((n) => (
                  <div key={n.type} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{n.label}</p>
                      <p className="text-xs text-muted-foreground">{n.description}</p>
                    </div>
                    <SettingsNotificationToggle enabled={profile?.notification_prefs?.[n.type] !== false} onChange={(next) => toggleNotification(n.type, next)} />
                  </div>
                ))}
              </div>
            </SettingsSection>
          )}
        </div>
      </div>
    </div>
  )
}
