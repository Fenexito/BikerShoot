import React from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

// Verifica contra admin_users usando user_id O email
function useIsAdmin() {
  const [state, setState] = React.useState({ loading: true, isAdmin: false });
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: ures } = await supabase.auth.getUser();
        const u = ures?.user;
        if (!u) return alive && setState({ loading: false, isAdmin: false });
        const or = `user_id.eq.${u.id},email.eq.${encodeURIComponent(u.email || "")}`;
        const { data, error } = await supabase
          .from("admin_users")
          .select("user_id")
          .or(or)
          .limit(1);
        if (error) throw error;
        const found = Array.isArray(data) && data.length > 0;
        console.debug("[RequireAdmin] isAdmin:", found, "user:", u.id, u.email);
        alive && setState({ loading: false, isAdmin: found });
      } catch (e) {
        console.warn("[RequireAdmin] error:", e.message);
        alive && setState({ loading: false, isAdmin: false });
      }
    })();
    return () => { alive = false; };
  }, []);
  return state;
}

export default function RequireAdmin({ children }) {
  const nav = useNavigate();
  const { loading, isAdmin } = useIsAdmin();
  if (loading) return <div className="p-6 text-slate-500">Verificando permisos…</div>;
  if (!isAdmin) {
    return (
      <main className="max-w-xl mx-auto px-5 py-10">
        <h1 className="text-xl font-bold mb-2">Acceso restringido</h1>
        <p className="text-slate-600 mb-4">Esta sección es solo para admins.</p>
        <button
          onClick={() => nav("/")}
          className="px-4 h-10 rounded-lg bg-blue-600 text-white font-semibold"
        >
          Ir al inicio
        </button>
      </main>
    );
  }
  return children;
}
