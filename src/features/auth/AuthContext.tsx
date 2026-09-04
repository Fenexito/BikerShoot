import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

export type Role = 'biker' | 'photographer' | 'admin'

export interface Profile {
  id: string
  role: Role
  display_name: string
  avatar_url: string | null
  phone: string | null
}

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  profileLoading: boolean
  signUp: (
    email: string,
    password: string,
    role: Role,
    displayName: string,
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>
  signIn: (email: string, password: string, portal: 'biker' | 'studio') => Promise<{ error: string | null }>
  signInWithGoogle: (portal: 'biker' | 'studio') => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const loadedUserId = useRef<string | null>(null)

  // Nunca deja profile/profileLoading en un estado ambiguo: los guards de
  // ruta (RequireStudio/RequireBiker) niegan acceso por defecto mientras
  // profileLoading sea true, y tratan un fetch fallido como "sin perfil"
  // en vez de dejar pasar silenciosamente (bug real: un biker podía entrar
  // a /studio durante la ventana en la que loadProfile aún no resolvía).
  async function loadProfile(userId: string) {
    setProfileLoading(true)
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (error) {
        console.error('No se pudo cargar el perfil', error)
        setProfile(null)
        return
      }
      setProfile(data ?? null)
      loadedUserId.current = userId
    } finally {
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session?.user) {
        await loadProfile(data.session.user.id)
      } else {
        setProfileLoading(false)
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      if (!newSession?.user) {
        loadedUserId.current = null
        setProfile(null)
        setProfileLoading(false)
        return
      }
      // Supabase dispara este evento también en cada refresco silencioso de
      // token (p.ej. al volver a la pestaña), no solo en un login real. Si
      // recargábamos el perfil cada vez, profileLoading pasaba a true y los
      // guards de ruta desmontaban toda la página — cancelando cualquier
      // formulario a medio llenar (editar perfil, subir fotos). Ahora solo
      // se recarga si el usuario realmente cambió.
      if (newSession.user.id !== loadedUserId.current) {
        await loadProfile(newSession.user.id)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signUp(email: string, password: string, role: Role, displayName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role, display_name: displayName } },
    })
    return { error: error?.message ?? null, needsEmailConfirmation: !error && !data.session }
  }

  async function signIn(email: string, password: string, portal: 'biker' | 'studio') {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }

    const { data: prof } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    const allowedRoles: Role[] = portal === 'biker' ? ['biker', 'admin'] : ['photographer', 'admin']

    if (prof && !allowedRoles.includes(prof.role as Role)) {
      await supabase.auth.signOut()
      return {
        error:
          portal === 'biker'
            ? 'Esta cuenta es de fotógrafo. Inicia sesión en MotoShots Studio.'
            : 'Esta cuenta es de biker. Inicia sesión en el sitio principal.',
      }
    }

    return { error: null }
  }

  async function signInWithGoogle(portal: 'biker' | 'studio') {
    const intendedRole = portal === 'biker' ? 'biker' : 'photographer'
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?role=${intendedRole}` },
    })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function requestPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error: error?.message ?? null }
  }

  async function updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: error?.message ?? null }
  }

  async function refreshProfile() {
    if (session?.user) await loadProfile(session.user.id)
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        profileLoading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        requestPasswordReset,
        updatePassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
