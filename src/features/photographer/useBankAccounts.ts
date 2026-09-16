import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export interface BankAccount {
  id: string
  photographer_id: string
  bank_name: string | null
  account_holder: string | null
  account_number: string | null
  account_type: string | null
  info_photo_path: string | null
  sort_order: number
  created_at: string
}

export function useBankAccounts(photographerId: string | undefined) {
  return useQuery({
    queryKey: ['bank-accounts', photographerId],
    queryFn: async (): Promise<BankAccount[]> => {
      const { data, error } = await supabase
        .from('photographer_bank_accounts')
        .select('*')
        .eq('photographer_id', photographerId)
        .order('sort_order')
        .order('created_at')
      if (error) throw error
      return data ?? []
    },
    enabled: !!photographerId,
  })
}
