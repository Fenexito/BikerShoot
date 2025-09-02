import React from "react";
import { supabase } from "../lib/supabaseClient";

const FN_URL =
  "https://xpxrrlsvnhpspmcpzzvv.supabase.co/functions/v1/admin-magic-link"; // ← misma que la función nueva

export default function AdminMagicLink() {
  const [email, setEmail] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [redirectTo, setRedirectTo] = React.useState(
    `${location.origin}/login-fotografo`
  );
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [link, setLink] = React.useState("");

  async function generate() {
    setErr("");
    setLink("");
    if (!email.trim()) {
      setErr("Ingresá el correo del fotógrafo.");
      return;
    }
    try {
      setLoading(true);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error("Sesión expirada. Iniciá sesión otra vez.");

      const res = await fetch(FN_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          display_name: displayName || undefined,
          redirectTo: redirectTo || undefined,
        }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out?.error || "No se pudo generar el magic link");
      setLink(out?.magic_link || "");
    } catch (e) {
      setErr(e.message || "No se pudo generar el magic link");
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    if (!link) return;
    navigator.clipboard.writeText(link).catch(() => {});
  }

  return (
    <main>
      <h1 className="text-2xl font-display font-bold mb-4">Generar Magic Link</h1>

      <section className="rounded-2xl border border-slate-200 p-4 bg-white max-w-xl">
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Correo del fotógrafo
        </label>
        <input
          className="w-full h-11 px-3 border rounded-lg"
          placeholder="alguien@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nombre para mostrar (opcional)
            </label>
            <input
              className="w-full h-11 px-3 border rounded-lg"
              placeholder="Estudio Ejemplo"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Redirect (opcional)
            </label>
            <input
              className="w-full h-11 px-3 border rounded-lg"
              value={redirectTo}
              onChange={(e) => setRedirectTo(e.target.value)}
            />
          </div>
        </div>

        <button
          className="mt-3 h-11 px-4 rounded-lg bg-blue-600 text-white font-display font-bold disabled:opacity-50"
          onClick={generate}
          disabled={loading}
        >
          {loading ? "Generando..." : "Generar link"}
        </button>

        {err && <div className="mt-3 text-red-600">{err}</div>}

        {link && (
          <div className="mt-4">
            <div className="text-sm text-slate-600 mb-1">Magic link</div>
            <div className="flex items-center gap-2">
              <input className="flex-1 h-11 px-3 border rounded-lg" value={link} readOnly />
              <button className="h-11 px-3 rounded-lg border" onClick={copy}>
                Copiar
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Compartí este enlace con el fotógrafo. Al abrirlo, completará su acceso.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
