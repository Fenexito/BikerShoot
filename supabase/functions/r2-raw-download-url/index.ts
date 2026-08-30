// Edge Function: genera una URL firmada temporal (10 min) para que el
// fotógrafo descargue su propio respaldo crudo (raw_path) de una foto —
// útil si ya no tiene el archivo original en su cámara/computadora pero sí
// lo respaldó con nosotros al subirla. Solo el dueño de la foto puede
// pedirlo; nunca un biker (para eso existe r2-download-url, que entrega
// delivered_path, no el crudo).
//
// Secrets: los mismos que r2-upload-url (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY, R2_ORIGINALS_BUCKET).

import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function env(name: string): string {
  return (Deno.env.get(name) ?? '').trim()
}

const R2_ACCOUNT_ID = env('R2_ACCOUNT_ID')
const R2_ACCESS_KEY_ID = env('R2_ACCESS_KEY_ID')
const R2_SECRET_ACCESS_KEY = env('R2_SECRET_ACCESS_KEY')
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

  const { photoId } = await req.json()
  if (!photoId) return json({ error: 'Falta photoId' }, 400)

  const { data: photo, error: photoError } = await supabase
    .from('photos')
    .select('id, raw_path, photographer_id')
    .eq('id', photoId)
    .single()

  if (photoError || !photo) return json({ error: 'Foto no encontrada' }, 404)
  if (photo.photographer_id !== user.id) return json({ error: 'No autorizado' }, 403)
  if (!photo.raw_path) return json({ error: 'not_backed_up', message: 'Esta foto no tiene respaldo del original guardado' }, 409)

  const r2 = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  })

  const objectUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_ORIGINALS_BUCKET}/${photo.raw_path}?X-Amz-Expires=600`
  const signed = await r2.sign(objectUrl, {
    method: 'GET',
    aws: { signQuery: true },
  })

  return json({ downloadUrl: signed.url })
})
