import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Editá esto si querés moverlo a .env
const FUNCTION_URL = "https://xpxrrlsvnhpspmcpzzvv.supabase.co/functions/v1/approve-photographer";

export default function ApprovePhotographer() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [link, setLink] = useState("");

  useEffect(() => { setMsg(""); setLink(""); }, [email]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(""); setLink("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const access_token = sess?.session?.access_token;
      if (!access_token) {
        setMsg("Tenés que iniciar sesión como ADMIN.");
        return;
      }
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${access_token}`,
        },
        body: JSON.stringify({ email, display_name: displayName }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out?.error || "No se pudo aprobar");
      setMsg("Fotógrafo aprobado. Copiá el magic link y enviáselo.");
      setLink(out.magic_link);
    } catch (e) {
      setMsg(e.message || "Error al aprobar");
    } finally {
      setBusy(false);
    }
  }

  function copy() {
    if (link) {
      navigator.clipboard.writeText(link);
      setMsg("¡Link copiado al portapapeles!");
    }
  }

  return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Aprobar Fotógrafo</h1>
      <p className="text-sm text-slate-600">
        Ingresá el correo del fotógrafo. Se creará/actualizará el usuario, se le asignará el rol
        <b> fotografo</b> y se generará un <b>magic link</b> para que ingrese.
      </p>

      <form onSubmit={submit} className="space-y-3">
        <input
          className="w-full border rounded-lg p-2"
          placeholder="Correo del fotógrafo"
          type="email"
          value={email}
          onChange={e=>setEmail(e.target.value)}
          required
        />
        <input
          className="w-full border rounded-lg p-2"
          placeholder="Nombre/Estudio (opcional)"
          type="text"
          value={displayName}
          onChange={e=>setDisplayName(e.target.value)}
        />
        <button className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50" disabled={busy}>
          {busy ? "Procesando..." : "Aprobar y generar Magic Link"}
        </button>
      </form>

      {msg && <div className="text-sm">{msg}</div>}
      {link && (
        <div className="space-y-2">
          <input className="w-full border rounded-lg p-2" value={link} readOnly />
          <button className="px-4 py-2 rounded-xl border" onClick={copy}>Copiar link</button>
        </div>
      )}
    </div>
  );
}
