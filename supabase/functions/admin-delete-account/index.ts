// Edge Function: un admin elimina la cuenta de OTRO usuario (biker o
// fotógrafo) por completo — fila de auth.users + lo que dependa de él por
// cascada en public.*. Mismo motivo que delete-account (el cliente nunca
// tiene la service role), pero aquí el llamante y el objetivo son
// personas distintas, así que primero se verifica que quien llama sea
// admin antes de tocar nada.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (mismos que delete-account
// y check-email-exists — nunca exponer esta key al cliente).

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

  const { targetId } = await req.json().catch(() => ({ targetId: null }))
  if (!targetId || typeof targetId !== 'string') return json({ error: 'Falta targetId' }, 400)

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } })
  const {
    data: { user: caller },
    error: callerError,
  } = await anon.auth.getUser()
  if (callerError || !caller) return json({ error: 'No autenticado' }, 401)

  if (caller.id === targetId) {
    return json({ error: 'Para eliminar tu propia cuenta usa la opción de tu perfil, no esta.' }, 400)
  }

  const { data: callerProfile, error: profileError } = await anon.from('profiles').select('role').eq('id', caller.id).single()
  if (profileError || callerProfile?.role !== 'admin') return json({ error: 'Solo un admin puede eliminar otras cuentas' }, 403)

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { error: deleteError } = await admin.auth.admin.deleteUser(targetId)
  if (deleteError) return json({ error: deleteError.message }, 500)

  return json({ ok: true })
})
