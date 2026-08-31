import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export interface StoragePlanInfo {
  id: string
  name: string
  gb_limit: number
  price_monthly_gtq: number
}

export interface PhotographerDetails {
  profile_id: string
  bio: string | null
  city: string | null
  whatsapp: string | null
  onboarding_completed: boolean
  approved: boolean
  approved_at: string | null
  storage_plan_id: string
  storage_plan: StoragePlanInfo | null
  plan_started_at: string
  plan_renews_at: string
  pending_plan_id: string | null
}

export function usePhotographerDetails(userId: string | undefined) {
  return useQuery({
    queryKey: ['photographer_details', userId],
    queryFn: async (): Promise<PhotographerDetails | null> => {
      const { data, error } = await supabase
        .from('photographer_details')
        .select('*, storage_plan:storage_plans!photographer_details_storage_plan_id_fkey(id, name, gb_limit, price_monthly_gtq)')
        .eq('profile_id', userId)
        .single()
      if (error) throw error
      return data as unknown as PhotographerDetails
    },
    enabled: !!userId,
  })
}

export function useStoragePlans() {
  return useQuery({
    queryKey: ['storage-plans'],
    queryFn: async (): Promise<StoragePlanInfo[]> => {
      const { data, error } = await supabase.from('storage_plans').select('id, name, gb_limit, price_monthly_gtq').order('sort_order')
      if (error) throw error
      return data
    },
  })
}

export function usePhotographerUsageBytes(userId: string | undefined) {
  return useQuery({
    queryKey: ['photographer-usage-bytes', userId],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from('photos')
        .select('preview_size_bytes, raw_size_bytes, delivered_size_bytes')
        .eq('photographer_id', userId)
      if (error) throw error
      return (data ?? []).reduce(
        (sum, p) => sum + (p.preview_size_bytes ?? 0) + (p.raw_size_bytes ?? 0) + (p.delivered_size_bytes ?? 0),
        0,
      )
    },
    enabled: !!userId,
  })
}
