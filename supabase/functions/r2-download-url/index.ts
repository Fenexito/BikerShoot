// Edge Function: genera una URL firmada temporal (10 min) para descargar el
// ORIGINAL de una foto (sin marca de agua, resolución completa) desde el
// bucket privado de R2. Solo la usan: el fotógrafo dueño de la foto, o un
// biker que la compró y ya la pagó.
//
// La autorización se apoya en las policies de RLS que YA existen —
// consultamos photos/order_items usando el JWT de quien llama, así que si
// Supabase nos devuelve la fila es porque esa persona tiene derecho a
// verla ("fotografo administra sus fotos", "biker ve items de sus
// pedidos"). No hay lógica de permisos nueva que mantener.
//
// Secrets: los mismos que r2-upload-url (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY, R2_ORIGINALS_BUCKET, R2_BUCKET).

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
    .select('id, storage_path, preview_path, photographer_id')
    .eq('id', photoId)
    .single()

  if (photoError || !photo) return json({ error: 'Foto no encontrada' }, 404)

  const isOwner = photo.photographer_id === user.id

  if (!isOwner) {
    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select('id, status')
      .eq('photo_id', photoId)
      .not('status', 'in', '(pendiente_pago,cancelado)')

    if (orderItemsError || !orderItems || orderItems.length === 0) {
      return json({ error: 'No has comprado esta foto' }, 403)
    }
  }

  // Foto subida antes de separar original/preview: no hay bucket privado
  // que firmar — el front ya sabe que en ese caso debe usar directamente
  // la URL pública de storage_path (r2Url), no llama a esta función.
  if (!photo.preview_path) {
    return json({ error: 'Esta foto no tiene versión protegida por separado' }, 400)
  }

  const r2 = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  })

  const objectUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_ORIGINALS_BUCKET}/${photo.storage_path}?X-Amz-Expires=600`
  const signed = await r2.sign(objectUrl, {
    method: 'GET',
    aws: { signQuery: true },
  })

  return json({ downloadUrl: signed.url })
})
