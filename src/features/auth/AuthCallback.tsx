import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth, type Role } from './AuthContext'
import { supabase } from '../../lib/supabase'
import { useToastStore } from '../../ui/overlays/toastStore'

const FIRST_LOGIN_WINDOW_MS = 10_000

export function AuthCallback() {
  const { session, user, profile, loading, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const push = useToastStore((s) => s.push)
  const handled = useRef(false)

  useEffect(() => {
    if (loading || !session || !user || !profile || handled.current) return
    handled.current = true

    const intendedRole = (searchParams.get('role') as 'biker' | 'photographer' | null) ?? 'biker'
    const allowedRoles: Role[] = intendedRole === 'biker' ? ['biker', 'admin'] : ['photographer', 'admin']

    const createdAt = new Date(user.created_at).getTime()
    const lastSignInAt = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : createdAt
    const isFirstLogin = lastSignInAt - createdAt < FIRST_LOGIN_WINDOW_MS

    async function finish(destination: string) {
      navigate(destination, { replace: true })
    }

    async function reject() {
      await signOut()
      push({
        type: 'error',
        title:
          intendedRole === 'biker'
            ? 'Esta cuenta es de fotógrafo. Inicia sesión en MotoShots Studio.'
            : 'Esta cuenta es de biker. Inicia sesión en el sitio principal.',
      })
      navigate(intendedRole === 'biker' ? '/login' : '/studio/login', { replace: true })
    }

    async function run() {
      if (allowedRoles.includes(profile!.role)) {
        finish(profile!.role === 'photographer' ? '/studio' : '/app')
        return
      }

      // Cuenta recién creada por Google (el trigger la puso como "biker" por
      // defecto, ya que Google no manda nuestro campo "role") y venía con
      // intención de ser fotógrafo: la reconciliamos una sola vez.
      if (isFirstLogin && profile!.role === 'biker' && intendedRole === 'photographer') {
        await supabase.from('profiles').update({ role: 'photographer' }).eq('id', user!.id)
        await supabase.from('photographer_details').upsert({ profile_id: user!.id })
        await supabase.from('biker_details').delete().eq('profile_id', user!.id)
        await refreshProfile()
        finish('/studio')
        return
      }

      await reject()
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, user, profile])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background font-flat text-muted-foreground">
      Conectando tu cuenta…
    </div>
  )
}
