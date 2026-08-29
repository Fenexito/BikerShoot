// Edge Function: genera una URL firmada temporal para subir UNA foto
// directo a Cloudflare R2 desde el navegador del fotógrafo.
//
// Por qué existe esta función en vez de subir directo desde el front-end:
// la Secret Access Key de R2 nunca puede vivir en el navegador (cualquiera
// podría leerla y borrar/reemplazar todo el bucket). Esta función corre en
// el servidor de Supabase, firma la URL usando la Secret Key (que solo ella
// conoce, guardada como "secret" de Supabase), y le devuelve al navegador
// una URL que solo sirve para subir ESE archivo específico, por tiempo
// limitado.
//
// Secrets necesarios (Supabase Dashboard > Edge Functions > Secrets, o
// `supabase secrets set`): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY, R2_BUCKET.
// SUPABASE_URL y SUPABASE_ANON_KEY los inyecta Supabase automáticamente,
// no hay que configurarlos.

import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')!
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')!
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!
const R2_BUCKET = Deno.env.get('R2_BUCKET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

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
  const storagePath = `${user.id}/${eventId}/${crypto.randomUUID()}-${safeName}`

  const r2 = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  })

  const objectUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${storagePath}`

  const signed = await r2.sign(objectUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    aws: { signQuery: true },
  })

  return new Response(JSON.stringify({ uploadUrl: signed.url, storagePath }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
})
