// Edge Function: borra TODAS las fotos no vendidas de un punto — filas de
// `photos` + sus archivos reales en R2 (preview público, raw privado si
// existe). Nunca borra el punto (`event_points`) en sí, solo sus fotos.
//
// La protección clave ya vive en la base de datos: order_items.photo_id
// no tiene "on delete cascade", así que Postgres rechaza por sí solo
// cualquier intento de borrar una foto ya vendida — esta función solo
// necesita intentar el delete de cada fila y contar cuáles fallaron por
// esa razón, sin lógica de permisos nueva que mantener.
//
// Secrets: los mismos que r2-upload-url (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ORIGINALS_BUCKET).

import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function env(name: string): string {
  return (Deno.env.get(name) ?? '').trim()
}

const R2_ACCOUNT_ID = env('R2_ACCOUNT_ID')
const R2_ACCESS_KEY_ID = env('R2_ACCESS_KEY_ID')
const R2_SECRET_ACCESS_KEY = env('R2_SECRET_ACCESS_KEY')
const R2_BUCKET = env('R2_BUCKET')
const R2_ORIGINALS_BUCKET = env('R2_ORIGINALS_BUCKET')
const SUPABASE_URL = env('SUPABASE_URL')
const SUPABASE_ANON_KEY = env('SUPABASE_ANON_KEY')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'No autenticado' }, 401)

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) return json({ error: 'No autenticado' }, 401)

  const { pointId } = await req.json()
  if (!pointId) return json({ error: 'Falta pointId' }, 400)

  // Verifica que el punto pertenezca a un evento del fotógrafo que llama.
  const { data: point, error: pointError } = await supabase
    .from('event_points')
    .select('id, event:events(photographer_id)')
    .eq('id', pointId)
    .single()

  const eventPhotographerId = (point?.event as unknown as { photographer_id: string } | null)?.photographer_id
  if (pointError || !point || eventPhotographerId !== user.id) {
    return json({ error: 'No autorizado para este punto' }, 403)
  }

  const { data: photos, error: photosError } = await supabase
    .from('photos')
    .select('id, preview_path, raw_path')
    .eq('point_id', pointId)
    .eq('photographer_id', user.id)

  if (photosError) return json({ error: photosError.message }, 500)
  if (!photos || photos.length === 0) return json({ deleted: 0, skippedSold: 0 })

  const r2 = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  })

  async function deleteObject(bucket: string, key: string) {
    const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}/${key}`
    try {
      await r2.fetch(url, { method: 'DELETE' })
    } catch {
      // No bloquea el borrado de la fila si el objeto ya no existía en R2.
    }
  }

  let deleted = 0
  let skippedSold = 0

  for (const photo of photos) {
    const { error: deleteError } = await supabase.from('photos').delete().eq('id', photo.id)
    if (deleteError) {
      // 23503 = foreign_key_violation — ya fue vendida, se deja intacta.
      skippedSold++
      continue
    }
    deleted++
    if (photo.preview_path) await deleteObject(R2_BUCKET, photo.preview_path)
    if (photo.raw_path) await deleteObject(R2_ORIGINALS_BUCKET, photo.raw_path)
  }

  return json({ deleted, skippedSold })
})
