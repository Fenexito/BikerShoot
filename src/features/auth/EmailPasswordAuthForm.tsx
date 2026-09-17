import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../ui/flat/Button'
import { Input } from '../../ui/flat/Input'
import { GoogleIcon } from '../../ui/shared/GoogleIcon'
import { FacebookIcon } from '../../ui/shared/FacebookIcon'
import { AppleIcon } from '../../ui/shared/AppleIcon'
import { AuthSplitLayout } from '../../ui/shared/AuthSplitLayout'
import { PortalSwitch } from '../../ui/shared/PortalSwitch'
import { supabase } from '../../lib/supabase'
import { useAuth } from './AuthContext'

interface EmailPasswordAuthFormProps {
  portal: 'biker' | 'studio'
  logo?: ReactNode
  signupTo: string
  forgotPasswordTo: string
  successTo: string
}

/** Mismo flujo, mismo texto, mismo tamaño en ambos portales — solo cambia
 * el tema (claro para biker, oscuro para Studio) vía CSS. Primero pide el
 * correo; si ya existe una cuenta, revela el campo de contraseña con una
 * animación; si no, invita a registrarse — así no hace falta un botón de
 * "crear cuenta" aparte. */
export function EmailPasswordAuthForm({ portal, logo, signupTo, forgotPasswordTo, successTo }: EmailPasswordAuthFormProps) {
  const { signIn, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  // Si se llegó aquí desde un link que exige sesión (ej. una foto
  // compartida), `next` manda sobre `successTo` — así el login regresa
  // exactamente a donde el usuario quería llegar, no siempre a Inicio.
  const [urlParams] = useSearchParams()
  const next = urlParams.get('next')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep] = useState<'email' | 'password' | 'not-found'>('email')
  const [checking, setChecking] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Si el usuario cancela en la pantalla de Google (botón "atrás" del
  // navegador) en vez de completar el login, el navegador restaura esta
  // página desde el bfcache tal cual quedó antes de salir — con
  // `googleLoading` todavía en `true` y el botón congelado en su estado de
  // carga para siempre, porque `signInWithOAuth` nunca vuelve a ejecutar
  // código en esta página (la redirección la saca del todo). `pageshow`
  // con `event.persisted` detecta justo ese caso (restaurado desde
  // bfcache, no una carga nueva) y libera el botón para que el usuario
  // pueda seguir con el login normal o reintentar.
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) setGoogleLoading(false)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

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
    navigate(next || successTo)
  }

  async function onGoogle() {
    setError(null)
    setGoogleLoading(true)
    const { error: googleError } = await signInWithGoogle(portal, next ?? undefined)
    if (googleError) {
      setError(googleError)
      setGoogleLoading(false)
    }
  }

  function backToEmail() {
    setStep('email')
    setPassword('')
    setError(null)
  }

  return (
    <AuthSplitLayout logoTo="/" logo={logo}>
      <div className="mb-4 transition-all duration-500 ease-in-out sm:mb-8">
        {step === 'password' ? (
          <>
            <button
              onClick={backToEmail}
              className="mb-3 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Volver
            </button>
            <h1 className="mb-2 text-3xl font-bold tracking-tight">Ingresa tu contraseña</h1>
            <p className="text-muted-foreground">Continuando como <span className="font-semibold text-foreground">{email}</span></p>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-3xl font-bold tracking-tight">Bienvenido de vuelta</h1>
            <p className="text-muted-foreground">
              Entra para continuar. {portal === 'studio' ? 'Ingresa el correo de tu estudio o fotógrafo.' : 'Ingresa el correo de tu cuenta de usuario.'}
            </p>
          </>
        )}
      </div>

      <div
        className={`grid overflow-hidden transition-all duration-500 ease-in-out ${step === 'password' ? 'mb-0 grid-rows-[0fr] opacity-0' : 'mb-4 grid-rows-[1fr] opacity-100 sm:mb-8'}`}
      >
        <div className="min-h-0">
          <PortalSwitch current={portal} label="¿Cómo quieres continuar?" />
        </div>
      </div>

      <form onSubmit={step === 'email' || step === 'not-found' ? handleEmailSubmit : handlePasswordSubmit} className="flex flex-col gap-3 sm:gap-4">
        <div
          className={`grid overflow-hidden transition-all duration-500 ease-in-out ${step === 'password' ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}
        >
          <div className="min-h-0">
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
          </div>
        </div>

        <div
          className={`grid overflow-hidden transition-all duration-500 ease-in-out ${step === 'password' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
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
            <Link
              to={`${signupTo}?email=${encodeURIComponent(email)}${next ? `&next=${encodeURIComponent(next)}` : ''}`}
              className="font-semibold text-foreground underline"
            >
              Crear cuenta
            </Link>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" variant="dark" size="lg" loading={checking || signingIn} className="mt-2">
          {step === 'password' ? 'Iniciar sesión' : 'Continuar'}
        </Button>
      </form>

      <div
        className={`grid overflow-hidden transition-all duration-500 ease-in-out ${step === 'password' ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}
      >
        <div className="min-h-0">
          <div className="my-3 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground sm:my-6">
            <span className="h-px flex-1 bg-border" />o continúa con<span className="h-px flex-1 bg-border" />
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="secondary" size="default" onClick={onGoogle} loading={googleLoading} className="w-full">
              <GoogleIcon className="h-5 w-5" />
              Continuar con Google
            </Button>
            {/* Facebook y Apple: solo la parte visual por ahora — conectarlos
                de verdad requiere una app registrada en Facebook Developers
                y en Apple Developer Program (Apple además es requisito de
                Apple para publicar la futura app móvil), configuradas como
                providers en Supabase Auth. Deshabilitados hasta tener esas
                credenciales. */}
            <Button variant="secondary" size="default" disabled title="Próximamente" className="w-full opacity-60">
              <FacebookIcon className="h-5 w-5" />
              Continuar con Facebook
            </Button>
            <Button variant="secondary" size="default" disabled title="Próximamente" className="w-full opacity-60">
              <AppleIcon className="h-4 w-4" />
              Continuar con Apple
            </Button>
          </div>
        </div>
      </div>

    </AuthSplitLayout>
  )
}
