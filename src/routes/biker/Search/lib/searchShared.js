// src/routes/biker/Search/lib/searchShared.js
import { supabase } from "../../../../lib/supabaseClient";

/* ================== Constantes Rutas ================== */
export const RUTAS_FIJAS = [
  "Ruta Interamericana",
  "RN-14",
  "Carretera al Salvador",
  "Carretera al Atlántico",
  "RN-10 (Cañas)",
];

export const ROUTE_ALIAS = {
  "Ruta Interamericana": ["interamericana", "rn-1", "rn1", "ca-1"],
  "RN-14": ["rn-14", "rn14", "ruta nacional 14"],
  "Carretera al Salvador": ["salvador", "ca-1", "carretera al salvador"],
  "Carretera al Atlántico": ["atlántico", "atlantico", "ca-9", "carretera al atlantico"],
  "RN-10 (Cañas)": ["rn-10", "rn10", "cañas", "canas"],
};

export const norm = (s) =>
  String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/* ================== Tiempo (step de 15min) ================== */
export const MIN_STEP = 5 * 4;  // 05:00
export const MAX_STEP = 15 * 4; // 15:00
export const clampStep = (s) => Math.max(MIN_STEP, Math.min(MAX_STEP, Number(s) || MIN_STEP));
export const timeToStep = (t = "06:00") => {
  const [h, m] = (t || "00:00").split(":").map((n) => parseInt(n || "0", 10));
  return clampStep(h * 4 + Math.round((m || 0) / 15));
};
export const stepToTime24 = (s) => {
  const c = clampStep(s);
  const h = Math.floor(c / 4);
  const m = (c % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
export const to12h = (t24) => {
  const [H, M] = (t24 || "00:00").split(":").map((x) => parseInt(x || "0", 10));
  const ampm = H >= 12 ? "PM" : "AM";
  const h12 = H % 12 === 0 ? 12 : H % 12;
  return `${h12}:${String(M).padStart(2, "0")} ${ampm}`;
};

/* ================== Utils ================== */
export const csvToArr = (v) => (!v ? [] : v.split(",").filter(Boolean));
export const arrToCsv = (a) => (Array.isArray(a) ? a.join(",") : "");

export const toYmd = (v) => {
  if (!v) return null;
  if (typeof v === "string") {
    const s10 = v.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s10)) return s10;
    const d = new Date(v);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
    return null;
  }
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
};

export function cryptoRandomId() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const arr = new Uint32Array(2);
    crypto.getRandomValues(arr);
    return `${arr[0].toString(16)}${arr[1].toString(16)}`;
  }
  return String(Math.random()).slice(2);
}

/* ================== Storage (URL pública y listado) ================== */
export async function getPublicUrl(storagePath) {
  if (!storagePath) return "";
  const raw = String(storagePath).trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const clean = raw.replace(/^\/+/, "").replace(/^fotos\//i, "");
  const { data } = supabase.storage.from("fotos").getPublicUrl(clean);
  if (data?.publicUrl) return data.publicUrl;
  const signed = await supabase.storage.from("fotos").createSignedUrl(clean, 3600);
  return signed?.data?.signedUrl || "";
}

export async function listAssetsFromStorage(eventId, { onlyHotspots = [] } = {}) {
  const root = `events/${eventId}`;
  async function listAllFiles(folder) {
    const acc = [];
    const stack = [folder];
    while (stack.length) {
      const cur = stack.pop();
      const { data } = await supabase.storage.from("fotos").list(cur, { limit: 1000 });
      for (const entry of data || []) {
        if (entry.name && /\.[a-z0-9]{2,4}$/i.test(entry.name)) acc.push(`${cur}/${entry.name}`);
        else if (entry.name) stack.push(`${cur}/${entry.name}`);
      }
    }
    return acc;
  }
  const files = await listAllFiles(root);
  const items = [];
  for (const p of files) {
    const parts = p.split("/").filter(Boolean);
    const idxEv = parts.indexOf("events");
    const evId = parts[idxEv + 1];
    const hsId = parts[idxEv + 2] || null;
    if (String(evId) !== String(eventId)) continue;
    if (onlyHotspots.length && (!hsId || !onlyHotspots.includes(String(hsId)))) continue;
    const url = await getPublicUrl(p);
    items.push({ id: p, url, timestamp: null, hotspotId: hsId, photographerId: null });
  }
  return items;
}

/* ================== Supabase helpers (IDs/relaciones) ================== */
export async function getEventRouteIdsByName(routeName, { photographerIds = [], eventId = null } = {}) {
  if (!routeName) return [];
  const alias = (ROUTE_ALIAS[routeName] || [routeName]).map(norm);

  let q = supabase.from("event_route").select("id, name, event_id");
  if (eventId) q = q.eq("event_id", eventId);
  if (!eventId && photographerIds.length) {
    const { data: evs, error: evErr } = await supabase
      .from("event")
      .select("id, photographer_id")
      .in("photographer_id", photographerIds);
    if (evErr) throw evErr;
    const evIds = (evs || []).map((e) => String(e.id));
    if (evIds.length === 0) return [];
    q = q.in("event_id", evIds);
  }
  const { data: routes, error } = await q;
  if (error) throw error;

  const matched = (routes || []).filter((r) => {
    const n = norm(r.name);
    return alias.some((a) => n.includes(a));
  });

  return matched.map((r) => String(r.id));
}

export async function getHotspotsByRouteIds(routeIds = [], { names = [] } = {}) {
  if (!routeIds.length) return [];
  let q = supabase.from("event_hotspot").select("id, name, route_id, event_id").in("route_id", routeIds);
  if (names?.length) q = q.in("name", names.map(String));
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// Eventos del/los fotógrafos en la FECHA exacta para esa ruta
export async function getEventIdsByDateRouteAndPhotogs({ fechaYmd, routeName, photographerIds = [] }) {
  if (!photographerIds.length || !fechaYmd) return [];
  const alias = (ROUTE_ALIAS[routeName] || [routeName]).map(norm);

  const { data: evs } = await supabase
    .from("event")
    .select("id, fecha, date, ruta, location, photographer_id")
    .in("photographer_id", photographerIds);

  const out = [];
  for (const e of (evs || [])) {
    const dStr = toYmd(e.fecha) || toYmd(e.date);
    if (!dStr || dStr !== fechaYmd) continue;
    const txt = norm(e.ruta || e.location || "");
    if (alias.some((a) => txt.includes(a))) out.push(String(e.id));
  }
  return out;
}

// Eventos (cualquier fotógrafo) por FECHA + RUTA
export async function getEventsByDateAndRoute({ fechaYmd, routeName }) {
  if (!fechaYmd || !routeName) return { evIds: [], eventMap: new Map() };
  const alias = (ROUTE_ALIAS[routeName] || [routeName]).map(norm);

  const { data: evs, error } = await supabase
    .from("event")
    .select("id, fecha, date, ruta, location, photographer_id");
  if (error) throw error;

  const evIds = [];
  const eventMap = new Map(); // id -> photographer_id
  for (const e of evs || []) {
    const dStr = toYmd(e.fecha) || toYmd(e.date);
    if (!dStr || dStr !== fechaYmd) continue;
    const txt = norm(e.ruta || e.location || "");
    if (!alias.some((a) => txt.includes(a))) continue;
    evIds.push(String(e.id));
    eventMap.set(String(e.id), e.photographer_id ? String(e.photographer_id) : null);
  }
  return { evIds, eventMap };
}

// Eventos (cualquier fotógrafo) solo por RUTA (ignorar fecha/hora)
export async function getEventsByRoute({ routeName }) {
  if (!routeName) return { evIds: [], eventMap: new Map() };
  const alias = (ROUTE_ALIAS[routeName] || [routeName]).map(norm);

  const { data: evs, error } = await supabase
    .from("event")
    .select("id, fecha, date, ruta, location, photographer_id");
  if (error) throw error;

  const evIds = [];
  const eventMap = new Map();
  for (const e of evs || []) {
    const txt = norm(e.ruta || e.location || "");
    if (!alias.some((a) => txt.includes(a))) continue;
    evIds.push(String(e.id));
    eventMap.set(String(e.id), e.photographer_id ? String(e.photographer_id) : null);
  }
  return { evIds, eventMap };
}
