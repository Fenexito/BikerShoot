 import { Navigate } from "react-router-dom";
 import { useAuth } from "../../state/auth";
 
 export default function AuthGate({ children }) {
   const { user, loading } = useAuth();
   if (loading) return <div className="p-4">Cargando...</div>;
   if (!user) return <Navigate to="/login" replace />;
   return children;
 }
