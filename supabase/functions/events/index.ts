// supabase/functions/events/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    // Incluimos ambas variantes por si acaso (algunos navegadores/proxies son quisquillosos)
    "Access-Control-Allow-Headers":
      "authorization, Authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  };
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

/** Saca el user_id del JWT si viene en Authorization: Bearer <token> */
async function getUserIdFromAuth(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const whoResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: auth,
      apikey: SERVICE_ROLE,
    },
  });
  if (!whoResp.ok) return null;
  const me = await whoResp.json();
  return me?.id || null;
}

/** Regresa los segmentos SUBSIGUIENTES al nombre de la función (events) */
function subpathSegments(req: Request): string[] {
  const { pathname } = new URL(req.url);
  // Ej: /functions/v1/events/profile/catalog  -> ["functions","v1","events","profile","catalog"]
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("events");
  if (idx === -1) return [];
  return parts.slice(idx + 1); // ["profile","catalog"] o ["123"] ...
}

serve(
  async (req) => {
    // Preflight CORS SIEMPRE 200 (el gateway primero)
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders() });
    }

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const segs = subpathSegments(req);
    const a = segs[0] || null;
    const b = segs[1] || null;

    try {
      /* ========= PERFIL: catálogo del fotógrafo =========
         GET /functions/v1/events/profile/catalog
         Lee photographer_profile.puntos (jsonb) del usuario autenticado.
      */
      if (req.method === "GET" && a === "profile" && b === "catalog") {
        const userId = await getUserIdFromAuth(req);
        if (!userId) {
          // Si preferís forzar auth, devolvé 401. En dev: vacío para no romper el front.
          return json({ routes: [], hotspots: [] }, 200);
        }

        const { data: profile, error: profErr } = await supa
          .from("photographer_profile")
          .select("puntos")
          .eq("user_id", userId)
          .maybeSingle();
        if (profErr) return json({ error: profErr.message }, 400);

        const puntos = Array.isArray(profile?.puntos) ? (profile!.puntos as any[]) : [];

        // Rutas únicas por campo "ruta"
        const routeSet = new Map<string, { id: string; name: string }>();
        for (const p of puntos) {
          const ruta = (p?.ruta ?? "").toString().trim();
          if (!ruta) continue;
          if (!routeSet.has(ruta)) {
            routeSet.set(ruta, { id: crypto.randomUUID(), name: ruta });
          }
        }
        const routes = Array.from(routeSet.values());

        // Hotspots formateados
        const hotspots = puntos.map((p: any) => {
          const horarios = Array.isArray(p?.horarios) ? p.horarios : [];
          // Si querés priorizar "Domingo": buscá ese primero
          const dom = horarios.find((h: any) => (h?.dia ?? "").toLowerCase() === "domingo");
          const h0 = dom || horarios[0] || {};
          const default_start = (h0?.inicio ?? "06:00").toString();
          const default_end = (h0?.fin ?? "12:00").toString();

          return {
            id: (p?.id ?? crypto.randomUUID()).toString(),
            name: (p?.nombre ?? "Punto").toString(),
            route_name: (p?.ruta ?? "").toString(),
            lat: p?.lat != null ? Number(p.lat) : null,
            lng: p?.lon != null ? Number(p.lon) : null, // lon -> lng
            default_start,
            default_end,
            raw: p,
          };
        });

        return json({ routes, hotspots });
      }

      /* ========= LISTA eventos =========
         GET /functions/v1/events
      */
      if (req.method === "GET" && !a) {
        const { data, error } = await supa
          .from("event")
          .select("id, nombre, fecha, ruta, estado, precioBase, notas")
          .order("fecha", { ascending: false });
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }

      /* ========= DETALLE evento =========
         GET /functions/v1/events/:id
      */
      if (req.method === "GET" && a && !b) {
        const id = a;
        const { data, error } = await supa
          .from("event")
          .select("id, nombre, fecha, ruta, estado, precioBase, notas")
          .eq("id", id)
          .maybeSingle();
        if (error) return json({ error: error.message }, 400);
        if (!data) return json({ error: "Evento no encontrado" }, 404);
        return json(data);
      }

      /* ========= CREAR evento =========
         POST /functions/v1/events
      */
      if (req.method === "POST" && !a) {
        const body = await req.json();
        const nuevo = {
          nombre: body?.nombre ?? null,
          fecha: body?.fecha ?? null,
          ruta: body?.ruta ?? null,
          estado: body?.estado ?? "borrador",
          precioBase: body?.precioBase ?? 50,
          notas: body?.notas ?? "",
        };
        const { data, error } = await supa
          .from("event")
          .insert([nuevo])
          .select("id, nombre, fecha, ruta, estado, precioBase, notas")
          .single();
        if (error) return json({ error: error.message }, 400);
        return json(data, 201);
      }

      /* ========= ACTUALIZAR evento =========
         PUT /functions/v1/events/:id
      */
      if (req.method === "PUT" && a && !b) {
        const id = a;
        const body = await req.json();
        const patch: Record<string, unknown> = {};
        if ("nombre" in body) patch.nombre = body.nombre;
        if ("fecha" in body) patch.fecha = body.fecha;
        if ("ruta" in body) patch.ruta = body.ruta;
        if ("estado" in body) patch.estado = body.estado;
        if ("status" in body) patch.estado = body.status; // alias
        if ("precioBase" in body) patch.precioBase = body.precioBase;
        if ("notas" in body) patch.notas = body.notas;

        const { data, error } = await supa
          .from("event")
          .update(patch)
          .eq("id", id)
          .select("id, nombre, fecha, ruta, estado, precioBase, notas")
          .single();
        if (error) return json({ error: error.message }, 400);
        return json(data);
      }

      /* ========= ELIMINAR evento =========
         DELETE /functions/v1/events/:id
      */
      if (req.method === "DELETE" && a && !b) {
        const id = a;
        const { error } = await supa.from("event").delete().eq("id", id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      return json({ error: "Ruta o método no válido" }, 404);
    } catch (e: any) {
      return json({ error: String(e?.message || e) }, 500);
    }
  },
  { onListen: () => console.log("events function up") },
);
