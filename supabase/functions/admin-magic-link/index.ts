// supabase/functions/admin-magic-link/index.ts
// Deno + Edge Functions
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

serve(
  async (req) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders() });
    }

    try {
      if (req.method !== "POST") {
        return json({ error: "Método no permitido" }, 405);
      }

      const authHeader = req.headers.get("Authorization") || "";
      if (!authHeader.startsWith("Bearer ")) {
        return json(
          { error: "Falta token. Debés iniciar sesión como admin." },
          401,
        );
      }
      const accessToken = authHeader.split(" ")[1];

      // Clientes
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Verificar quién llama
      const whoResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${accessToken}`, apikey: SERVICE_ROLE },
      });
      if (!whoResp.ok) return json({ error: "Token inválido" }, 401);
      const me = (await whoResp.json()) as { id?: string; email?: string };
      const meId = me?.id;
      const meEmail = me?.email || "";

      if (!meId) return json({ error: "No se pudo identificar al usuario" }, 401);

      // ✅ Verificar admin por tabla admin_users (recomendado)
      const { data: isAdminRow, error: roleErr } = await admin
        .from("admin_users")
        .select("user_id")
        .or(`user_id.eq.${meId},email.eq.${meEmail}`)
        .limit(1);
      if (roleErr) return json({ error: roleErr.message }, 500);
      if (!isAdminRow || isAdminRow.length === 0) {
        return json({ error: "No sos admin." }, 403);
      }

      // Si querés usar tu antigua tabla:
      // const { data: myRole } = await admin
      //   .from("user_role")
      //   .select("*")
      //   .eq("user_id", meId)
      //   .eq("role", "admin")
      //   .maybeSingle();
      // if (!myRole) return json({ error: "No sos admin." }, 403);

      // Leer body
      const { email, display_name, redirectTo } = await req.json();
      if (!email || typeof email !== "string") {
        return json({ error: "Email requerido" }, 400);
      }

      // 1) Crear usuario si no existe (email confirmado)
      let userId: string | undefined;
      try {
        const { data } = await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            roles: ["fotografo"],
            display_name: display_name || "",
          },
        });
        userId = data.user?.id;
      } catch (_e) {
        // Ya existe → buscamos su id generando un link temporal
        const look = await admin.auth.admin
          .generateLink({ type: "magiclink", email })
          .catch(() => null);
        if (!look || !look.data?.user?.id) {
          return json(
            { error: "No se pudo crear/ubicar al usuario" },
            500,
          );
        }
        userId = look.data.user.id;
      }

      if (!userId) return json({ error: "No se obtuvo user_id" }, 500);

      // 2) (Opcional) Insertar rol en tu tabla de roles si la usás
      await admin.from("user_role").upsert({ user_id: userId, role: "fotografo" });

      // 3) Asegurar metadata.roles incluye 'fotografo'
      const u = await admin.auth.admin.getUserById(userId);
      const md = (u.data.user?.user_metadata as Record<string, unknown>) || {};
      const existing =
        Array.isArray((md as any).roles)
          ? (md as any).roles
          : (md as any).role
          ? [(md as any).role]
          : [];
      const newRoles = Array.from(new Set([...existing, "fotografo"]));
      await admin.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...md,
          roles: newRoles,
          display_name: display_name || (md as any).display_name || "",
        },
      });

      // 4) Generar MAGIC LINK
      const res = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: redirectTo ? { redirectTo } : undefined,
      });

      const link =
        (res.data?.properties as any)?.action_link || res.data?.action_link;
      if (!link) return json({ error: "No se pudo generar el magic link" }, 500);

      return json({ ok: true, user_id: userId, magic_link: link });
    } catch (e: any) {
      return json({ error: String(e?.message || e) }, 500);
    }
  },
  { onListen: () => console.log("admin-magic-link up") },
);
