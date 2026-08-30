import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import type { DbRoute, DbRoutePoint } from '../../types/db'

/** Rutas y puntos de ruta — catálogo público compartido entre fotógrafos. */

export function useRoutes() {
  return useQuery({
    queryKey: ['routes'],
    queryFn: async (): Promise<DbRoute[]> => {
      const { data, error } = await supabase.from('routes').select('id, name').order('sort_order').order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useRoutePoints(routeId: string | undefined) {
  return useQuery({
    queryKey: ['route-points', routeId],
    queryFn: async (): Promise<DbRoutePoint[]> => {
      const { data, error } = await supabase
        .from('route_points')
        .select('id, route_id, label, lat, lng')
        .eq('route_id', routeId)
        .order('label')
      if (error) throw error
      return data ?? []
    },
    enabled: !!routeId,
  })
}

export async function createRoute(name: string): Promise<DbRoute> {
  const { data, error } = await supabase.from('routes').insert({ name }).select('id, name').single()
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['routes'] })
  return data
}

export async function createRoutePoint(routeId: string, label: string, lat: number, lng: number): Promise<DbRoutePoint> {
  const { data, error } = await supabase
    .from('route_points')
    .insert({ route_id: routeId, label, lat, lng })
    .select('id, route_id, label, lat, lng')
    .single()
  if (error) throw error
  queryClient.invalidateQueries({ queryKey: ['route-points', routeId] })
  return data
}
