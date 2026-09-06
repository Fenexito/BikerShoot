import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { usePhotographerDetails } from './usePhotographerDetails'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { Button } from '../../ui/studio/Button'
import { Input } from '../../ui/studio/Input'
import { STUDIO_PAGE_WIDE } from '../../ui/studio/layout'
import { useToastStore } from '../../ui/overlays/toastStore'
import { typedConfirmDialog } from '../../ui/overlays/typedConfirmStore'
import type { NotificationType } from '../notifications/useNotifications'

const NOTIFICATION_TOGGLES: { type: NotificationType; label: string; description: string }[] = [
  { type: 'pedido_nuevo', label: 'Pedido nuevo', description: 'Cuando un biker compra fotos tuyas.' },
  { type: 'pedido_cancelado', label: 'Pedido cancelado', description: 'Cuando cancelas un pedido (te confirma que se envió).' },
  { type: 'fotografo_aprobado', label: 'Cuenta aprobada', description: 'Cuando un administrador aprueba tu cuenta.' },
]

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Row({ label, value, action }: { label: string; value: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4 last:border-b-0">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-sm text-muted-foreground">{value}</p>
      </div>
      {action}
    </div>
  )
}

export function StudioSettings() {
  const { user, profile, signOutEverywhere, updatePassword, refreshProfile } = useAuth()
  const { data: details } = usePhotographerDetails(user?.id)
  const push = useToastStore((s) => s.push)
  const navigate = useNavigate()

  const [nickname, setNickname] = useState('')
  const [savingNickname, setSavingNickname] = useState(false)

  const [email, setEmail] = useState('')
  const [editingEmail, setEditingEmail] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [editingPassword, setEditingPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const [signingOutEverywhere, setSigningOutEverywhere] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  useEffect(() => {
    setNickname(details?.order_nickname ?? '')
  }, [details?.order_nickname])

  useEffect(() => {
    setEmail(user?.email ?? '')
  }, [user?.email])

  async function saveNickname() {
    if (!user) return
    setSavingNickname(true)
    const { error } = await supabase.from('photographer_details').update({ order_nickname: nickname || null }).eq('profile_id', user.id)
    setSavingNickname(false)
    if (error) {
      push({ type: 'error', title: 'No se pudo guardar', description: error.message })
      return
    }
    queryClient.invalidateQueries({ queryKey: ['photographer_details', user.id] })
    push({ type: 'success', title: 'Nickname actualizado' })
  }

  async function saveEmail() {
    setSavingEmail(true)
    const { error } = await supabase.auth.updateUser({ email })
    setSavingEmail(false)
    if (error) {
      push({ type: 'error', title: 'No se pudo actualizar el correo', description: error.message })
      return
    }
    push({ type: 'success', title: 'Revisa tu bandeja de entrada', description: 'Te enviamos un enlace para confirmar el nuevo correo.' })
    setEditingEmail(false)
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

  async function handleSignOutEverywhere() {
    setSigningOutEverywhere(true)
    try {
      await signOutEverywhere()
      navigate('/studio/login')
    } finally {
      setSigningOutEverywhere(false)
    }
  }

  async function handleDeleteAccount() {
    const { confirmed } = await typedConfirmDialog.ask({
      title: 'Esto elimina tu cuenta de fotógrafo por completo — eventos, fotos y pedidos incluidos. No se puede deshacer.',
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

  return (
    <div className={STUDIO_PAGE_WIDE}>
      <h1 className="font-studio text-3xl font-bold tracking-tight2 md:text-4xl">Configuración</h1>
      <p className="mt-2 text-muted-foreground">
        La edición visual de tu perfil (foto, portada, logo, bio) vive en tu{' '}
        <a href="/studio/perfil" className="font-semibold text-foreground underline">página de perfil</a>. Aquí van los datos de cuenta.
      </p>

      <div className="mt-8 flex flex-col gap-6">
        <Section title="Nickname para pedidos" description="Aparece como sufijo del código de tus pedidos (ej. #000938-Mendz) en vez de tu nombre de estudio completo.">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full max-w-xs">
              <Input label="Nickname" placeholder={profile?.display_name ?? 'Ej. Mendz'} value={nickname} onChange={(e) => setNickname(e.target.value)} />
            </div>
            <Button variant="secondary" size="sm" onClick={saveNickname} loading={savingNickname}>Guardar</Button>
          </div>
        </Section>

        <Section title="Datos personales">
          <Row
            label="Correo"
            value={email}
            action={
              !editingEmail && (
                <Button variant="ghost" size="sm" onClick={() => setEditingEmail(true)}>Editar</Button>
              )
            }
          />
          {editingEmail && (
            <div className="flex flex-wrap items-end gap-3 pb-4">
              <div className="w-full max-w-xs">
                <Input label="Nuevo correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button variant="secondary" size="sm" onClick={saveEmail} loading={savingEmail}>Guardar</Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditingEmail(false); setEmail(user?.email ?? '') }}>Cancelar</Button>
            </div>
          )}

          <Row
            label="Contraseña"
            value="••••••••"
            action={
              !editingPassword && (
                <Button variant="ghost" size="sm" onClick={() => setEditingPassword(true)}>Cambiar</Button>
              )
            }
          />
          {editingPassword && (
            <div className="flex flex-wrap items-end gap-3 pb-4">
              <div className="w-full max-w-xs">
                <Input label="Nueva contraseña" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <Button variant="secondary" size="sm" onClick={savePassword} loading={savingPassword}>Guardar</Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditingPassword(false); setNewPassword('') }}>Cancelar</Button>
            </div>
          )}
        </Section>

        <Section title="Notificaciones" description="Elige qué te queremos avisar — siempre puedes reactivarlas.">
          <div className="flex flex-col gap-4">
            {NOTIFICATION_TOGGLES.map((n) => {
              const enabled = profile?.notification_prefs?.[n.type] !== false
              return (
                <div key={n.type} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{n.label}</p>
                    <p className="text-xs text-muted-foreground">{n.description}</p>
                  </div>
                  <button
                    onClick={() => toggleNotification(n.type, !enabled)}
                    role="switch"
                    aria-checked={enabled}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? 'bg-accent' : 'bg-muted'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              )
            })}
          </div>
        </Section>

        <Section title="Administrar cuenta">
          <Row
            label="Cerrar sesión en todos los dispositivos"
            value="Te desconecta de cualquier otro navegador o teléfono donde hayas iniciado sesión."
            action={
              <Button variant="secondary" size="sm" onClick={handleSignOutEverywhere} loading={signingOutEverywhere}>
                Cerrar sesión
              </Button>
            }
          />
          <Row
            label="Eliminar cuenta"
            value="Borra tu cuenta, eventos y fotos de forma permanente."
            action={
              <Button variant="danger" size="sm" onClick={handleDeleteAccount} loading={deletingAccount}>
                Eliminar cuenta
              </Button>
            }
          />
        </Section>
      </div>
    </div>
  )
}
