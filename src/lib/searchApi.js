// src/lib/searchApi.js
import { supabase } from "./supabaseClient";
import { getPublicUrl } from "./storage.js";

/** =============== Básicos existentes =============== */
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

export async function fetchPhotographers(ids = []) {
  let q = supabase
    .from("photographer_profile")
    .select("id, estudio, display_name, username, puntos")
    .order("display_name", { ascending: true });
  if (Array.isArray(ids) && ids.length > 0) q = q.in("id", ids);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** =============== Smart por Ruta (con fallback) =============== */
/** Busca ruta por nombre (para when posible usar route_id en event_hotspot) */
async function fetchRouteByName(name) {
  if (!name) return null;
  const { data, error } = await supabase
    .from("photo_routes")
    .select("id, name")
    .eq("name", name)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/** Intenta desde event_hotspot→event, si no hay, cae a photographer_profile.puntos */
export async function fetchPhotographersByRouteSmart(routeName) {
  if (!routeName) return [];
  // 1) event_hotspot → event → photographer_id
  try {
    const route = await fetchRouteByName(routeName);
    if (route?.id) {
      const { data: hs, error: e1 } = await supabase
        .from("event_hotspot")
        .select("id, event_id")
        .eq("route_id", route.id);
      if (e1) throw e1;
      const eventIds = Array.from(new Set((hs || []).map((h) => h.event_id).filter(Boolean)));
      if (eventIds.length) {
        const { data: evs, error: e2 } = await supabase
          .from("event")
          .select("id, photographer_id")
          .in("id", eventIds);
        if (e2) throw e2;
        const photogIds = Array.from(new Set((evs || []).map((e) => e.photographer_id).filter(Boolean)));
        if (photogIds.length) {
          const { data: phs, error: e3 } = await supabase
            .from("photographer_profile")
            .select("id, estudio, display_name, username")
            .in("id", photogIds)
            .order("display_name", { ascending: true });
          if (e3) throw e3;
          if (phs?.length) return phs;
        }
      }
    }
  } catch (err) {
    console.warn("fetchPhotographersByRouteSmart/event_hotspot fallback:", err?.message);
  }

  // 2) Fallback: photographer_profile.puntos (JSON)
  try {
    const { data: profs, error } = await supabase
      .from("photographer_profile")
      .select("id, estudio, display_name, username, puntos");
    if (error) throw error;

    const list = (profs || []).filter((p) =>
      Array.isArray(p?.puntos) && p.puntos.some((pt) => (pt?.ruta || "") === routeName)
    );
    // devolvemos perfil sin la columna pesada
    return list.map(({ id, estudio, display_name, username }) => ({ id, estudio, display_name, username }));
  } catch (e) {
    console.error("fetchPhotographersByRouteSmart/profile:", e);
    return [];
  }
}

/** Hotspots por ruta; si vienen photographerIds, filtra por sus eventos o por sus puntos (fallback) */
export async function fetchHotspotsByRouteSmart(routeName, photographerIds = []) {
  if (!routeName) return [];
  // 1) event_hotspot → si hay photographerIds, filtramos por eventos de esos fotógrafos
  try {
    const route = await fetchRouteByName(routeName);
    if (route?.id) {
      const { data: hsAll, error: e1 } = await supabase
        .from("event_hotspot")
        .select("id, event_id, name, route_id, windows")
        .eq("route_id", route.id)
        .order("id", { ascending: true });
      if (e1) throw e1;
      if (!hsAll || hsAll.length === 0) throw new Error("No hotspots on route_id");

      if (!photographerIds || photographerIds.length === 0) {
        return hsAll.map((p) => {
          const w0 = Array.isArray(p?.windows) && p.windows[0] ? p.windows[0] : null;
          return {
            id: p.id,
            name: p.name || "Punto",
            route_id: p.route_id || null,
            horaIni: (w0?.start ?? "") || "",
            horaFin: (w0?.end ?? "") || "",
            __source: "event_hotspot",
          };
        });
      }

      const eventIds = Array.from(new Set(hsAll.map((h) => h.event_id).filter(Boolean)));
      if (eventIds.length === 0) throw new Error("No events for hotspots");
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
      if (filtered.length) {
        return filtered.map((p) => {
          const w0 = Array.isArray(p?.windows) && p.windows[0] ? p.windows[0] : null;
          return {
            id: p.id,
            name: p.name || "Punto",
            route_id: p.route_id || null,
            horaIni: (w0?.start ?? "") || "",
            horaFin: (w0?.end ?? "") || "",
            __source: "event_hotspot",
          };
        });
      }
      // si no hubo match, caemos a fallback
    }
  } catch (err) {
    console.warn("fetchHotspotsByRouteSmart/event_hotspot fallback:", err?.message);
  }

  // 2) Fallback: photographer_profile.puntos (JSON)
  try {
    const { data: profs, error } = await supabase
      .from("photographer_profile")
      .select("id, puntos");
    if (error) throw error;

    // Si vienen photogs, limitar a ellos
    const allowed = new Set((photographerIds || []).map(String));
    const list = [];
    for (const p of profs || []) {
      if (allowed.size && !allowed.has(String(p.id))) continue;
      for (const pt of Array.isArray(p?.puntos) ? p.puntos : []) {
        if ((pt?.ruta || "") !== routeName) continue;
        // id sintético para no colisionar: profile:<photogId>:<idx|hash>
        const pid = `profile:${p.id}:${pt.id ?? pt.nombre ?? Math.random().toString(36).slice(2, 8)}`;
        list.push({
          id: pid,
          name: pt.nombre || "Punto",
          route_id: null,
          horaIni: Array.isArray(pt.horarios) && pt.horarios[0]?.inicio ? pt.horarios[0].inicio : "",
          horaFin: Array.isArray(pt.horarios) && pt.horarios[0]?.fin ? pt.horarios[0].fin : "",
          __source: "profile",
        });
      }
    }
    // dedupe por name
    const byName = new Map();
    for (const h of list) {
      if (!byName.has(h.name)) byName.set(h.name, h);
    }
    return Array.from(byName.values());
  } catch (e) {
    console.error("fetchHotspotsByRouteSmart/profile:", e);
    return [];
  }
}

/** =============== Fotos (no filtra por hora aquí; eso va en front) =============== */
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
      route: "",
      aiConfidence: 0,
      riders: 1,
      areas: { moto: [], casco: [], chaqueta: [] },
    });
  }
  return out;
}
