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
    // sentido "subir" lo que ya había en el store local (ej. agregado antes
    // de iniciar sesión) — de ahí en adelante, el servidor manda. Sin este
    // límite, un dispositivo que se pierde una eliminación hecha en OTRO
    // (por estar cerrado o sin conexión en ese momento) la "revivía" al
    // reconectarse: su copia local todavía tenía la foto que el servidor ya
    // no tenía, y ese sobrante se interpretaba como "algo nuevo que subir",
    // resucitando la foto en el servidor (y de ahí, en todos los
    // dispositivos) en vez de simplemente adoptar lo que el servidor ya
    // sabe que es verdad.
    const migratedKey = `motoshots_cart_migrated_${uid}`

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
        }
        try {
          localStorage.setItem(migratedKey, '1')
        } catch {
          // No pasa nada grave si no se puede recordar — en el peor caso
          // se repite esta migración una vez más la próxima vez.
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
        supabase
          .from('cart_items')
          .upsert(added.map((i) => toRow(uid, i)))
          .then(({ error }) => {
            if (error) console.error('No se pudo sincronizar el carrito (agregar):', error)
          })
      }
      if (removedIds.length) {
        for (const id of removedIds) remoteIdsRef.current.delete(id)
        supabase
          .from('cart_items')
          .delete()
          .eq('profile_id', uid)
          .in('photo_id', removedIds)
          .then(({ error }) => {
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
