import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function RequireBiker({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth()

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  if (profile && profile.role !== 'biker' && profile.role !== 'admin') {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
