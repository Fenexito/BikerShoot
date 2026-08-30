// Edge Function: genera una URL firmada temporal para que el fotógrafo
// suba el PNG que se usará como marca de agua de TODAS las fotos de un
// evento (hasta que lo cambie). Se sube al bucket público — no es
// información sensible, es solo su logo, y el navegador necesita poder
// leerlo directamente para dibujarlo sobre cada preview al subir fotos.
//
// Secrets: los mismos que r2-upload-url (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY, R2_BUCKET).

import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function env(name: string): string {
  return (Deno.env.get(name) ?? '').trim()
}

const R2_ACCOUNT_ID = env('R2_ACCOUNT_ID')
const R2_ACCESS_KEY_ID = env('R2_ACCESS_KEY_ID')
const R2_SECRET_ACCESS_KEY = env('R2_SECRET_ACCESS_KEY')
const R2_BUCKET = env('R2_BUCKET')
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

  const { eventId, fileName, contentType } = await req.json()
  if (!eventId || !fileName || !contentType) {
    return json({ error: 'Faltan eventId, fileName o contentType' }, 400)
  }
  if (contentType !== 'image/png') {
    return json({ error: 'La marca de agua debe ser un PNG' }, 400)
  }

  // Solo el dueño del evento puede cambiar su marca de agua.
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, photographer_id')
    .eq('id', eventId)
    .single()

  if (eventError || !event || event.photographer_id !== user.id) {
    return json({ error: 'No autorizado para modificar este evento' }, 403)
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const watermarkPath = `watermarks/${user.id}/${eventId}/${crypto.randomUUID()}-${safeName}`

  const r2 = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  })

  const objectUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${watermarkPath}`
  const signed = await r2.sign(objectUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    aws: { signQuery: true },
  })

  return json({ uploadUrl: signed.url, watermarkPath })
})
