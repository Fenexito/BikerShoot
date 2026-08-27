import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { Button } from '../../ui/studio/Button'
import { Input } from '../../ui/studio/Input'
import { useToastStore } from '../../ui/overlays/toastStore'

const schema = z.object({
  displayName: z.string().min(2, 'Ingresa el nombre de tu estudio'),
  city: z.string().min(2, 'Ingresa tu ciudad'),
  whatsapp: z.string().min(6, 'Ingresa un número de contacto'),
  bio: z.string().min(10, 'Cuéntanos un poco más (mínimo 10 caracteres)'),
})
type FormValues = z.infer<typeof schema>

export function StudioOnboarding() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const push = useToastStore((s) => s.push)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: profile?.display_name ?? '' },
  })

  const onSubmit = async (values: FormValues) => {
    if (!user) return

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ display_name: values.displayName })
      .eq('id', user.id)

    const { error: detailsError } = await supabase
      .from('photographer_details')
      .update({ bio: values.bio, city: values.city, whatsapp: values.whatsapp, onboarding_completed: true })
      .eq('profile_id', user.id)

    if (profileError || detailsError) {
      push({ type: 'error', title: 'No se pudo guardar', description: profileError?.message ?? detailsError?.message })
      return
    }

    await refreshProfile()
    queryClient.invalidateQueries({ queryKey: ['photographer_details', user.id] })
    navigate('/studio')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-lg">
        <span className="font-studio-mono text-xs uppercase tracking-widest2 text-accent">Un último paso</span>
        <h1 className="mt-4 font-studio text-4xl font-bold tracking-tight2 md:text-5xl">
          Completa tu estudio
        </h1>
        <p className="mt-4 text-muted-foreground">
          Esta información aparece en tu perfil público para que los bikers te encuentren.
        </p>

        <form className="mt-10 flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Nombre del estudio" error={errors.displayName?.message} {...register('displayName')} />
          <Input label="Ciudad" placeholder="Ej. Guatemala" error={errors.city?.message} {...register('city')} />
          <Input label="WhatsApp de contacto" placeholder="Ej. +502 5555 5555" error={errors.whatsapp?.message} {...register('whatsapp')} />

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium uppercase tracking-wider2 text-muted-foreground">Sobre ti</label>
            <textarea
              rows={4}
              className="border border-border bg-input px-4 py-3 text-base text-foreground outline-none transition-colors duration-150 focus:border-accent"
              placeholder="Qué tipo de eventos cubres, tu estilo, experiencia..."
              {...register('bio')}
            />
            {errors.bio && <span className="text-xs text-accent">{errors.bio.message}</span>}
          </div>

          <Button type="submit" variant="secondary" size="lg" loading={isSubmitting} className="mt-4 justify-center">
            Terminar y entrar a Studio
          </Button>
        </form>
      </div>
    </div>
  )
}
