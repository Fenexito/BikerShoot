// Edge Function: dice si un correo ya tiene cuenta — usado por el nuevo
// flujo de login (correo primero, luego contraseña si existe, o invitación
// a registrarse si no). Supabase Auth no expone esto directamente por
// diseño (evita enumeración de usuarios con signInWithPassword, que
// siempre responde "Invalid login credentials" exista o no la cuenta), así
// que usamos el admin API con la service role key: generateLink con type
// "recovery" falla si el usuario no existe, sin enviar ningún correo real.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (la key de servicio,
// nunca la anon — este es el único uso que la necesita en todo el proyecto).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function env(name: string): string {
  return (Deno.env.get(name) ?? '').trim()
}

const SUPABASE_URL = env('SUPABASE_URL')
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

  const { email } = await req.json()
  if (!email || typeof email !== 'string') return json({ error: 'Falta email' }, 400)

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: email.trim().toLowerCase(),
  })

  // Cualquier error de "no existe" cuenta como que no existe; otros errores
  // (rate limit, etc.) los tratamos igual como "no confirmado" para no
  // filtrar detalles — el frontend simplemente ofrece registrarse.
  return json({ exists: !error })
})
