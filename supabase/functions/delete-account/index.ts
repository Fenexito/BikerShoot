// Edge Function: elimina la cuenta del usuario autenticado por completo
// (fila de auth.users + lo que dependa de él por cascada en public.*).
// Un usuario nunca puede borrar su propia fila de auth.users desde el
// cliente (requiere la service role), por eso existe esta función — pero
// solo actúa sobre EL MISMO usuario que llama, nunca sobre otro id.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (el único otro lugar que
// ya usa la service role en este proyecto es check-email-exists — mismo
// cuidado: nunca exponer esta key al cliente).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function env(name: string): string {
  return (Deno.env.get(name) ?? '').trim()
}

const SUPABASE_URL = env('SUPABASE_URL')
const SUPABASE_ANON_KEY = env('SUPABASE_ANON_KEY')
const SUPABASE_SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')

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

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } })
  const {
    data: { user },
    error: userError,
  } = await anon.auth.getUser()
  if (userError || !user) return json({ error: 'No autenticado' }, 401)

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) return json({ error: deleteError.message }, 500)

  return json({ ok: true })
})
