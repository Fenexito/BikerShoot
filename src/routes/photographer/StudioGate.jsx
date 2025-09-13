import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

// Misma lógica de “perfil completo” que el onboarding
function isProfileComplete(p) {
  if (!p) return false;
  const telOk = !!(p.telefono && p.telefono.trim().length >= 8);
  const userOk = !!(p.username && p.username.trim().length >= 3);
  const pagosOk = Array.isArray(p?.pagos?.cuentas) && p.pagos.cuentas.length >= 1;
  const puntosOk = Array.isArray(p?.puntos) && p.puntos.length >= 1;
  const pl = Array.isArray(p?.price_lists) ? p.price_lists : [];
  const preciosOk = pl.length >= 1 && pl.some(plx =>
    Array.isArray(plx.items) && plx.items.length >= 3 && plx.items.every(it => String(it.precio || "").trim() !== "")
  );
  return telOk && userOk && pagosOk && puntosOk && preciosOk;
}

export default function StudioGate({ children }) {
  const nav = useNavigate();
  const loc = useLocation();

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const u = sess?.session?.user;
        if (!u) return nav("/login-fotografo", { replace: true });

        // Traer perfil y validar
        const { data: prof } = await supabase
          .from("photographer_profile")
          .select("*")
          .eq("user_id", u.id)
          .maybeSingle();

        if (!alive) return;
        if (!isProfileComplete(prof) && loc.pathname !== "/studio/onboarding") {
          nav("/studio/onboarding", { replace: true });
        }
      } catch {
        // si falla, igual no bloqueemos la vista
      }
    })();
    return () => { alive = false; };
  }, [nav, loc.pathname]);

  return <>{children}</>;
}
