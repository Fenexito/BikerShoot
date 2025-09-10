import { supabase } from "./supabaseClient";

/** Clonado de tu Event.jsx: bucket 'fotos' con fallback firmado */
async function getPublicUrl(storagePath) {
  if (!storagePath) return "";
  const raw = String(storagePath).trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const clean = raw.replace(/^\/+/, "").replace(/^fotos\//i, "");
  const { data } = supabase.storage.from("fotos").getPublicUrl(clean);
  if (data?.publicUrl) return data.publicUrl;
  const signed = await supabase.storage.from("fotos").createSignedUrl(clean, 3600);
  return signed?.data?.signedUrl || "";
}

/** Igual que en Event.jsx: lista recursiva en Storage */
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

/** NUEVO fetchPhotos: tolerante a hotspot_id nulo, y soporta route_id */
export async function fetchPhotos(params = {}) {
  const {
    event_id,
    hotspot_ids = [],
    photographer_ids = [],
    route_id, // opcional
  } = params;

  // 1) Resolver event_ids
  let eventIds = [];
  if (event_id) {
    eventIds = [String(event_id)];
  } else if (Array.isArray(photographer_ids) && photographer_ids.length > 0) {
    let qEv = supabase.from("event").select("id");
    qEv = qEv.in("photographer_id", photographer_ids.map(String));
    if (route_id) qEv = qEv.eq("route_id", route_id);
    const { data: evs, error: eEv } = await qEv;
    if (eEv) console.warn("fetchPhotos map photogs->events:", eEv.message);
    eventIds = (evs || []).map((r) => String(r.id));
  }

  // Si no hay eventos que buscar, devolvé vacío rápido
  if (!eventIds.length) return [];

  // 2) Armar helper para consultar event_asset
  const selectCols = "id, event_id, hotspot_id, storage_path, url, path, taken_at";
  async function queryAssets({ onlyHotspots = false, onlyGenerals = false }) {
    let q = supabase.from("event_asset").select(selectCols).in("event_id", eventIds);
    if (onlyHotspots && Array.isArray(hotspot_ids) && hotspot_ids.length > 0) {
      q = q.in("hotspot_id", hotspot_ids.map(String));
    }
    if (onlyGenerals) {
      q = q.is("hotspot_id", null);
    }
    q = q.order("taken_at", { ascending: false }).limit(2000);
    const { data, error } = await q;
    if (error) {
      console.warn("event_asset query fail:", error.message);
      return [];
    }
    return data || [];
  }

  // 3) Intento A: si hay puntos, primero por hotspot_id
  let rows = [];
  if (Array.isArray(hotspot_ids) && hotspot_ids.length > 0) {
    rows = await queryAssets({ onlyHotspots: true });
    // Intento B: si no hay nada por hotspot, traé generales del evento
    if (!rows.length) {
      rows = await queryAssets({ onlyGenerals: true });
    }
  } else {
    // Sin puntos: todo el evento (hotspot y generales)
    const a = await queryAssets({ onlyHotspots: false });
    rows = a;
  }

  // 4) Normalizar URLs (aceptá storage_path | url | path)
  const out = [];
  for (const r of rows) {
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

  // 5) Plan C: si sigue vacío, leamos del Storage por cada evento
  if (!out.length) {
    let fromStorage = [];
    for (const ev of eventIds) {
      const listed = await listAssetsFromStorage(ev);
      fromStorage = fromStorage.concat(listed);
    }
    // Normalizá igual
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
