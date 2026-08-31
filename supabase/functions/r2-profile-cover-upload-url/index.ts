// Edge Function: genera una URL firmada temporal para subir la foto de
// portada del perfil del fotógrafo autenticado (bucket público). Mismo
// patrón que r2-avatar-upload-url — cada quien solo puede subir la suya.
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

  const { fileName, contentType } = await req.json()
  if (!fileName || !contentType) return json({ error: 'Faltan fileName o contentType' }, 400)
  if (!contentType.startsWith('image/')) return json({ error: 'La portada debe ser una imagen' }, 400)

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const coverPath = `profile-covers/${user.id}/${crypto.randomUUID()}-${safeName}`

  const r2 = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  })

  const objectUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${coverPath}`
  const signed = await r2.sign(objectUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    aws: { signQuery: true },
  })

  return json({ uploadUrl: signed.url, coverPath })
})
