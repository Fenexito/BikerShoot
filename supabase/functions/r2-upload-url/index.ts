// Edge Function: genera DOS URLs firmadas temporales para subir UNA foto
// directo a Cloudflare R2 desde el navegador del fotógrafo — una para el
// original (bucket privado) y otra para el preview con marca de agua que
// el navegador genera antes de subir (bucket público).
//
// Por qué existe esta función en vez de subir directo desde el front-end:
// la Secret Access Key de R2 nunca puede vivir en el navegador (cualquiera
// podría leerla y borrar/reemplazar todo el bucket). Esta función corre en
// el servidor de Supabase, firma las URLs usando la Secret Key (que solo
// ella conoce, guardada como "secret" de Supabase), y le devuelve al
// navegador URLs que solo sirven para subir ESE archivo específico, por
// tiempo limitado.
//
// Secrets necesarios (Supabase Dashboard > Edge Functions > Secrets, o
// `supabase secrets set`): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY, R2_BUCKET (bucket público de previews, el de
// siempre), R2_ORIGINALS_BUCKET (bucket privado nuevo, nunca público).
// SUPABASE_URL y SUPABASE_ANON_KEY los inyecta Supabase automáticamente,
// no hay que configurarlos.

import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// .trim() defensivo: es muy fácil que un copy/paste de una credencial
// incluya un salto de línea o espacio invisible al final, lo que corrompe
// la firma AWS4 por completo (así se vería un 400 de R2 sin pista clara).
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const { fileName, contentType, eventId } = await req.json()
  if (!fileName || !contentType || !eventId) {
    return new Response(JSON.stringify({ error: 'Faltan fileName, contentType o eventId' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  // Solo el dueño del evento puede subir fotos a él.
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, photographer_id')
    .eq('id', eventId)
    .single()

  if (eventError || !event || event.photographer_id !== user.id) {
    return new Response(JSON.stringify({ error: 'No autorizado para subir fotos a este evento' }), {
      status: 403,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const uniqueName = `${crypto.randomUUID()}-${safeName}`
  const storagePath = `${user.id}/${eventId}/${uniqueName}`
  // El preview siempre se genera y sube como JPEG en el navegador (ver
  // StudioUpload.tsx), sin importar el formato del original.
  const previewPath = `previews/${user.id}/${eventId}/${uniqueName}.jpg`

  const r2 = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  })

  async function signPut(bucket: string, key: string, type: string) {
    const objectUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}/${key}`
    const signed = await r2.sign(objectUrl, {
      method: 'PUT',
      headers: { 'Content-Type': type },
      aws: { signQuery: true },
    })
    return signed.url
  }

  const [originalUploadUrl, previewUploadUrl] = await Promise.all([
    signPut(R2_ORIGINALS_BUCKET, storagePath, contentType),
    signPut(R2_BUCKET, previewPath, 'image/jpeg'),
  ])

  return new Response(JSON.stringify({ originalUploadUrl, previewUploadUrl, storagePath, previewPath }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
})
