import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export interface StoragePlanInfo {
  id: string
  name: string
  gb_limit: number
  price_monthly_gtq: number
  max_active_events: number | null
}

export interface StorageAddonInfo {
  id: string
  name: string
  gb: number
  price_monthly_gtq: number
}

export interface FeatureAddonInfo {
  id: string
  name: string
  price_monthly_gtq: number
  native_plan_id: string | null
}

export interface PhotographerDetails {
  profile_id: string
  bio: string | null
  city: string | null
  whatsapp: string | null
  instagram_url: string | null
  facebook_url: string | null
  tiktok_url: string | null
  profile_cover_path: string | null
  logo_path: string | null
  order_nickname: string | null
  onboarding_completed: boolean
  approved: boolean
  approved_at: string | null
  storage_plan_id: string
  storage_plan: StoragePlanInfo | null
  plan_started_at: string
  plan_renews_at: string
  pending_plan_id: string | null
  storage_addon_ids: string[]
  feature_addon_ids: string[]
  bank_name: string | null
  bank_account_holder: string | null
  bank_account_number: string | null
  bank_account_type: string | null
}

export function usePhotographerDetails(userId: string | undefined) {
  return useQuery({
    queryKey: ['photographer_details', userId],
    queryFn: async (): Promise<PhotographerDetails | null> => {
      const { data, error } = await supabase
        .from('photographer_details')
        .select('*, storage_plan:storage_plans!photographer_details_storage_plan_id_fkey(id, name, gb_limit, price_monthly_gtq, max_active_events)')
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
      const { data, error } = await supabase
        .from('storage_plans')
        .select('id, name, gb_limit, price_monthly_gtq, max_active_events')
        .order('sort_order')
      if (error) throw error
      return data
    },
  })
}

export function useStorageAddons() {
  return useQuery({
    queryKey: ['storage-addons'],
    queryFn: async (): Promise<StorageAddonInfo[]> => {
      const { data, error } = await supabase.from('storage_addons').select('id, name, gb, price_monthly_gtq').order('sort_order')
      if (error) throw error
      return data
    },
  })
}

export function useFeatureAddons() {
  return useQuery({
    queryKey: ['feature-addons'],
    queryFn: async (): Promise<FeatureAddonInfo[]> => {
      const { data, error } = await supabase.from('feature_addons').select('id, name, price_monthly_gtq, native_plan_id').order('sort_order')
      if (error) throw error
      return data
    },
  })
}

/** Suma de tarifas de servicio (Q2/foto) que este fotógrafo todavía debe —
 * se van acumulando venta por venta y se saldan junto a su próxima
 * factura de plan (ver StoragePlansAdmin.tsx para la acción de liquidar). */
export function usePendingServiceFees(photographerId: string | undefined) {
  return useQuery({
    queryKey: ['pending-service-fees', photographerId],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from('order_items')
        .select('service_fee')
        .eq('photographer_id', photographerId)
        .eq('is_courtesy', false)
        .is('service_fee_settled_at', null)
      if (error) throw error
      return (data ?? []).reduce((sum, r) => sum + Number(r.service_fee ?? 0), 0)
    },
    enabled: !!photographerId,
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
