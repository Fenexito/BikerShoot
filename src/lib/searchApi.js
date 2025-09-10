// src/lib/searchApi.js
import { supabase } from "./supabaseClient";
import { getPublicUrl } from "./storage.js";

/** ----------------- Helpers ----------------- **/
function parseWindowsField(win) {
  // windows puede venir como string '[]' o como array
  if (!win) return [];
  if (Array.isArray(win)) return win;
  if (typeof win === "string") {
    try {
      const arr = JSON.parse(win);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** ----------------- Básicos ----------------- **/
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

export async function fetchHotspot(hotspotId) {
  const { data, error } = await supabase
    .from("event_hotspot")
    .select("id, event_id, name, route_id, windows")
    .eq("id", hotspotId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const wins = parseWindowsField(data.windows);
  const w0 = wins[0] || {};
  return {
    id: data.id,
    event_id: data.event_id,
    name: data.name || "Punto",
    route_id: data.route_id || null,
    horaIni: w0.start || "",
    horaFin: w0.end || "",
  };
}

export async function fetchHotspotsByEvent(eventId) {
  const { data, error } = await supabase
    .from("event_hotspot")
    .select("id, event_id, name, route_id, windows")
    .eq("event_id", eventId)
    .order("id", { ascending: true });
  if (error) throw error;

  return (data || []).map((p) => {
    const wins = parseWindowsField(p.windows);
    const w0 = wins[0] || {};
    return {
      id: p.id,
      event_id: p.event_id,
      name: p.name || "Punto",
      route_id: p.route_id || null,
      horaIni: w0.start || "",
      horaFin: w0.end || "",
    };
  });
}

export async function getRouteName(route_id) {
  if (!route_id) return "";
  const { data, error } = await supabase
    .from("photo_routes")
    .select("id, name")
    .eq("id", route_id)
    .maybeSingle();
  if (error) throw error;
  return data?.name || "";
}

/** ----------------- Ruta → Fotógrafos/Puntos (solo vía eventos) ----------------- **/
async function fetchRouteIdByName(routeName) {
  if (!routeName) return null;
  // tolerante a espacios/upper/lower con ilike
  const { data, error } = await supabase
    .from("photo_routes")
    .select("id, name")
    .ilike("name", routeName.trim());
  if (error) throw error;
  const row = (data || []).find((r) => r.name.trim().toLowerCase() === routeName.trim().toLowerCase()) || data?.[0];
  return row?.id || null;
}

export async function fetchPhotographersByRoute(routeName) {
  const routeId = await fetchRouteIdByName(routeName);
  if (!routeId) return [];

  // event_hotspot -> event -> photographer_profile
  const { data: hs, error: e1 } = await supabase
    .from("event_hotspot")
    .select("event_id")
    .eq("route_id", routeId);
  if (e1) throw e1;
  const eventIds = Array.from(new Set((hs || []).map((h) => h.event_id).filter(Boolean)));
  if (eventIds.length === 0) return [];

  const { data: evs, error: e2 } = await supabase
    .from("event")
    .select("id, photographer_id")
    .in("id", eventIds);
  if (e2) throw e2;

  const photogIds = Array.from(new Set((evs || []).map((e) => e.photographer_id).filter(Boolean)));
  if (photogIds.length === 0) return [];

  const { data: phs, error: e3 } = await supabase
    .from("photographer_profile")
    .select("id, estudio, display_name, username")
    .in("id", photogIds)
    .order("display_name", { ascending: true });
  if (e3) throw e3;

  return phs || [];
}

export async function fetchHotspotsByRoute(routeName, photographerIds = []) {
  const routeId = await fetchRouteIdByName(routeName);
  if (!routeId) return [];

  // Primero traemos todos los hotspots de la ruta
  const { data: hsAll, error: e1 } = await supabase
    .from("event_hotspot")
    .select("id, event_id, name, route_id, windows")
    .eq("route_id", routeId)
    .order("id", { ascending: true });
  if (e1) throw e1;

  if (!hsAll || hsAll.length === 0) return [];

  // Si no hay fotógrafos seleccionados: devolver todos
  if (!photographerIds || photographerIds.length === 0) {
    return hsAll.map((p) => {
      const wins = parseWindowsField(p.windows);
      const w0 = wins[0] || {};
      return {
        id: p.id,
        event_id: p.event_id,
        name: p.name || "Punto",
        route_id: p.route_id || null,
        horaIni: w0.start || "",
        horaFin: w0.end || "",
      };
    });
  }

  // Si hay fotógrafos, filtramos por eventos de esos fotógrafos
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
    const wins = parseWindowsField(p.windows);
    const w0 = wins[0] || {};
    return {
      id: p.id,
      event_id: p.event_id,
      name: p.name || "Punto",
      route_id: p.route_id || null,
      horaIni: w0.start || "",
      horaFin: w0.end || "",
    };
  });
}

/** ----------------- Fotógrafos directos ----------------- **/
export async function fetchPhotographers(ids = []) {
  let q = supabase
    .from("photographer_profile")
    .select("id, estudio, display_name, username")
    .order("display_name", { ascending: true });
  if (Array.isArray(ids) && ids.length > 0) q = q.in("id", ids);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** ----------------- Fotos (sin filtrar por hora aquí) ----------------- **/
export async function fetchPhotos(params = {}) {
  const {
    event_id,
    hotspot_ids = [],
    photographer_ids = [],
  } = params;

  // Mapear fotógrafos -> eventos (si no vino un event_id fijo)
  let eventIdsFromPhotogs = [];
  if (!event_id && Array.isArray(photographer_ids) && photographer_ids.length > 0) {
    try {
      const { data: evs, error: e } = await supabase
        .from("event")
        .select("id")
        .in("photographer_id", photographer_ids);
      if (e) throw e;
      eventIdsFromPhotogs = (evs || []).map((r) => r.id);
    } catch (err) {
      console.warn("fetchPhotos map photogs->events:", err?.message);
    }
  }

  // Query principal contra event_asset
  let q = supabase
    .from("event_asset")
    .select("id, event_id, hotspot_id, storage_path, taken_at")
    .order("taken_at", { ascending: false });

  if (event_id) {
    q = q.eq("event_id", event_id);
  } else if (eventIdsFromPhotogs.length > 0) {
    q = q.in("event_id", eventIdsFromPhotogs);
  }

  if (Array.isArray(hotspot_ids) && hotspot_ids.length > 0) {
    q = q.in("hotspot_id", hotspot_ids);
  }

  const { data, error } = await q;
  if (error) throw error;

  const out = [];
  for (const row of data || []) {
    const url = await getPublicUrl(row.storage_path);
    if (!url) continue;
    out.push({
      id: row.id,
      url,
      eventId: row.event_id || null,
      hotspotId: row.hotspot_id || null,
      photographerId: null,
      timestamp: row.taken_at || null,
      route: "",
      aiConfidence: 0,
      riders: 1,
      areas: { moto: [], casco: [], chaqueta: [] },
    });
  }
  return out;
}