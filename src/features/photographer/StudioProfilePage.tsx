import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../auth/AuthContext'
import { usePhotographerDetails } from './usePhotographerDetails'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { Button } from '../../ui/studio/Button'
import { Input } from '../../ui/studio/Input'
import { Badge } from '../../ui/studio/Badge'
import { InitialsAvatar } from '../../ui/shared/InitialsAvatar'
import { useToastStore } from '../../ui/overlays/toastStore'

const schema = z.object({
  displayName: z.string().min(2, 'Ingresa el nombre de tu estudio'),
  city: z.string().optional(),
  whatsapp: z.string().optional(),
  bio: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export function StudioProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const { data: details, isLoading } = usePhotographerDetails(user?.id)
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
        city: details?.city ?? '',
        whatsapp: details?.whatsapp ?? '',
        bio: details?.bio ?? '',
      })
    }
  }, [profile, details, reset])

  const onSubmit = async (values: FormValues) => {
    if (!user) return

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ display_name: values.displayName })
      .eq('id', user.id)

    const { error: detailsError } = await supabase
      .from('photographer_details')
      .update({ city: values.city || null, whatsapp: values.whatsapp || null, bio: values.bio || null })
      .eq('profile_id', user.id)

    if (profileError || detailsError) {
      push({ type: 'error', title: 'No se pudo guardar', description: profileError?.message ?? detailsError?.message })
      return
    }

    await refreshProfile()
    queryClient.invalidateQueries({ queryKey: ['photographer_details', user.id] })
    push({ type: 'success', title: 'Perfil actualizado' })
  }

  if (isLoading || !profile) {
    return <div className="px-6 py-16 text-center text-muted-foreground">Cargando perfil…</div>
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-foreground">
      <div className="mb-10 flex items-center gap-5">
        <InitialsAvatar name={profile.display_name || 'S'} className="h-20 w-20 bg-foreground text-2xl text-background" />
        <div>
          <h1 className="font-studio text-2xl font-bold tracking-tight2">{profile.display_name}</h1>
          <p className="text-muted-foreground">{user?.email}</p>
        </div>
        {details?.approved ? (
          <Badge className="ml-auto border-accent text-accent">Aprobado para vender</Badge>
        ) : (
          <Badge className="ml-auto">Pendiente de aprobación</Badge>
        )}
      </div>

      {!details?.approved && (
        <p className="mb-8 border border-border px-4 py-3 text-sm text-muted-foreground">
          Tu cuenta está en revisión. Podrás publicar eventos y vender fotos en cuanto un
          administrador la apruebe.
        </p>
      )}

      <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
        <Input label="Nombre del estudio" error={errors.displayName?.message} {...register('displayName')} />
        <Input label="Ciudad" {...register('city')} />
        <Input label="WhatsApp de contacto" {...register('whatsapp')} />

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium uppercase tracking-wider2 text-muted-foreground">Sobre ti</label>
          <textarea
            rows={4}
            className="border border-border bg-input px-4 py-3 text-base text-foreground outline-none transition-colors duration-150 focus:border-accent"
            {...register('bio')}
          />
        </div>

        <Button type="submit" variant="secondary" size="lg" loading={isSubmitting} className="mt-2 justify-center">
          Guardar cambios
        </Button>
      </form>
    </div>
  )
}
