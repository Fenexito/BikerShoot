// Edge Function: URL firmada temporal (10 min) para que el FOTÓGRAFO vea
// el comprobante de transferencia que el biker subió para uno de sus
// pedidos. Solo el fotógrafo dueño de ese comprobante puede pedirlo.
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

  const { orderId } = await req.json()
  if (!orderId) return json({ error: 'Falta orderId' }, 400)

  const { data: proof, error: proofError } = await supabase
    .from('order_payment_proofs')
    .select('proof_path, photographer_id')
    .eq('order_id', orderId)
    .eq('photographer_id', user.id)
    .maybeSingle()

  // 200 con `viewUrl: null` en vez de un status de error — así el cliente
  // no tiene que lidiar con leer el cuerpo de una respuesta de error de
  // Supabase Functions solo para distinguir "no autorizado" de "todavía no
  // sube el comprobante" (un caso normal y esperable, no una falla real).
  if (proofError || !proof) return json({ viewUrl: null })

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
