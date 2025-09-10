// src/lib/searchApi.js
import { supabase } from "./supabaseClient";
import { getPublicUrl } from "./storage.js";

/** ================= Rutas / Eventos / Hotspots ================= **/

/** Rutas activas (no es obligatorio si usás las fijas en la UI) */
export async function fetchRoutes() {
  const { data, error } = await supabase
    .from("photo_routes")
    .select("id, name, color, is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Busca una ruta por nombre exacto */
export async function fetchRouteByName(name) {
  if (!name) return null;
  const { data, error } = await supabase
    .from("photo_routes")
    .select("id, name")
    .eq("name", name)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/** Evento por id (para fotógrafo/fecha/ruta) */
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

/** Nombre de ruta por id (con cache) */
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

/** ================== Filtrado por RUTA (para poblar selects) ================== **/

/** Fotógrafos que tienen eventos/puntos en una ruta dada (por nombre) */
export async function fetchPhotographersByRoute(routeName) {
  if (!routeName) return [];
  // Obtenemos el id de la ruta por nombre
  const route = await fetchRouteByName(routeName);
  if (!route?.id) return [];

  // Hotspots en esa ruta
  const { data: hs, error: e1 } = await supabase
    .from("event_hotspot")
    .select("id, event_id")
    .eq("route_id", route.id);
  if (e1) throw e1;

  const eventIds = Array.from(new Set((hs || []).map((h) => h.event_id).filter(Boolean)));
  if (eventIds.length === 0) return [];

  // Eventos → fotógrafos
  const { data: evs, error: e2 } = await supabase
    .from("event")
    .select("id, photographer_id")
    .in("id", eventIds);
  if (e2) throw e2;

  const photogIds = Array.from(new Set((evs || []).map((e) => e.photographer_id).filter(Boolean)));
  if (photogIds.length === 0) return [];

  // Perfiles de fotógrafos
  const { data: phs, error: e3 } = await supabase
    .from("photographer_profile")
    .select("id, estudio, display_name, username")
    .in("id", photogIds)
    .order("display_name", { ascending: true });
  if (e3) throw e3;

  return phs || [];
}

/** Puntos disponibles en una ruta (opcionalmente filtrados por fotógrafos) */
export async function fetchHotspotsByRoute(routeName, photographerIds = []) {
  if (!routeName) return [];
  const route = await fetchRouteByName(routeName);
  if (!route?.id) return [];

  // Hotspots de esa ruta (todos)
  const { data: hsAll, error: e1 } = await supabase
    .from("event_hotspot")
    .select("id, event_id, name, route_id, windows")
    .eq("route_id", route.id)
    .order("id", { ascending: true });
  if (e1) throw e1;

  if (!hsAll || hsAll.length === 0) return [];

  // Si no hay filtro por fotógrafos, devolvemos todos
  if (!photographerIds || photographerIds.length === 0) {
    return hsAll.map((p) => {
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

  // Si hay fotógrafos seleccionados, filtramos por eventos de esos fotógrafos
  const eventIds = Array.from(new Set(hsAll.map((h) => h.event_id).filter(Boolean)));
  if (eventIds.length === 0) return [];

  const { data: evs, error: e2 } = await supabase
    .from("event")
    .select("id, photographer_id")
    .in("id", eventIds);
  if (e2) throw e2;

  const allowedEventIds = new Set(
    (evs || [])
      .filter((e) => photographerIds.includes(String(e.photographer_id)))
      .map((e) => e.id)
  );

  const filtered = hsAll.filter((h) => allowedEventIds.has(h.event_id));
  return filtered.map((p) => {
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

/** ================== Fotógrafos directos ================== **/
export async function fetchPhotographers(ids = []) {
  let q = supabase.from("photographer_profile").select("id, estudio, display_name, username").order("display_name", { ascending: true });
  if (Array.isArray(ids) && ids.length > 0) q = q.in("id", ids);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** ================== FOTOS ================== **/
export async function fetchPhotos(params = {}) {
  const {
    event_id,
    hotspot_ids = [],
    photographer_ids = [],
  } = params;

  let q = supabase
    .from("event_asset")
    .select("id, event_id, hotspot_id, storage_path, taken_at, photographer_id")
    .order("taken_at", { ascending: false });

  if (event_id) q = q.eq("event_id", event_id);
  if (Array.isArray(hotspot_ids) && hotspot_ids.length > 0) q = q.in("hotspot_id", hotspot_ids);
  if (Array.isArray(photographer_ids) && photographer_ids.length > 0) q = q.in("photographer_id", photographer_ids);

  // Importante: No filtramos por hora aquí (lo hacemos en el front por TZ)

  const { data, error } = await q;
  if (error) throw error;

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
      route: "",            // La UI puede rellenar con la ruta seleccionada
      aiConfidence: 0,      // Placeholder (cuando metas IA real)
      riders: 1,            // Placeholder
      areas: { moto: [], casco: [], chaqueta: [] }, // Placeholder colores
    });
  }
  return out;
}
