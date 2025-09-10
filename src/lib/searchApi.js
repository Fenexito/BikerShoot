import { supabase } from "./supabaseClient";

/* ===================== Helpers comunes ===================== */

function safeJSON(str, fallback) {
  if (!str) return fallback;
  try {
    if (typeof str === "string") return JSON.parse(str);
    return Array.isArray(str) || typeof str === "object" ? str : fallback;
  } catch {
    return fallback;
  }
}

function parseTimeWindows(windowsStr, timeWindowsStr) {
  // tus tablas traen "windows" (string con [{"start":"08:15","end":"09:15"}]) y "time_windows" (a veces vacío)
  const a = safeJSON(windowsStr, []);
  const b = safeJSON(timeWindowsStr, []);
  const list = Array.isArray(a) && a.length ? a : Array.isArray(b) ? b : [];
  const first = list[0] || {};
  const horaIni = typeof first.start === "string" ? first.start : null;
  const horaFin = typeof first.end === "string" ? first.end : null;
  return { horaIni, horaFin };
}

/** Public URL para bucket 'fotos' (igual flow que en Event.jsx) */
export async function getPublicUrl(storagePath) {
  if (!storagePath) return "";
  const raw = String(storagePath).trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  // limpiamos prefijos repetidos
  const clean = raw.replace(/^\/+/, "").replace(/^fotos\//i, "");
  const { data } = supabase.storage.from("fotos").getPublicUrl(clean);
  if (data?.publicUrl) return data.publicUrl;
  const signed = await supabase.storage.from("fotos").createSignedUrl(clean, 3600);
  return signed?.data?.signedUrl || "";
}

/** Listado recursivo desde Storage (fallback cuando la tabla está vacía) */
async function listAssetsFromStorage(eventId) {
  const root = `events/${eventId}`;
  async function listAllFiles(folder) {
    const acc = [];
    const stack = [folder];
    while (stack.length) {
      const cur = stack.pop();
      const { data, error } = await supabase.storage.from("fotos").list(cur, { limit: 1000 });
      if (error) continue;
      for (const entry of data || []) {
        if (entry.name && /\.[a-z0-9]{2,4}$/i.test(entry.name)) {
          acc.push(`${cur}/${entry.name}`);
        } else if (entry.name) {
          stack.push(`${cur}/${entry.name}`);
        }
      }
    }
    return acc;
  }
  const files = await listAllFiles(root);
  const out = [];
  for (const path of files) {
    const url = await getPublicUrl(path);
    if (url) out.push({ id: path, event_id: eventId, hotspot_id: null, url });
  }
  return out;
}

/* ===================== Fetch básicos usados por Search.jsx ===================== */

export async function getRouteName(routeId) {
  if (!routeId) return null;
  const { data, error } = await supabase.from("photo_routes").select("name").eq("id", routeId).maybeSingle();
  if (error) return null;
  return data?.name || null;
}

export async function fetchEvent(eventId) {
  if (!eventId) return null;
  const { data, error } = await supabase
    .from("event")
    .select("id, photographer_id, route_id, date")
    .eq("id", eventId)
    .maybeSingle();
  if (error) return null;
  return data || null;
}

export async function fetchHotspot(hotspotId) {
  if (!hotspotId) return null;
  const { data, error } = await supabase
    .from("event_hotspot")
    .select("id, event_id, route_id, name, windows, time_windows")
    .eq("id", hotspotId)
    .maybeSingle();
  if (error) return null;
  const { horaIni, horaFin } = parseTimeWindows(data?.windows, data?.time_windows);
  return {
    id: data?.id,
    event_id: data?.event_id,
    route_id: data?.route_id,
    name: data?.name,
    horaIni,
    horaFin,
  };
}

export async function fetchHotspotsByEvent(eventId) {
  if (!eventId) return [];
  const { data, error } = await supabase
    .from("event_hotspot")
    .select("id, name")
    .eq("event_id", eventId)
    .order("name", { ascending: true });
  if (error) return [];
  return data || [];
}

/* ===================== Fotos (tabla + fallback storage) ===================== */

/**
 * params:
 *  - event_id?: string
 *  - hotspot_ids?: string[]
 *  - photographer_ids?: string[]
 *  - route_id?: string
 */
export async function fetchPhotos(params = {}) {
  const {
    event_id,
    hotspot_ids = [],
    photographer_ids = [],
    route_id, // OJO: acá sí lo aceptamos, pero NO tocamos event.route_id
  } = params;

  // ========== 1) Resolver eventIds ==========
  let eventIds = [];

  if (event_id) {
    eventIds = [String(event_id)];
  } else if (Array.isArray(photographer_ids) && photographer_ids.length > 0) {
    // Traer eventos del/los fotógrafo(s) (SIN filtrar por ruta acá)
    const { data: evs, error: eEv } = await supabase
      .from("event")
      .select("id")
      .in("photographer_id", photographer_ids.map(String));
    if (eEv) {
      console.warn("fetchPhotos map photogs->events:", eEv.message);
    }
    eventIds = (evs || []).map((r) => String(r.id));
  }

  // Si hay route_id, reducimos/obtenemos events por la ruta usando event_hotspot
  if (route_id) {
    const { data: evHs, error: eHs } = await supabase
      .from("event_hotspot")
      .select("event_id")
      .eq("route_id", route_id);

    if (!eHs) {
      const idsFromRoute = Array.from(new Set((evHs || []).map((r) => String(r.event_id))));
      if (eventIds.length > 0) {
        // intersección: eventos del/los fotógrafo(s) que además tengan hotspots en esa ruta
        const setRoute = new Set(idsFromRoute);
        eventIds = eventIds.filter((id) => setRoute.has(id));
      } else {
        // si no teníamos eventos aún (p. ej. no hay fotógrafo), usamos los de la ruta
        eventIds = idsFromRoute;
      }
    }
  }

  // ========== 2) Query principal a event_asset ==========
  const cols = "id, event_id, hotspot_id, storage_path, url, path, taken_at";
  let q = supabase.from("event_asset").select(cols).order("taken_at", { ascending: false }).limit(2000);

  // Nota: ahora NO exigimos tener eventIds; se puede buscar por hotspot/ruta
  if (eventIds.length > 0) q = q.in("event_id", eventIds);
  if (Array.isArray(hotspot_ids) && hotspot_ids.length > 0) {
    q = q.in("hotspot_id", hotspot_ids.map(String));
  }

  let { data: rows, error } = await q;
  if (error) {
    console.warn("event_asset query fail:", error.message);
    rows = [];
  }

  // ========== 3) Fallback: si pediste por punto(s) y salió vacío, traé generales del/los evento(s) ==========
  if ((!rows || rows.length === 0) && hotspot_ids.length > 0 && eventIds.length > 0) {
    const { data: gen, error: eGen } = await supabase
      .from("event_asset")
      .select(cols)
      .in("event_id", eventIds)
      .is("hotspot_id", null)
      .order("taken_at", { ascending: false })
      .limit(2000);
    if (!eGen) rows = gen || [];
  }

  // ========== 4) Normalizar a tu UI + URL pública ==========
  const out = [];
  for (const r of rows || []) {
    const raw = r.storage_path || r.url || r.path || "";
    const finalUrl = await getPublicUrl(raw);
    if (!finalUrl) continue;
    out.push({
      id: r.id,
      url: finalUrl,
      eventId: r.event_id || null,
      hotspotId: r.hotspot_id || null,
      photographerId: null,
      timestamp: r.taken_at || null,
      route: "",
      aiConfidence: 0,
      riders: 1,
      areas: { moto: [], casco: [], chaqueta: [] },
    });
  }

  // ========== 5) Plan C: si sigue vacío, leemos del Storage por cada event_id ==========
  if (!out.length && eventIds.length > 0) {
    let fromStorage = [];
    for (const ev of eventIds) {
      const listed = await listAssetsFromStorage(ev);
      fromStorage = fromStorage.concat(listed);
    }
    const out2 = [];
    for (const r of fromStorage) {
      const url = r.url || (await getPublicUrl(r.storage_path || r.path));
      if (!url) continue;
      out2.push({
        id: r.id || `${r.event_id}:${url}`,
        url,
        eventId: r.event_id || null,
        hotspotId: r.hotspot_id || null,
        photographerId: null,
        timestamp: r.taken_at || null,
        route: "",
        aiConfidence: 0,
        riders: 1,
        areas: { moto: [], casco: [], chaqueta: [] },
      });
    }
    return out2;
  }

  return out;
}