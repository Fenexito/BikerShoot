import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from './AuthContext'
import { useToastStore } from '../../ui/overlays/toastStore'
import { Button as FlatButton } from '../../ui/flat/Button'
import { Input as FlatInput } from '../../ui/flat/Input'
import { Button as StudioButton } from '../../ui/studio/Button'
import { Input as StudioInput } from '../../ui/studio/Input'

const schema = z
  .object({
    password: z.string().min(6, 'Mínimo 6 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })
type FormValues = z.infer<typeof schema>

export function ResetPassword() {
  const { session, profile, loading, updatePassword } = useAuth()
  const navigate = useNavigate()
  const push = useToastStore((s) => s.push)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    setFormError(null)
    const { error } = await updatePassword(values.password)
    if (error) {
      setFormError(error)
      return
    }
    push({ type: 'success', title: 'Contraseña actualizada' })
    navigate(profile?.role === 'photographer' ? '/studio/login' : '/login')
  }

  if (loading) return null

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16 font-flat text-center">
        <div className="max-w-md">
          <h1 className="text-2xl font-bold tracking-tight">Enlace inválido o expirado</h1>
          <p className="mt-3 text-muted-foreground">Solicita uno nuevo desde la página de inicio de sesión.</p>
          <Link to="/login" className="mt-6 inline-block font-semibold text-primary">
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    )
  }

  const isStudio = profile?.role === 'photographer'
  const Button = isStudio ? StudioButton : FlatButton
  const Input = isStudio ? StudioInput : FlatInput

  return (
    <div
      className={
        isStudio
          ? 'flex min-h-screen items-center justify-center bg-background px-6 py-16 text-foreground'
          : 'flex min-h-screen items-center justify-center bg-background px-6 py-16 font-flat'
      }
    >
      <div className="w-full max-w-md">
        <h1 className={isStudio ? 'mb-3 font-studio text-4xl font-bold tracking-tight2' : 'mb-2 text-3xl font-bold tracking-tight'}>
          Nueva contraseña
        </h1>
        <p className="mb-8 text-muted-foreground">Elige una contraseña nueva para tu cuenta.</p>

        <form className={isStudio ? 'flex flex-col gap-5' : 'flex flex-col gap-4'} onSubmit={handleSubmit(onSubmit)}>
          <Input label="Nueva contraseña" type="password" placeholder="••••••••" error={errors.password?.message} {...register('password')} />
          <Input
            label="Confirmar contraseña"
            type="password"
            placeholder="••••••••"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          {formError && <p className={isStudio ? 'text-sm text-accent' : 'text-sm text-red-600'}>{formError}</p>}
          <Button type="submit" variant={isStudio ? 'secondary' : 'primary'} size="lg" loading={isSubmitting} className="mt-2 justify-center">
            Guardar contraseña
          </Button>
        </form>
      </div>
    </div>
  )
}
