import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../ui/flat/Button'
import { Input } from '../../ui/flat/Input'
import { useAuth } from './AuthContext'

const schema = z
  .object({
    displayName: z.string().min(2, 'Ingresa tu nombre'),
    email: z.string().email('Correo inválido'),
    password: z.string().min(6, 'Mínimo 6 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })
type FormValues = z.infer<typeof schema>

export function BikerSignup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingConfirmation, setPendingConfirmation] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    setFormError(null)
    const { error, needsEmailConfirmation } = await signUp(values.email, values.password, 'biker', values.displayName)
    if (error) {
      setFormError(error)
      return
    }
    if (needsEmailConfirmation) {
      setPendingConfirmation(true)
      return
    }
    navigate('/app')
  }

  if (pendingConfirmation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16 font-flat">
        <div className="w-full max-w-md text-center">
          <span className="text-5xl">📬</span>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">Revisa tu correo</h1>
          <p className="mt-3 text-muted-foreground">
            Te enviamos un enlace de confirmación. Ábrelo para activar tu cuenta y luego inicia sesión.
          </p>
          <Link to="/login" className="mt-8 inline-block font-semibold text-primary">
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16 font-flat">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 inline-block text-2xl font-extrabold tracking-tight text-primary">
          MotoShots
        </Link>
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Crear cuenta</h1>
        <p className="mb-8 text-muted-foreground">Encuentra tus fotos de moto en segundos.</p>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Nombre" placeholder="Tu nombre" error={errors.displayName?.message} {...register('displayName')} />
          <Input label="Correo" type="email" placeholder="tu@correo.com" error={errors.email?.message} {...register('email')} />
          <Input label="Contraseña" type="password" placeholder="••••••••" error={errors.password?.message} {...register('password')} />
          <Input
            label="Confirmar contraseña"
            type="password"
            placeholder="••••••••"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <Button type="submit" size="lg" loading={isSubmitting} className="mt-2">
            Crear cuenta
          </Button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          ¿Ya tienes cuenta? <Link to="/login" className="font-semibold text-primary">Iniciar sesión</Link>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          ¿Eres fotógrafo? <Link to="/studio/signup" className="font-semibold text-primary">Regístrate en Studio</Link>
        </p>
      </div>
    </div>
  )
}
