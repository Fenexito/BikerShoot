// Edge Function: genera una URL firmada para que el BIKER suba la captura
// del comprobante de transferencia de un pedido — un archivo por (pedido,
// fotógrafo), ya que un pedido con varios fotógrafos implica una
// transferencia (y un comprobante) por cada uno.
//
// Va al bucket de originales (privado, no público) — mismo bucket que
// raw_path/delivered_path — porque un comprobante bancario no es algo que
// deba quedar accesible sin firma, a diferencia de portadas o previews.
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

  const { orderId, photographerId, fileName, contentType } = await req.json()
  if (!orderId || !photographerId || !fileName || !contentType) {
    return json({ error: 'Faltan orderId, photographerId, fileName o contentType' }, 400)
  }
  if (!contentType.startsWith('image/')) {
    return json({ error: 'El comprobante debe ser una imagen' }, 400)
  }

  const { data: order, error: orderError } = await supabase.from('orders').select('id, biker_id').eq('id', orderId).single()
  if (orderError || !order || order.biker_id !== user.id) {
    return json({ error: 'No autorizado para este pedido' }, 403)
  }

  const { data: item, error: itemError } = await supabase
    .from('order_items')
    .select('id')
    .eq('order_id', orderId)
    .eq('photographer_id', photographerId)
    .limit(1)
    .maybeSingle()
  if (itemError || !item) {
    return json({ error: 'Ese fotógrafo no tiene fotos en este pedido' }, 403)
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const proofPath = `payment-proofs/${orderId}/${photographerId}/${crypto.randomUUID()}-${safeName}`

  const r2 = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  })

  const objectUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_ORIGINALS_BUCKET}/${proofPath}`
  const signed = await r2.sign(objectUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    aws: { signQuery: true },
  })

  return json({ uploadUrl: signed.url, proofPath })
})
