// src/lib/searchApi.js
import { supabase } from "./supabaseClient";
import { getPublicUrl } from "./storage";

/** Rutas activas */
export async function fetchRoutes() {
  const { data, error } = await supabase
    .from("photo_routes")
    .select("id, name, color, is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Evento por id (para nombre ruta y fotógrafo) */
export async function fetchEvent(eventId) {
  const { data, error } = await supabase
    .from("event")
    .select("id, photographer_id, nombre, title, fecha, date, ruta, location")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    photographer_id: data.photographer_id || null,
    fecha: data.fecha || data.date || "",
    ruta: data.ruta || data.location || "Todos",
    nombre: data.nombre || data.title || "",
  };
}

/** Un hotspot específico */
export async function fetchHotspot(hotspotId) {
  const { data, error } = await supabase
    .from("event_hotspot")
    .select("id, event_id, name, route_id, windows")
    .eq("id", hotspotId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const w0 = Array.isArray(data.windows) && data.windows[0] ? data.windows[0] : null;
  return {
    id: data.id,
    event_id: data.event_id,
    name: data.name || "Punto",
    route_id: data.route_id || null,
    horaIni: (w0?.start ?? "") || "",
    horaFin: (w0?.end ?? "") || "",
  };
}

/** Todos los hotspots de un evento */
export async function fetchHotspotsByEvent(eventId) {
  const { data, error } = await supabase
    .from("event_hotspot")
    .select("id, event_id, name, route_id, windows")
    .eq("event_id", eventId)
    .order("id", { ascending: true });
  if (error) throw error;

  return (data || []).map((p) => {
    const w0 = Array.isArray(p?.windows) && p.windows[0] ? p.windows[0] : null;
    return {
      id: p.id,
      event_id: p.event_id,
      name: p.name || "Punto",
      route_id: p.route_id || null,
      horaIni: (w0?.start ?? "") || "",
      horaFin: (w0?.end ?? "") || "",
    };
  });
}

/** Cache sencillo rutaId -> nombre */
const routeNameCache = new Map();
export async function getRouteName(route_id) {
  if (!route_id) return "";
  if (routeNameCache.has(route_id)) return routeNameCache.get(route_id);
  const { data, error } = await supabase
    .from("photo_routes")
    .select("id, name")
    .eq("id", route_id)
    .maybeSingle();
  if (error) throw error;
  const name = data?.name || "";
  routeNameCache.set(route_id, name);
  return name;
}

/** Fotógrafos por ids (para etiquetas/nombres) */
export async function fetchPhotographers(ids = []) {
  let q = supabase.from("photographer_profile").select("id, estudio, display_name, username").order("display_name", { ascending: true });
  if (Array.isArray(ids) && ids.length > 0) {
    q = q.in("id", ids);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** Fotos: desde event_asset.
 * params:
 * - event_id?: string
 * - hotspot_ids?: string[]
 * - fecha?: 'YYYY-MM-DD'
 * - inicio?: 'HH:MM'
 * - fin?: 'HH:MM'
 * - photographer_ids?: string[]
 */
export async function fetchPhotos(params = {}) {
  const {
    event_id,
    hotspot_ids = [],
    fecha = "",
    inicio = "",
    fin = "",
    photographer_ids = [],
  } = params;

  let q = supabase
    .from("event_asset")
    .select("id, event_id, hotspot_id, storage_path, taken_at, photographer_id")
    .order("taken_at", { ascending: false });

  if (event_id) q = q.eq("event_id", event_id);
  if (Array.isArray(hotspot_ids) && hotspot_ids.length > 0) q = q.in("hotspot_id", hotspot_ids);
  if (Array.isArray(photographer_ids) && photographer_ids.length > 0) q = q.in("photographer_id", photographer_ids);

  // Filtrado por hora si viene fecha + rango
  if (fecha && (inicio || fin)) {
    // Construimos ISO aproximado local (sin TZ server): YYYY-MM-DDTHH:MM:SS
    const iniIso = `${fecha}T${(inicio || "00:00").slice(0,5)}:00`;
    const finIso = `${fecha}T${(fin || "23:59").slice(0,5)}:59`;
    q = q.gte("taken_at", iniIso).lte("taken_at", finIso);
  }

  const { data, error } = await q;
  if (error) throw error;

  // Resolver URLs
  const out = [];
  for (const row of data || []) {
    const url = await getPublicUrl(row.storage_path);
    out.push({
      id: row.id,
      url,
      eventId: row.event_id,
      hotspotId: row.hotspot_id || null,
      photographerId: row.photographer_id || null,
      timestamp: row.taken_at || null,
      // Campos que tu UI actual usa:
      route: "",            // lo resolvemos afuera si hace falta
      aiConfidence: 0,      // inicial 0; si luego agregas IA real, aquí se rellena
      riders: 1,            // placeholder (tu UI lo soporta)
      areas: {              // placeholder para filtros de color
        moto: [],
        casco: [],
        chaqueta: [],
      },
    });
  }
  return out;
}
