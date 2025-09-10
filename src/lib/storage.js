// src/lib/storage.js
import { supabase } from "./supabaseClient";

/** Obtiene URL servible desde Storage (bucket 'fotos').
 *  - Si ya es URL absoluta, la devuelve tal cual.
 *  - Si el bucket es público, usa getPublicUrl.
 *  - Si no, genera signed URL (1h).
 */
export async function getPublicUrl(storagePath) {
  if (!storagePath) return "";
  const raw = String(storagePath).trim();
  if (/^https?:\/\//i.test(raw)) return raw; // ya es URL completa
  const clean = raw.replace(/^\/+/, "").replace(/^fotos\//i, "");
  const { data } = supabase.storage.from("fotos").getPublicUrl(clean);
  if (data?.publicUrl) return data.publicUrl;
  const signed = await supabase.storage.from("fotos").createSignedUrl(clean, 3600);
  return signed?.data?.signedUrl || "";
}
