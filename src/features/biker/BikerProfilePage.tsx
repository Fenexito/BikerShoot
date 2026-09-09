import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../auth/AuthContext'
import { useBikerDetails } from './useBikerDetails'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { Button } from '../../ui/flat/Button'
import { Input } from '../../ui/flat/Input'
import { Card } from '../../ui/flat/Card'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { IconBookmark, IconCart, IconMap, IconUser, IconLogOut } from '../../ui/shared/icons'
import { useToastStore } from '../../ui/overlays/toastStore'
import { Skeleton } from '../../ui/shared/Skeleton'
import type { NotificationType } from '../notifications/useNotifications'

const NOTIFICATION_TOGGLES: { type: NotificationType; label: string; description: string }[] = [
  { type: 'pedido_entregado', label: 'Foto lista', description: 'Cuando el fotógrafo entrega tu foto comprada.' },
  { type: 'pedido_cancelado', label: 'Pedido cancelado', description: 'Si un fotógrafo cancela un pedido tuyo.' },
]

const QUICK_LINKS = [
  { to: '/app/mapa', label: 'Mapa', icon: <IconMap className="h-5 w-5" /> },
  { to: '/app/fotografos', label: 'Fotógrafos', icon: <IconUser className="h-5 w-5" /> },
  { to: '/app/favoritos', label: 'Favoritos', icon: <IconBookmark className="h-5 w-5" /> },
  { to: '/app/historial', label: 'Mis compras', icon: <IconCart className="h-5 w-5" /> },
]

const schema = z.object({
  displayName: z.string().min(2, 'Ingresa tu nombre'),
  phone: z.string().optional(),
  motoBrand: z.string().optional(),
  motoModel: z.string().optional(),
  city: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export function BikerProfilePage() {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const { data: details, isLoading } = useBikerDetails(user?.id)
  const push = useToastStore((s) => s.push)
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      navigate('/')
    } finally {
      setSigningOut(false)
    }
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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (profile) {
      reset({
        displayName: profile.display_name,
        phone: profile.phone ?? '',
        motoBrand: details?.moto_brand ?? '',
        motoModel: details?.moto_model ?? '',
        city: details?.city ?? '',
      })
    }
  }, [profile, details, reset])

  const onSubmit = async (values: FormValues) => {
    if (!user) return

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ display_name: values.displayName, phone: values.phone || null })
      .eq('id', user.id)

    const { error: detailsError } = await supabase
      .from('biker_details')
      .update({
        moto_brand: values.motoBrand || null,
        moto_model: values.motoModel || null,
        city: values.city || null,
      })
      .eq('profile_id', user.id)

    if (profileError || detailsError) {
      push({ type: 'error', title: 'No se pudo guardar', description: profileError?.message ?? detailsError?.message })
      return
    }

    await refreshProfile()
    queryClient.invalidateQueries({ queryKey: ['biker_details', user.id] })
    push({ type: 'success', title: 'Perfil actualizado' })
  }

  if (isLoading || !profile) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 font-flat md:px-8">
        <Skeleton className="h-8 w-40" />
        <div className="mt-8 flex items-center gap-4">
          <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="mt-8 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 font-flat md:px-8">
      <div className="mb-10 flex items-center gap-5">
        <InitialsAvatar name={profile.display_name || 'B'} className="h-20 w-20 rounded-full bg-primary text-2xl text-white" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{profile.display_name || 'Tu perfil'}</h1>
          <p className="text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 md:hidden">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-3 py-4 text-center text-xs font-medium transition-colors hover:border-primary/30"
          >
            {link.icon}
            {link.label}
          </Link>
        ))}
      </div>

      <Card tint="blue" className="cursor-default hover:scale-100">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <div className="sm:col-span-2">
            <Input label="Nombre" error={errors.displayName?.message} {...register('displayName')} />
          </div>
          <Input label="Teléfono" placeholder="Opcional" {...register('phone')} />
          <Input label="Ciudad" placeholder="Opcional" {...register('city')} />
          <Input label="Marca de moto" placeholder="Ej. Yamaha" {...register('motoBrand')} />
          <Input label="Modelo" placeholder="Ej. MT-07" {...register('motoModel')} />

          <div className="sm:col-span-2">
            <p className="mb-4 text-xs text-muted-foreground">
              Tu marca y modelo nos ayudan a mostrarte fotos más relevantes cuando busques.
            </p>
            <Button type="submit" loading={isSubmitting}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </Card>

      <Card tint="blue" className="mt-6 cursor-default hover:scale-100">
        <h2 className="text-lg font-bold tracking-tight">Notificaciones</h2>
        <div className="mt-4 flex flex-col gap-4">
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
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            )
          })}
        </div>
      </Card>

      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="mt-8 flex items-center gap-2 text-sm font-medium text-muted-foreground disabled:opacity-50 md:hidden"
      >
        <IconLogOut className="h-4 w-4" />
        {signingOut ? 'Saliendo…' : 'Cerrar sesión'}
      </button>
    </div>
  )
}
