import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export interface BikerDetails {
  profile_id: string
  moto_brand: string | null
  moto_model: string | null
  city: string | null
}

export function useBikerDetails(userId: string | undefined) {
  return useQuery({
    queryKey: ['biker_details', userId],
    queryFn: async (): Promise<BikerDetails | null> => {
      const { data, error } = await supabase
        .from('biker_details')
        .select('*')
        .eq('profile_id', userId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!userId,
  })
}
