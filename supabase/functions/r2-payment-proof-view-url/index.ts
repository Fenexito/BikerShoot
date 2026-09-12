// Edge Function: URL firmada temporal (10 min) para ver el comprobante de
// transferencia de un pedido — la usan TANTO el fotógrafo dueño de ese
// comprobante COMO el biker que lo subió (para poder revisar lo que ya
// mandó, o reemplazarlo si se equivocó). Como un pedido puede tener varios
// fotógrafos, `photographerId` dice CUÁL comprobante se pide; si no se
// manda, se asume que el que llama ES el fotógrafo (compatibilidad con el
// caso de un solo fotógrafo, ya en uso desde el portal Studio).
//
// Secrets: los mismos que r2-raw-download-url (R2_ACCOUNT_ID,
// R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ORIGINALS_BUCKET).

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

  const { orderId, photographerId } = await req.json()
  if (!orderId) return json({ error: 'Falta orderId' }, 400)

  // Si no se especifica, se asume que quien llama ES el fotógrafo dueño
  // del comprobante — mantiene funcionando sin cambios al portal Studio,
  // que ya invoca esta función solo con `orderId`.
  const targetPhotographerId = photographerId ?? user.id

  const { data: proof, error: proofError } = await supabase
    .from('order_payment_proofs')
    .select('proof_path, photographer_id')
    .eq('order_id', orderId)
    .eq('photographer_id', targetPhotographerId)
    .maybeSingle()

  // 200 con `viewUrl: null` en vez de un status de error — así el cliente
  // no tiene que lidiar con leer el cuerpo de una respuesta de error de
  // Supabase Functions solo para distinguir "no autorizado" de "todavía no
  // sube el comprobante" (un caso normal y esperable, no una falla real).
  if (proofError || !proof) return json({ viewUrl: null })

  // Autoriza a CUALQUIERA de los dos lados de este comprobante: el
  // fotógrafo dueño, o el biker dueño del pedido (RLS ya se lo permitiría
  // vía la policy de la tabla, pero acá se resuelve explícito porque
  // necesitamos firmar la URL con las credenciales de R2, no con las del
  // usuario).
  const isPhotographerOwner = user.id === proof.photographer_id
  if (!isPhotographerOwner) {
    const { data: order, error: orderError } = await supabase.from('orders').select('id, biker_id').eq('id', orderId).single()
    if (orderError || !order || order.biker_id !== user.id) return json({ viewUrl: null })
  }

  const r2 = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  })

  const objectUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_ORIGINALS_BUCKET}/${proof.proof_path}?X-Amz-Expires=600`
  const signed = await r2.sign(objectUrl, {
    method: 'GET',
    aws: { signQuery: true },
  })

  return json({ viewUrl: signed.url })
})
