 import React from "react";
 import { useNavigate, useLocation } from "react-router-dom";
 import { supabase } from "../lib/supabaseClient";

 function useIsAdmin() {
   const [isAdmin, setIsAdmin] = React.useState(false);
   React.useEffect(() => {
     let alive = true;
     async function check() {
       const { data: sess } = await supabase.auth.getSession();
       const u = sess?.session?.user;
       const role =
         u?.app_metadata?.app_role ||
         u?.user_metadata?.app_role ||
         (sess?.session?.access_token
           ? (() => {
               try {
                 const payload = JSON.parse(atob(sess.session.access_token.split(".")[1]));
                 return payload?.app_role;
               } catch {
                 return null;
               }
             })()
           : null);
       if (alive) setIsAdmin(role === "admin");
     }
     check();
     return () => {
       alive = false;
     };
   }, []);
   return isAdmin;
 }

 export default function AdminAccessButton() {
   const isAdmin = useIsAdmin();
   const nav = useNavigate();
   const loc = useLocation();
   if (!isAdmin) return null;
   // Ocultar el botón si ya estamos en el editor
   if (loc.pathname.startsWith("/admin/rutas")) return null;
   return (
     <button
       onClick={() => nav("/admin/rutas")}
       className="fixed bottom-5 right-5 z-[1000] px-4 h-11 rounded-full bg-blue-600 text-white font-display font-bold shadow-lg hover:brightness-95"
       title="Rutas (Admin)"
     >
       Rutas (Admin)
     </button>
   );
 }
