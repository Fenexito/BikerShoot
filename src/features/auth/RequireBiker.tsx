import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function RequireBiker({ children }: { children: ReactNode }) {
  const { session, profile, loading, profileLoading } = useAuth()

  if (loading || profileLoading) return null
  if (!session) return <Navigate to="/login" replace />
  // Negar por defecto: sin un perfil confirmado con el rol correcto, no se
  // renderiza nada — nunca dejar pasar solo porque el perfil no cargó.
  if (!profile || (profile.role !== 'biker' && profile.role !== 'admin')) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
