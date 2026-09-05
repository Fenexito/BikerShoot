import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../ui/flat/Button'
import { Input } from '../../ui/flat/Input'
import { GoogleIcon } from '../../ui/shared/GoogleIcon'
import { AuthSplitLayout } from '../../ui/shared/AuthSplitLayout'
import { PortalSwitch } from '../../ui/shared/PortalSwitch'
import { supabase } from '../../lib/supabase'
import { useAuth } from './AuthContext'

interface EmailPasswordAuthFormProps {
  portal: 'biker' | 'studio'
  logoLabel: string
  signupTo: string
  forgotPasswordTo: string
  successTo: string
}

/** Mismo flujo, mismo texto, mismo tamaño en ambos portales — solo cambia
 * el tema (claro para biker, oscuro para Studio) vía CSS. Primero pide el
 * correo; si ya existe una cuenta, revela el campo de contraseña con una
 * animación; si no, invita a registrarse — así no hace falta un botón de
 * "crear cuenta" aparte. */
export function EmailPasswordAuthForm({ portal, logoLabel, signupTo, forgotPasswordTo, successTo }: EmailPasswordAuthFormProps) {
  const { signIn, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep] = useState<'email' | 'password' | 'not-found'>('email')
  const [checking, setChecking] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !email.includes('@')) {
      setError('Ingresa un correo válido')
      return
    }
    setChecking(true)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('check-email-exists', { body: { email } })
      // Si la función no está desplegada o falla, no bloqueamos el login —
      // simplemente asumimos que puede existir y dejamos que signIn lo
      // resuelva con su propio mensaje de error si la contraseña es incorrecta.
      if (fnError || data?.exists !== false) {
        setStep('password')
      } else {
        setStep('not-found')
      }
    } catch {
      setStep('password')
    } finally {
      setChecking(false)
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSigningIn(true)
    const { error: signInError } = await signIn(email, password, portal)
    setSigningIn(false)
    if (signInError) {
      setError(signInError)
      return
    }
    navigate(successTo)
  }

  async function onGoogle() {
    setError(null)
    setGoogleLoading(true)
    const { error: googleError } = await signInWithGoogle(portal)
    if (googleError) {
      setError(googleError)
      setGoogleLoading(false)
    }
  }

  return (
    <AuthSplitLayout logoTo="/" logoLabel={logoLabel}>
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Bienvenido de vuelta</h1>
      <p className="mb-8 text-muted-foreground">
        Entra para continuar. {portal === 'studio' ? 'Ingresa el correo de tu estudio o fotógrafo.' : 'Ingresa el correo de tu cuenta de usuario.'}
      </p>

      <form onSubmit={step === 'email' || step === 'not-found' ? handleEmailSubmit : handlePasswordSubmit} className="flex flex-col gap-4">
        <Input
          id="email"
          label="Correo"
          type="email"
          placeholder="tu@correo.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (step !== 'email') setStep('email')
          }}
        />

        <div
          className={`grid overflow-hidden transition-all duration-300 ease-out ${step === 'password' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
        >
          <div className="flex min-h-0 flex-col gap-2">
            <Input
              id="password"
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus={step === 'password'}
            />
            <Link to={forgotPasswordTo} className="-mt-1 self-end text-sm font-medium text-foreground underline decoration-border hover:decoration-foreground">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>

        {step === 'not-found' && (
          <div className="rounded-2xl bg-muted px-4 py-3 text-sm">
            No encontramos una cuenta con este correo.{' '}
            <Link to={`${signupTo}?email=${encodeURIComponent(email)}`} className="font-semibold text-foreground underline">
              Crear cuenta
            </Link>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" variant="dark" size="lg" loading={checking || signingIn} className="mt-2">
          {step === 'password' ? 'Iniciar sesión' : 'Continuar'}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
        <span className="h-px flex-1 bg-border" />o continúa con<span className="h-px flex-1 bg-border" />
      </div>

      <Button variant="secondary" size="lg" onClick={onGoogle} loading={googleLoading} className="w-full">
        <GoogleIcon className="h-5 w-5" />
        Continuar con Google
      </Button>

      <div className="mt-8 flex justify-center">
        <PortalSwitch current={portal} />
      </div>
    </AuthSplitLayout>
  )
}
