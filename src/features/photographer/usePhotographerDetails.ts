import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export interface PhotographerDetails {
  profile_id: string
  bio: string | null
  city: string | null
  whatsapp: string | null
  onboarding_completed: boolean
  approved: boolean
  approved_at: string | null
}

export function usePhotographerDetails(userId: string | undefined) {
  return useQuery({
    queryKey: ['photographer_details', userId],
    queryFn: async (): Promise<PhotographerDetails | null> => {
      const { data, error } = await supabase
        .from('photographer_details')
        .select('*')
        .eq('profile_id', userId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!userId,
  })
}
