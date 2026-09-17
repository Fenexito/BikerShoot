import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../ui/studio/Button'
import { Input } from '../../ui/studio/Input'
import { GoogleIcon } from '../../ui/shared/GoogleIcon'
import { FacebookIcon } from '../../ui/shared/FacebookIcon'
import { AppleIcon } from '../../ui/shared/AppleIcon'
import { AuthSplitLayout } from '../../ui/shared/AuthSplitLayout'
import { PortalSwitch } from '../../ui/shared/PortalSwitch'
import { AuthLogo } from '../../ui/shared/Logo'
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

  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) setGoogleLoading(false)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

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
      <div className="flex h-dvh items-center justify-center bg-background px-6 py-16 text-foreground">
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
    <AuthSplitLayout logoTo="/" logo={<AuthLogo variant="studio" theme="dark" className="w-36 h-auto sm:w-72" />}>
      <h1 className="mb-1 font-studio text-2xl font-bold tracking-tight2 sm:mb-3 sm:text-4xl">Crea tu estudio</h1>
      <p className="mb-3 text-muted-foreground sm:mb-10">Empieza a vender tus fotos sin fricción.</p>

      <div className="mb-3 sm:mb-8">
        <PortalSwitch current="studio" bikerTo="/signup" studioTo="/studio/signup" label="¿Cómo quieres registrarte?" />
      </div>

      <form className="flex flex-col gap-1.5 sm:gap-5" onSubmit={handleSubmit(onSubmit)}>
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

        <div className="my-2 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:my-8">
          <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-col gap-1.5 sm:gap-2">
          <Button variant="secondary" size="default" onClick={onGoogle} loading={googleLoading} className="w-full justify-center">
            <GoogleIcon className="h-5 w-5" />
            Continuar con Google
          </Button>
          <Button variant="secondary" size="default" disabled title="Próximamente" className="w-full justify-center opacity-60">
            <FacebookIcon className="h-5 w-5" />
            Continuar con Facebook
          </Button>
          <Button variant="secondary" size="default" disabled title="Próximamente" className="w-full justify-center opacity-60">
            <AppleIcon className="h-4 w-4" />
            Continuar con Apple
          </Button>
        </div>

        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:mt-8">
          ¿Ya tienes cuenta? <Link to="/studio/login" className="text-accent">Entrar</Link>
        </p>
    </AuthSplitLayout>
  )
}
