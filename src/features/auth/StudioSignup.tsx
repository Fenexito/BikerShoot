import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../ui/studio/Button'
import { Input } from '../../ui/studio/Input'
import { GoogleIcon } from '../../ui/shared/GoogleIcon'
import { AuthSplitLayout } from '../../ui/shared/AuthSplitLayout'
import { useAuth } from './AuthContext'

const schema = z
  .object({
    displayName: z.string().min(2, 'Ingresa el nombre de tu estudio'),
    email: z.string().email('Correo inválido'),
    password: z.string().min(6, 'Mínimo 6 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })
type FormValues = z.infer<typeof schema>

export function StudioSignup() {
  const { signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingConfirmation, setPendingConfirmation] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const onGoogle = async () => {
    setFormError(null)
    setGoogleLoading(true)
    const { error } = await signInWithGoogle('studio')
    if (error) {
      setFormError(error)
      setGoogleLoading(false)
    }
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    setFormError(null)
    const { error, needsEmailConfirmation } = await signUp(
      values.email,
      values.password,
      'photographer',
      values.displayName,
    )
    if (error) {
      setFormError(error)
      return
    }
    if (needsEmailConfirmation) {
      setPendingConfirmation(true)
      return
    }
    navigate('/studio')
  }

  if (pendingConfirmation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-foreground">
        <div className="w-full max-w-md text-center">
          <span className="text-5xl">📬</span>
          <h1 className="mt-6 font-studio text-3xl font-bold tracking-tight2">Revisa tu correo</h1>
          <p className="mt-3 text-muted-foreground">
            Te enviamos un enlace de confirmación. Ábrelo para activar tu estudio y luego inicia sesión.
          </p>
          <Link to="/studio/login" className="mt-8 inline-block text-accent">
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <AuthSplitLayout logoTo="/" logoLabel="MotoShots Studio">
      <h1 className="mb-3 font-studio text-4xl font-bold tracking-tight2">Crea tu estudio</h1>
      <p className="mb-10 text-muted-foreground">Empieza a vender tus fotos sin fricción.</p>

      <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Nombre del estudio" placeholder="Tu nombre o estudio" error={errors.displayName?.message} {...register('displayName')} />
          <Input label="Correo" type="email" placeholder="tu@estudio.com" error={errors.email?.message} {...register('email')} />
          <Input label="Contraseña" type="password" placeholder="••••••••" error={errors.password?.message} {...register('password')} />
          <Input
            label="Confirmar contraseña"
            type="password"
            placeholder="••••••••"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          {formError && <p className="text-sm text-accent">{formError}</p>}

          <Button type="submit" variant="secondary" size="lg" loading={isSubmitting} className="mt-2 justify-center">
            Crear cuenta
          </Button>
        </form>

        <div className="my-8 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="secondary" size="lg" onClick={onGoogle} loading={googleLoading} className="w-full justify-center">
          <GoogleIcon className="h-5 w-5" />
          Continuar con Google
        </Button>

        <p className="mt-8 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          ¿Ya tienes cuenta? <Link to="/studio/login" className="text-accent">Entrar</Link>
        </p>
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          ¿Eres biker? <Link to="/signup" className="text-accent">Ir al sitio principal</Link>
        </p>
    </AuthSplitLayout>
  )
}
