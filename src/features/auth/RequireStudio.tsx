import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function RequireStudio({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth()

  if (loading) return null
  if (!session) return <Navigate to="/studio/login" replace />
  if (profile && profile.role !== 'photographer' && profile.role !== 'admin') {
    return <Navigate to="/studio/login" replace />
  }

  return <>{children}</>
}
