// Edge Function: promueve una foto ya subida del evento (su respaldo crudo,
// sin marca de agua) a portada pública del evento — copia el objeto del
// bucket protegido (R2_ORIGINALS_BUCKET) al bucket público (R2_BUCKET, el
// mismo que usa r2-cover-upload-url) usando una copia server-side de R2
// (x-amz-copy-source), sin que el archivo pase por el navegador.
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

  const { photoId, eventId } = await req.json()
  if (!photoId || !eventId) return json({ error: 'Faltan photoId o eventId' }, 400)

  const { data: photo, error: photoError } = await supabase
    .from('photos')
    .select('id, raw_path, photographer_id, event_id')
    .eq('id', photoId)
    .single()

  if (photoError || !photo) return json({ error: 'Foto no encontrada' }, 404)
  if (photo.photographer_id !== user.id || photo.event_id !== eventId) return json({ error: 'No autorizado' }, 403)
  if (!photo.raw_path) return json({ error: 'not_backed_up', message: 'Esta foto no tiene respaldo original guardado' }, 409)

  const r2 = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  })

  const ext = photo.raw_path.split('.').pop() ?? 'jpg'
  const coverPath = `covers/${user.id}/${eventId}/${crypto.randomUUID()}.${ext}`
  const destUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${coverPath}`

  const copyRes = await r2.fetch(destUrl, {
    method: 'PUT',
    headers: { 'x-amz-copy-source': `/${R2_ORIGINALS_BUCKET}/${photo.raw_path}` },
  })

  if (!copyRes.ok) {
    const text = await copyRes.text()
    return json({ error: 'No se pudo copiar el archivo a portada', detail: text }, 502)
  }

  return json({ coverPath })
})
