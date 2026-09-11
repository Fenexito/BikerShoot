import { supabase } from '../../lib/supabase'

// Alfabeto sin caracteres ambiguos (sin 0/O, 1/l/I) — el código puede
// terminar escrito a mano o leído en voz alta, no solo pegado.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
const CODE_LENGTH = 7

function randomCode() {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return out
}

/** Crea un link corto para compartir una foto — guarda los filtros de
 * búsqueda activos (para reconstruir "esta foto y las de alrededor" si
 * quien lo abre ya tiene sesión) junto al id de la foto a resaltar.
 * Reintenta con un código nuevo si por casualidad ya existe uno igual. */
export async function createSharedLink(photoId: string, searchParams: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode()
    const { error } = await supabase.from('shared_links').insert({ code, photo_id: photoId, search_params: searchParams })
    if (!error) return code
    if (error.code !== '23505') throw new Error(error.message)
  }
  throw new Error('No se pudo generar un enlace único, intenta de nuevo.')
}

export interface ResolvedSharedLink {
  photoId: string
  searchParams: string
}

/** Resuelve un código a su foto + filtros originales — `null` si el link
 * no existe (o ya fue borrado, ej. la foto se eliminó y arrastró consigo
 * el link por `on delete cascade`). */
export async function resolveSharedLink(code: string): Promise<ResolvedSharedLink | null> {
  const { data, error } = await supabase.from('shared_links').select('photo_id, search_params').eq('code', code).maybeSingle()
  if (error || !data) return null
  return { photoId: data.photo_id, searchParams: data.search_params ?? '' }
}
