import { useEffect } from 'react'
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
import { useToastStore } from '../../ui/overlays/toastStore'

const schema = z.object({
  displayName: z.string().min(2, 'Ingresa tu nombre'),
  phone: z.string().optional(),
  motoBrand: z.string().optional(),
  motoModel: z.string().optional(),
  city: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export function BikerProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const { data: details, isLoading } = useBikerDetails(user?.id)
  const push = useToastStore((s) => s.push)

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
    return <div className="px-6 py-16 text-center text-muted-foreground font-flat">Cargando perfil…</div>
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 font-flat">
      <div className="mb-10 flex items-center gap-5">
        <InitialsAvatar name={profile.display_name || 'B'} className="h-20 w-20 rounded-full bg-primary text-2xl text-white" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{profile.display_name || 'Tu perfil'}</h1>
          <p className="text-muted-foreground">{user?.email}</p>
        </div>
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
    </div>
  )
}
