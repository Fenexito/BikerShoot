// src/lib/searchApi.js
import { supabase } from "./supabaseClient";

/** ================= Helpers de Storage ================= **/
async function getPublicUrlFromFotosBucket(storagePath) {
  if (!storagePath) return "";
  const raw = String(storagePath).trim();
  if (/^https?:\/\//i.test(raw)) return raw; // ya es URL
  const clean = raw.replace(/^\/+/, "").replace(/^fotos\//i, "");
  const { data } = supabase.storage.from("fotos").getPublicUrl(clean);
  if (data?.publicUrl) return data.publicUrl;
  // bucket privado → URL firmada por 1h
  const signed = await supabase.storage.from("fotos").createSignedUrl(clean, 3600);
  return signed?.data?.signedUrl || "";
}

/** ================= Fetchers básicos (se mantienen nombres) ================= **/
export async function fetchEvent(id) {
  const { data, error } = await supabase
    .from("event")
    .select("id, photographer_id, nombre, title, fecha, date, ruta, location, estado, status, cover_url")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function fetchHotspot(id) {
  const { data, error } = await supabase
    .from("event_hotspot")
    .select("id, event_id, name, windows, route_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const w0 = Array.isArray(data.windows) && data.windows[0] ? data.windows[0] : null;
  return {
    id: data.id,
    event_id: data.event_id,
    name: data.name || "",
    route_id: data.route_id || null,
    horaIni: (w0?.start ?? "") || "",
    horaFin: (w0?.end ?? "") || "",
  };
}

export async function fetchHotspotsByEvent(eventId) {
  const { data, error } = await supabase
    .from("event_hotspot")
    .select("id, name")
    .eq("event_id", eventId)
    .order("id", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getRouteName(routeId) {
  const { data, error } = await supabase
    .from("event_route")
    .select("id, name")
    .eq("id", routeId)
    .maybeSingle();
  if (error) throw error;
  return data?.name || null;
}

/** ================== NUEVO: fetchPhotos con múltiples routeIds ==================
 * Params:
 *  - routeIds: string[]  (si hay, usamos .in('route_id', routeIds))
 *  - hotspotIds: string[] (si hay, preferimos filtrar por hotspot primero)
 *  - photographerIds: string[] (filtra por event.photographer_id usando join)
 *  - fecha: 'YYYY-MM-DD'
 *  - inicioHHMM / finHHMM: 'HH:MM'  (rango dentro de esa fecha)
 *  - ignorarHora: boolean
 *  - page: number (0-based)
 *  - limit: number
 */
export async function fetchPhotos({
  routeIds = [],
  hotspotIds = [],
  photographerIds = [],
  fecha = null,
  inicioHHMM = null,
  finHHMM = null,
  ignorarHora = true,
  page = 0,
  limit = 200,
} = {}) {
  // Build query base
  let query = supabase
    .from("event_asset")
    .select(
      `
      id, storage_path, taken_at, hotspot_id, route_id, event_id,
      event!inner(photographer_id)
    `
    );

  // Filtros jerárquicos
  if (Array.isArray(hotspotIds) && hotspotIds.length > 0) {
    query = query.in("hotspot_id", hotspotIds);
  } else if (Array.isArray(routeIds) && routeIds.length > 0) {
    query = query.in("route_id", routeIds);
  }

  if (Array.isArray(photographerIds) && photographerIds.length > 0) {
    // Filtra por el fotógrafo dueño del evento (via join "event")
    query = query.in("event.photographer_id", photographerIds);
  }

  // Filtro de hora (si NO se ignora)
  if (!ignorarHora && fecha && inicioHHMM && finHHMM) {
    const startIso = new Date(`${fecha}T${inicioHHMM}:00`).toISOString();
    const endIso = new Date(`${fecha}T${finHHMM}:59`).toISOString();
    query = query.gte("taken_at", startIso).lte("taken_at", endIso);
  }

  // Orden + paginación
  const from = page * limit;
  const to = from + limit - 1;
  query = query.order("taken_at", { ascending: true }).range(from, to);

  const { data, error } = await query;
  if (error) throw error;

  // Mapear a objetos con URL pública
  const out = [];
  for (const row of data || []) {
    const url = await getPublicUrlFromFotosBucket(row.storage_path);
    if (!url) continue;
    out.push({
      id: row.id,
      url,
      hotspot_id: row.hotspot_id || null,
      route_id: row.route_id || null,
      event_id: row.event_id || null,
      timestamp: row.taken_at || null,
    });
  }

  return {
    items: out,
    hasMore: (data || []).length === limit,
  };
}
