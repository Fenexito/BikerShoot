// Edge Function: libera espacio de fotos YA VENDIDAS Y ENTREGADAS
// (delivered_path no nulo) — borra el preview y/o el respaldo crudo en R2
// según se pida, y limpia esas columnas en la fila. `delivered_path` y la
// fila NUNCA se tocan: el comprador ya tiene su copia final para siempre
// (garantía de descarga permanente), así que esto solo limpia las copias
// previas a la venta que ya no hace falta conservar.
//
// Fotos sin delivered_path (nunca vendidas, o vendidas pero aún sin
// entregar) quedan completamente fuera de alcance — el filtro
// `delivered_path is not null` en la consulta es la única condición que
// decide qué se puede tocar.
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

type Clear = 'preview' | 'raw' | 'both'

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

  const { eventId, pointId, clear } = (await req.json()) as { eventId?: string; pointId?: string; clear?: Clear }
  if (!eventId || !clear || !['preview', 'raw', 'both'].includes(clear)) {
    return json({ error: 'Faltan eventId o clear (preview|raw|both)' }, 400)
  }

  // Verifica que el evento sea del fotógrafo que llama.
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, photographer_id')
    .eq('id', eventId)
    .single()
  if (eventError || !event || event.photographer_id !== user.id) {
    return json({ error: 'No autorizado para este evento' }, 403)
  }

  let query = supabase
    .from('photos')
    .select('id, preview_path, raw_path, preview_size_bytes, raw_size_bytes')
    .eq('event_id', eventId)
    .eq('photographer_id', user.id)
    .not('delivered_path', 'is', null)
  if (pointId) query = query.eq('point_id', pointId)

  const { data: photos, error: photosError } = await query
  if (photosError) return json({ error: photosError.message }, 500)
  if (!photos || photos.length === 0) return json({ cleaned: 0, bytesFreed: 0 })

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
      // sigue igual si el objeto ya no estaba
    }
  }

  let cleaned = 0
  let bytesFreed = 0

  for (const photo of photos) {
    const update: Record<string, unknown> = {}
    let touched = false

    if ((clear === 'preview' || clear === 'both') && photo.preview_path) {
      await deleteObject(R2_BUCKET, photo.preview_path)
      update.preview_path = null
      update.preview_size_bytes = 0
      bytesFreed += photo.preview_size_bytes ?? 0
      touched = true
    }
    if ((clear === 'raw' || clear === 'both') && photo.raw_path) {
      await deleteObject(R2_ORIGINALS_BUCKET, photo.raw_path)
      update.raw_path = null
      update.raw_size_bytes = 0
      bytesFreed += photo.raw_size_bytes ?? 0
      touched = true
    }

    if (!touched) continue

    const { error: updateError } = await supabase.from('photos').update(update).eq('id', photo.id)
    if (!updateError) cleaned++
  }

  return json({ cleaned, bytesFreed })
})
