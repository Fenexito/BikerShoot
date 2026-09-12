import { useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useCartStore, type CartItem } from './cartStore'

interface CartRow {
  photo_id: string
  event_id: string
  event_title: string
  photographer_id: string
  photographer_name: string
  price: number
  storage_path: string | null
  preview_path: string | null
  original_filename: string | null
  point_label: string | null
  point_time_start: string | null
  point_time_end: string | null
}

function toRow(profileId: string, item: CartItem): CartRow & { profile_id: string } {
  return {
    profile_id: profileId,
    photo_id: item.photoId,
    event_id: item.eventId,
    event_title: item.eventTitle,
    photographer_id: item.photographerId,
    photographer_name: item.photographerName,
    price: item.price,
    storage_path: item.storagePath,
    preview_path: item.previewPath,
    original_filename: item.originalFilename,
    point_label: item.pointLabel,
    point_time_start: item.pointTimeStart,
    point_time_end: item.pointTimeEnd,
  }
}

function fromRow(row: CartRow): CartItem {
  return {
    photoId: row.photo_id,
    eventId: row.event_id,
    eventTitle: row.event_title,
    photographerId: row.photographer_id,
    photographerName: row.photographer_name,
    price: row.price,
    storagePath: row.storage_path,
    previewPath: row.preview_path,
    originalFilename: row.original_filename,
    pointLabel: row.point_label ?? null,
    pointTimeStart: row.point_time_start ?? null,
    pointTimeEnd: row.point_time_end ?? null,
  }
}

/** Reintenta UNA vez tras una pausa corta — el respaldo del carrito hacia
 * Supabase es de "mejor esfuerzo" (la UI ya respondió al instante con el
 * store local), pero una falla puramente transitoria del backend (ej. un
 * 504 momentáneo mientras el proyecto "despierta" de estar inactivo, que
 * Chrome a veces reporta engañosamente como error de CORS) no debería
 * dejar ese cambio sin sincronizar para siempre — con un solo reintento
 * alcanza para los casos reales que hemos visto. */
async function withRetry(fn: () => PromiseLike<{ error: unknown }>): Promise<{ error: unknown }> {
  const first = await fn()
  if (!first.error) return first
  await new Promise((r) => setTimeout(r, 1500))
  return fn()
}

/** IDs de fotos agregadas localmente que TODAVÍA no se confirman
 * sincronizadas con el servidor — persistido en localStorage (no solo en
 * memoria) para sobrevivir un refresh de página.
 *
 * Por qué existe: antes, `initialSync` solo volvía a "subir" items locales
 * la primerísima vez que este navegador sincronizaba (`migratedKey`) — de
 * ahí en adelante, si un `upsert` fallaba (como el 504 que se vio, o el
 * error real de "columna point_label no encontrada" mientras la migración
 * 0040 no se había corrido), esa foto quedaba en el store local pero NUNCA
 * llegaba al servidor. Al recargar la página, `initialSync` traía el
 * carrito del SERVIDOR (que no tenía esa foto) y sobrescribía el store
 * local con eso — la foto agregada "desaparecía" del carrito.
 *
 * Con este set persistido, `initialSync` sabe distinguir "esta foto no
 * está en el servidor porque el push falló y hay que reintentar" de "esta
 * foto no está en el servidor porque se borró desde OTRO dispositivo" (que
 * NUNCA estuvo en este set) — solo la primera se vuelve a empujar al
 * recargar. */
function readPendingIds(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function writePendingIds(key: string, ids: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(ids)))
  } catch {
    // Sin persistencia de "pendientes" en el peor caso, pero no rompe nada.
  }
}

/** Sincroniza el carrito (zustand + localStorage, `cartStore.ts`) con la
 * tabla `cart_items` en Supabase — antes el carrito vivía SOLO en el
 * dispositivo, así que abrir sesión desde el celular y desde la
 * computadora mostraba dos carritos distintos sin relación entre sí.
 *
 * El store local se queda siendo la fuente de verdad para la UI (responde
 * al instante, sin esperar ida y vuelta al servidor); esto solo escucha sus
 * cambios y los refleja en Supabase, y escucha Supabase (realtime) para
 * reflejar en el store local lo que se agregó/quitó desde OTRO
 * dispositivo. `remoteIdsRef`/`syncingRef` existen para no entrar en un
 * loop (remoto → local → "cambio local" → remoto → ...). */
export function useCartSync(userId: string | undefined) {
  const syncingRef = useRef(false)
  const remoteIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!userId) return
    const uid = userId
    let active = true

    // Solo la PRIMERA vez que este navegador sincroniza este usuario tiene
    // sentido "subir" TODO lo que ya había en el store local sin filtrar
    // (ej. agregado antes de iniciar sesión) — de ahí en adelante, el
    // reintento de pendientes (ver `pendingKey` arriba) se encarga de
    // cualquier foto que se agregue después y falle al sincronizar.
    const migratedKey = `motoshots_cart_migrated_${uid}`
    const pendingKey = `motoshots_cart_pending_${uid}`

    async function initialSync() {
      const { data, error } = await supabase.from('cart_items').select('*').eq('profile_id', uid)
      if (error || !active) return
      const serverItems = (data as CartRow[]).map(fromRow)
      remoteIdsRef.current = new Set(serverItems.map((i) => i.photoId))

      let finalItems = serverItems
      let alreadyMigrated = false
      try {
        alreadyMigrated = localStorage.getItem(migratedKey) === '1'
      } catch {
        alreadyMigrated = true // si localStorage falla, mejor no insistir en "migrar" cada vez
      }

      if (!alreadyMigrated) {
        const localOnly = useCartStore.getState().items.filter((i) => !remoteIdsRef.current.has(i.photoId))
        if (localOnly.length) {
          for (const i of localOnly) remoteIdsRef.current.add(i.photoId)
          const { error: upsertError } = await supabase.from('cart_items').upsert(localOnly.map((i) => toRow(uid, i)))
          if (!upsertError) finalItems = serverItems.concat(localOnly)
          else writePendingIds(pendingKey, new Set(localOnly.map((i) => i.photoId)))
        }
        try {
          localStorage.setItem(migratedKey, '1')
        } catch {
          // No pasa nada grave si no se puede recordar — en el peor caso
          // se repite esta migración una vez más la próxima vez.
        }
      } else {
        // Reintento de pendientes: fotos que este MISMO dispositivo agregó
        // en una sesión anterior y que nunca confirmó sincronizadas (el
        // `upsert` falló y no hubo otra oportunidad hasta ahora). No se
        // toca nada que no esté en este set — una foto ausente del
        // servidor que NUNCA estuvo pendiente se asume borrada a propósito
        // desde otro dispositivo, no se resucita.
        const pendingIds = readPendingIds(pendingKey)
        const stillPending = useCartStore
          .getState()
          .items.filter((i) => pendingIds.has(i.photoId) && !remoteIdsRef.current.has(i.photoId))
        if (stillPending.length) {
          for (const i of stillPending) remoteIdsRef.current.add(i.photoId)
          const { error: upsertError } = await withRetry(() => supabase.from('cart_items').upsert(stillPending.map((i) => toRow(uid, i))))
          if (!upsertError) {
            finalItems = serverItems.concat(stillPending)
            const next = new Set(pendingIds)
            for (const i of stillPending) next.delete(i.photoId)
            writePendingIds(pendingKey, next)
          }
        }
      }

      if (!active) return
      syncingRef.current = true
      useCartStore.setState({ items: finalItems })
      syncingRef.current = false
    }
    initialSync()

    const channel = supabase
      .channel(`cart-${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cart_items', filter: `profile_id=eq.${uid}` },
        (payload) => {
          const item = fromRow(payload.new as CartRow)
          if (remoteIdsRef.current.has(item.photoId)) return
          remoteIdsRef.current.add(item.photoId)
          syncingRef.current = true
          useCartStore.setState((s) => (s.items.some((i) => i.photoId === item.photoId) ? s : { items: [...s.items, item] }))
          syncingRef.current = false
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'cart_items', filter: `profile_id=eq.${uid}` },
        (payload) => {
          const photoId = (payload.old as { photo_id: string }).photo_id
          remoteIdsRef.current.delete(photoId)
          syncingRef.current = true
          useCartStore.setState((s) => ({ items: s.items.filter((i) => i.photoId !== photoId) }))
          syncingRef.current = false
        },
      )
      .subscribe()

    const unsubscribe = useCartStore.subscribe((state, prevState) => {
      if (syncingRef.current) return
      const prevIds = new Set(prevState.items.map((i) => i.photoId))
      const nextIds = new Set(state.items.map((i) => i.photoId))
      const added = state.items.filter((i) => !prevIds.has(i.photoId))
      const removedIds = prevState.items.filter((i) => !nextIds.has(i.photoId)).map((i) => i.photoId)

      if (added.length) {
        for (const i of added) remoteIdsRef.current.add(i.photoId)
        // Se marca "pendiente" ANTES de intentar el upsert (no después de
        // que falle) — así, si el usuario recarga la página en el medio
        // (antes de que el reintento resuelva), el próximo `initialSync`
        // igual sabe que esta foto necesita reintentarse.
        const pending = readPendingIds(pendingKey)
        for (const i of added) pending.add(i.photoId)
        writePendingIds(pendingKey, pending)

        withRetry(() => supabase.from('cart_items').upsert(added.map((i) => toRow(uid, i)))).then(({ error }) => {
          if (error) {
            console.error('No se pudo sincronizar el carrito (agregar):', error)
            return
          }
          const next = readPendingIds(pendingKey)
          for (const i of added) next.delete(i.photoId)
          writePendingIds(pendingKey, next)
        })
      }
      if (removedIds.length) {
        for (const id of removedIds) remoteIdsRef.current.delete(id)
        // Si se quita una foto que todavía estaba "pendiente" (nunca llegó
        // a sincronizar), ya no hace falta reintentar subirla — el usuario
        // decidió que no la quiere.
        const pending = readPendingIds(pendingKey)
        for (const id of removedIds) pending.delete(id)
        writePendingIds(pendingKey, pending)

        withRetry(() => supabase.from('cart_items').delete().eq('profile_id', uid).in('photo_id', removedIds)).then(({ error }) => {
          if (error) console.error('No se pudo sincronizar el carrito (quitar):', error)
        })
      }
    })

    return () => {
      active = false
      supabase.removeChannel(channel)
      unsubscribe()
    }
  }, [userId])
}
