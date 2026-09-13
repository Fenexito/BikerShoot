import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../ui/flat/Button'
import { Input } from '../../ui/flat/Input'
import { GoogleIcon } from '../../ui/shared/GoogleIcon'
import { FacebookIcon } from '../../ui/shared/FacebookIcon'
import { AppleIcon } from '../../ui/shared/AppleIcon'
import { AuthSplitLayout } from '../../ui/shared/AuthSplitLayout'
import { AuthLogo } from '../../ui/shared/Logo'
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
  const { signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = searchParams.get('next')
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingConfirmation, setPendingConfirmation] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // Ver el mismo fix en EmailPasswordAuthForm.tsx: si el usuario cancela en
  // Google con el botón "atrás", esta página se restaura desde el bfcache
  // con `googleLoading` congelado en `true` para siempre — `pageshow` +
  // `event.persisted` lo libera.
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
    const { error } = await signInWithGoogle('biker', next ?? undefined)
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
    const { error, needsEmailConfirmation } = await signUp(values.email, values.password, 'biker', values.displayName)
    if (error) {
      setFormError(error)
      return
    }
    if (needsEmailConfirmation) {
      setPendingConfirmation(true)
      return
    }
    navigate(next || '/app')
  }

  if (pendingConfirmation) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background px-6 py-16 font-flat">
        <div className="w-full max-w-md text-center">
          <span className="text-5xl">📬</span>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">Revisa tu correo</h1>
          <p className="mt-3 text-muted-foreground">
            Te enviamos un enlace de confirmación. Ábrelo para activar tu cuenta y luego inicia sesión.
          </p>
          <Link to={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="mt-8 inline-block font-semibold text-primary">
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <AuthSplitLayout logo={<AuthLogo className="w-36 h-auto sm:w-72" />}>
      <h1 className="mb-1 text-2xl font-bold tracking-tight sm:mb-2 sm:text-3xl">Crear cuenta</h1>
      <p className="mb-3 text-muted-foreground sm:mb-8">Encuentra tus fotos de moto en segundos.</p>

      <form className="flex flex-col gap-1.5 sm:gap-4" onSubmit={handleSubmit(onSubmit)}>
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

        <div className="my-2 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground sm:my-6">
          <span className="h-px flex-1 bg-border" />o continúa con<span className="h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-col gap-1.5 sm:gap-2">
          <Button variant="secondary" size="default" onClick={onGoogle} loading={googleLoading} className="w-full">
            <GoogleIcon className="h-5 w-5" />
            Continuar con Google
          </Button>
          <Button variant="secondary" size="default" disabled title="Próximamente" className="w-full opacity-60">
            <FacebookIcon className="h-5 w-5" />
            Continuar con Facebook
          </Button>
          <Button variant="secondary" size="default" disabled title="Próximamente" className="w-full opacity-60">
            <AppleIcon className="h-4 w-4" />
            Continuar con Apple
          </Button>
        </div>

        <p className="mt-3 text-sm text-muted-foreground sm:mt-6">
          ¿Ya tienes cuenta? <Link to="/login" className="font-semibold text-primary">Iniciar sesión</Link>
        </p>
        <p className="mt-1 text-sm text-muted-foreground sm:mt-2">
          ¿Eres fotógrafo? <Link to="/studio/signup" className="font-semibold text-primary">Regístrate en Studio</Link>
        </p>
    </AuthSplitLayout>
  )
}
