import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { usePhotographerDetails } from '../photographer/usePhotographerDetails'

export function RequireStudio({
  children,
  skipOnboardingCheck = false,
}: {
  children: ReactNode
  skipOnboardingCheck?: boolean
}) {
  const { session, profile, loading } = useAuth()
  const { data: details, isLoading: detailsLoading } = usePhotographerDetails(
    !skipOnboardingCheck ? session?.user.id : undefined,
  )

  if (loading) return null
  if (!session) return <Navigate to="/studio/login" replace />
  if (profile && profile.role !== 'photographer' && profile.role !== 'admin') {
    return <Navigate to="/studio/login" replace />
  }

  if (!skipOnboardingCheck && profile?.role === 'photographer') {
    if (detailsLoading) return null
    if (!details?.onboarding_completed) return <Navigate to="/studio/onboarding" replace />
  }

  return <>{children}</>
}
