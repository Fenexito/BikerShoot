import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

function useIsAdmin() {
  const [state, setState] = React.useState({ loading: true, isAdmin: false });
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: ures } = await supabase.auth.getUser();
        const u = ures?.user;
        if (!u) {
          if (alive) setState({ loading: false, isAdmin: false });
          return;
        }
        const or = `user_id.eq.${u.id},email.eq.${encodeURIComponent(u.email || "")}`;
        const { data, error } = await supabase
          .from("admin_users")
          .select("user_id")
          .or(or)
          .limit(1);
        if (error) throw error;
        const found = Array.isArray(data) && data.length > 0;
        if (alive) setState({ loading: false, isAdmin: found });
      } catch {
        if (alive) setState({ loading: false, isAdmin: false });
      }
    })();
    return () => { alive = false; };
  }, []);
  return state;
}

export default function AdminAccessLink() {
  const { loading, isAdmin } = useIsAdmin();
  const nav = useNavigate();
  const { pathname } = useLocation();
  // MOSTRAR SOLO en /app (portal biker); no público ni /admin
  const inUserPortal = pathname.startsWith("/app") && !pathname.startsWith("/admin");
  if (loading || !inUserPortal) return null;
  if (!isAdmin) return null;
  return (
    <button
      onClick={() => nav("/admin")}
      className="h-9 px-3 rounded-lg bg-red-600 text-white font-display font-black tracking-wide hover:brightness-95"
      title="Panel de Admin"
    >
      ADMIN
    </button>
  );
}
