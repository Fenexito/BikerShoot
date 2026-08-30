// Edge Function: genera la URL firmada temporal para subir el PREVIEW de
// una foto (reducido + marca de agua, generado en el navegador antes de
// subir) al bucket público. Opcionalmente, si el fotógrafo pide respaldar
// también el original sin editar (includeRaw), firma una segunda URL hacia
// el bucket privado — ese respaldo es solo suyo, nunca se vende ni se
// entrega (para eso existe r2-deliver-upload-url, después de la compra).
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
// siempre), R2_ORIGINALS_BUCKET (bucket privado, para respaldos y entregas).
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

  const { fileName, contentType, eventId, includeRaw } = await req.json()
  if (!fileName || !contentType || !eventId) {
    return json({ error: 'Faltan fileName, contentType o eventId' }, 400)
  }

  // Solo el dueño del evento puede subir fotos a él.
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, photographer_id')
    .eq('id', eventId)
    .single()

  if (eventError || !event || event.photographer_id !== user.id) {
    return json({ error: 'No autorizado para subir fotos a este evento' }, 403)
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const uniqueName = `${crypto.randomUUID()}-${safeName}`
  // El preview siempre se genera y sube como JPEG en el navegador (ver
  // StudioUpload.tsx), sin importar el formato del original.
  const previewName = uniqueName.replace(/\.[a-zA-Z0-9]+$/, '') + '.jpg'
  const previewPath = `previews/${user.id}/${eventId}/${previewName}`
  const rawPath = `raw/${user.id}/${eventId}/${uniqueName}`

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

  const previewUploadUrl = await signPut(R2_BUCKET, previewPath, 'image/jpeg')

  if (!includeRaw) {
    return json({ previewUploadUrl, previewPath })
  }

  const rawUploadUrl = await signPut(R2_ORIGINALS_BUCKET, rawPath, contentType)
  return json({ previewUploadUrl, previewPath, rawUploadUrl, rawPath })
})
