import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import UploadManager from "./upload/UploadManager.jsx";
import { supabase } from "../../lib/supabaseClient";
import { useModal, useToast } from "../../state/ui.jsx";
import PhotoLightbox from "../../components/PhotoLightbox";

/* ===== Utils ===== */
const fmtDate = (iso) =>
  new Date((iso || "") + "T00:00:00").toLocaleDateString("es-GT", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

function formatQ(val) {
  if (val === null || val === undefined) return "—";
  const n = Number(String(val).replace(/[^\d.]/g, ""));
  if (!isFinite(n)) return "—";
  return `Q${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

function windowsFromPerfilPunto(p) {
  try {
    const horarios = Array.isArray(p?.horarios) ? p.horarios : [];
    const dom = horarios.find((h) => (h?.dia ?? "").toLowerCase() === "domingo");
    const h0 = dom || horarios[0] || {};
    const start = String(h0?.inicio ?? "06:00");
    const end = String(h0?.fin ?? "12:00");
    return [{ start, end }];
  } catch {
    return [{ start: "06:00", end: "12:00" }];
  }
}

function mapEventRow(row) {
  return {
    id: row.id,
    nombre: row.nombre ?? row.title ?? `Evento ${row.id}`,
    fecha: row.fecha ?? row.date ?? new Date().toISOString().slice(0, 10),
    ruta: row.ruta ?? row.location ?? "",
    estado: row.estado ?? (row.status === "published" ? "publicado" : "borrador"),
    precioBase: row.precioBase ?? row.base_price ?? 50,
    notas: row.notas ?? row.notes ?? "",
    price_list_id: row.price_list_id ?? null,
    photographer_id: row.photographer_id ?? row.created_by ?? null,
    cover_url: row.cover_url || row.portada_url || row.portada || row.cover || null, // ← portada
  };
}

function buildEventPatch(ev) {
  return {
    title: ev.nombre,
    date: ev.fecha,
    status: ev.estado === "publicado" ? "published" : "borrador" === ev.estado ? "draft" : "draft",
    nombre: ev.nombre,
    fecha: ev.fecha,
    ruta: ev.ruta,
    location: ev.ruta,
    estado: ev.estado,
    precioBase: ev.precioBase,
    notas: ev.notas,
    cover_url: ev.cover_url || null, // ← portada
    // Solo guardar si es UUID válido; si viene "pl_xxx" u otra cosa → null
    price_list_id: isValidUuid(ev.price_list_id) ? ev.price_list_id : null,
  };
}

function isValidUuid(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/* ===== Componente ===== */
export default function EventoEditor() {
  const routeParams = useParams();
  const [searchParams] = useSearchParams();
  const paramId = routeParams.id || routeParams.eventId || routeParams.evId || "";
  const initialTab = searchParams.get("tab") || "resumen";

  const [ev, setEv] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [puntos, setPuntos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(initialTab);
  const [authReady, setAuthReady] = useState(false);
  const [noSession, setNoSession] = useState(false);
  const [uid, setUid] = useState(null);

  // Catálogo leído del perfil (JSON)
  const [catalog, setCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // Listas de precios (del perfil)
  const [priceLists, setPriceLists] = useState([]);
  // Valor de selección en UI (puede no ser UUID)
  const [uiSelectedPl, setUiSelectedPl] = useState("");

  // Subida
  const [uploadPoint, setUploadPoint] = useState("");
  // UI (modal + toasts)
  const { openModal } = useModal();
  const { toast } = useToast();

  // Handlers de portada (upload/cambiar/eliminar) — inline para evitar TDZ
  const handleCoverPick = async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!ev?.id) throw new Error("Evento inválido");
      const publicUrl = await uploadCoverToStorage(file, ev.id);
      await setCoverUrl(ev.id, publicUrl);
      setEv((o) => ({ ...o, cover_url: publicUrl }));
      toast({
        type: "success",
        title: "Portada actualizada",
        description: "Se cambió la imagen de portada.",
        position: "bottom-right"
      });
      e.target.value = "";
    } catch (err) {
      console.error(err);
      toast({
        type: "error",
        title: "No se pudo subir la portada",
        description: err.message || "Error subiendo imagen.",
        position: "bottom-right"
      });
    }
  };

  const removeCover = async () => {
    try {
      if (!ev?.id) return;
      await setCoverUrl(ev.id, null);
      setEv((o) => ({ ...o, cover_url: null }));
      toast({
        type: "success",
        title: "Portada eliminada",
        description: "Se quitó la portada del evento.",
        position: "bottom-right"
      });
    } catch (err) {
      console.error(err);
      toast({
        type: "error",
        title: "No se pudo eliminar la portada",
        description: err.message || "Error actualizando evento.",
        position: "bottom-right"
      });
    }
  };

  // Lightbox de portada
  const [lbOpen, setLbOpen] = useState(false);

  /* ==== Hooks MEMO ==== */
  const fotosPorPunto = useMemo(() => {
    const map = new Map();
    const arr = Array.isArray(fotos) ? fotos : [];
    for (const f of arr) {
      const k = f?.hotspot_id || null;
      const prev = map.get(k) || [];
      prev.push(f);
      map.set(k, prev);
    }
    for (const [, list] of map) list.sort((a, b) => new Date(a?.taken_at || 0) - new Date(b?.taken_at || 0));
    return map;
  }, [fotos]);

  const catalogFiltered = useMemo(() => {
    if (!ev?.ruta) return Array.isArray(catalog) ? catalog : [];
    return (Array.isArray(catalog) ? catalog : []).filter((h) => (h.route_name || "") === ev.ruta);
  }, [catalog, ev?.ruta]);

  useEffect(() => {
    if (!uploadPoint && puntos.length) setUploadPoint(puntos[0].id);
  }, [puntos, uploadPoint]);

  /* ---- Sesión ---- */
  useEffect(() => {
    let unsub;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const sUid = data?.session?.user?.id || null;
      setUid(sUid);
      if (!data?.session) {
        unsub = supabase.auth.onAuthStateChange((_e, session) => {
          setUid(session?.user?.id || null);
          setAuthReady(true);
          setNoSession(!session?.user?.id);
        }).data?.subscription;
        setAuthReady(true);
        setNoSession(true);
      } else {
        setAuthReady(true);
        setNoSession(false);
      }
    })();
    return () => unsub?.unsubscribe?.();
  }, []);

  /* ---- Evento + assets ---- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!authReady) return;
        if (!paramId) throw new Error("Falta el id del evento en la URL");
        setLoading(true);

        const { data: row, error } = await supabase
          .from("event")
          .select("*")
          .eq("id", paramId)
          .maybeSingle();
        if (error) throw error;
        if (!row) throw new Error("Evento no encontrado");
        if (!mounted) return;
        setEv(mapEventRow(row));

        const { data: assets, error: aErr } = await supabase
          .from("event_asset")
          .select("*")
          .eq("event_id", paramId)
          .order("taken_at", { ascending: true });
        if (aErr) console.warn("[EventoEditor] event_asset error:", aErr?.message || aErr);
        if (!mounted) return;
        setFotos(Array.isArray(assets) ? assets : []);
      } catch (e) {
        console.error(e);
        if (mounted) {
          setEv(null);
          setFotos([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, [paramId, authReady]);

  /* ---- Catálogo desde photographer_profile.puntos + price_lists ---- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingCatalog(true);
        const ownerId = ev?.photographer_id || uid;
        if (!ownerId) {
          if (mounted) setCatalog([]);
          return;
        }
        const { data: profile, error: profErr } = await supabase
          .from("photographer_profile")
          .select("puntos, price_lists")
          .eq("user_id", ownerId)
          .maybeSingle();
        if (profErr) throw profErr;

        let puntosPerfil = [];
        const raw = profile?.puntos;
        if (Array.isArray(raw)) puntosPerfil = raw;
        else if (typeof raw === "string" && raw.trim().startsWith("[")) {
          try { puntosPerfil = JSON.parse(raw); } catch {}
        }

        const mapped = (puntosPerfil || []).map((p, i) => ({
          key: String(p?.id ?? `${p?.nombre}-${p?.ruta}-${p?.lat}-${p?.lon}-${i}`),
          id: p?.id ?? null,
          name: String(p?.nombre ?? "Punto"),
          route_name: String(p?.ruta ?? ""),
          lat: p?.lat != null ? Number(p.lat) : null,
          lng: p?.lon != null ? Number(p.lon) : null,
          default_windows: windowsFromPerfilPunto(p),
        }));

        // Listas de precios del perfil
        let pls = [];
        const rawPls = profile?.price_lists;
        if (Array.isArray(rawPls)) pls = rawPls;
        else if (typeof rawPls === "string" && rawPls.trim().startsWith("[")) {
          try { pls = JSON.parse(rawPls); } catch {}
        }

        if (!mounted) return;
        setCatalog(mapped);
        setPriceLists(Array.isArray(pls) ? pls : []);
      } catch (e) {
        console.warn("[EventoEditor] catalog error:", e?.message || e);
        if (mounted) setCatalog([]);
      } finally {
        if (mounted) setLoadingCatalog(false);
      }
    })();
    return () => (mounted = false);
  }, [ev?.photographer_id, uid]);

  // Mantener sincronizado el select con el valor del evento cuando cambia
  useEffect(() => {
    setUiSelectedPl(ev?.price_list_id || "");
  }, [ev?.price_list_id]);

  /* ---- Puntos del evento ---- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!ev?.id) return;
        const { data: ehs, error: ehErr } = await supabase
          .from("event_hotspot")
          .select("id, name, lat, lng, windows, route_id")
          .eq("event_id", ev.id)
          .order("id", { ascending: true });
        if (ehErr) throw ehErr;

        const puntosIniciales = (Array.isArray(ehs) ? ehs : []).map((h) => ({
          id: h.id,
          nombre: h.name || "Punto",
          activo: true,
          horaIni: (Array.isArray(h.windows) && h.windows[0]?.start) || "06:00",
          horaFin: (Array.isArray(h.windows) && h.windows[0]?.end) || "12:00",
          route_id: h.route_id || null,
        }));
        if (!mounted) return;
        setPuntos(puntosIniciales);
      } catch (e) {
        console.warn("[EventoEditor] event_hotspot error:", e?.message || e);
        if (mounted) setPuntos([]);
      }
    })();
    return () => (mounted = false);
  }, [ev?.id]);

  /* ---- Realtime sobre event_asset ---- */
  useEffect(() => {
    if (!ev?.id) return;
    const channel = supabase
      .channel(`event_asset:${ev.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_asset', filter: `event_id=eq.${ev.id}` },
        (_payload) => {
          refreshAssets();
        }
      )
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [ev?.id]);

  /* ---- helpers SQL ---- */
  async function ensureEventRouteId(eventId, routeName) {
    if (!routeName) return null;
    const { data: rows } = await supabase
      .from("event_route")
      .select("id")
      .eq("event_id", eventId)
      .eq("name", routeName)
      .maybeSingle();
    if (rows?.id) return rows.id;
    const { data: inserted, error: insErr } = await supabase
      .from("event_route")
      .insert([{ event_id: eventId, name: routeName }])
      .select("id")
      .single();
    if (insErr) throw insErr;
    return inserted.id;
  }

  /* ---- Acciones evento ---- */
  async function guardarTodo() {
    await openModal({
      variant: "confirm",
      title: "¿Guardar cambios del evento?",
      description: "Se actualizará la info del evento y los horarios de cada punto.",
      confirmText: "Guardar",
      cancelText: "Cancelar",
      async: true,
      onConfirm: async () => {
        const patch = buildEventPatch(ev);
        const { error } = await supabase.from("event").update(patch).eq("id", ev.id);
        if (error) throw error;

        const { data: row } = await supabase.from("event").select("*").eq("id", ev.id).maybeSingle();
        if (row) setEv(mapEventRow(row));

        for (const p of puntos) {
          const windows = [{ start: p.horaIni || "06:00", end: p.horaFin || "12:00" }];
          await supabase.from("event_hotspot").update({ windows }).eq("id", p.id);
        }
        toast({ type: "success", title: "Cambios guardados", description: "Todo quedó al 100.", position: "bottom-right" });
      },
    });
  }

  async function publicarToggle() {
    const nuevo = ev.estado === "publicado" ? "borrador" : "publicado";
    try {
      const { error } = await supabase
        .from("event")
        .update({ 
          estado: nuevo,
          status: nuevo === "publicado" ? "published" : "draft",
        })
        .eq("id", ev.id);
      if (error) throw error;
      setEv((o) => ({ ...o, estado: nuevo }));
    } catch (e) {
      console.error(e);
      alert("No se pudo cambiar el estado del evento.");
    }
  }

  function updatePointLocal(pid, patch) {
    setPuntos((arr) => arr.map((p) => (p.id === pid ? { ...p, ...patch } : p)));
  }

  async function addPointFromCatalog(h) {
    try {
      if (!h) return;
      if (puntos.some((p) => p.nombre === (h.name || h.nombre))) {
        return alert("Ya agregaste este punto 😅");
      }
      const routeId = await ensureEventRouteId(ev.id, ev.ruta || "");
      const windows = Array.isArray(h.default_windows) && h.default_windows.length
        ? h.default_windows
        : [{ start: "06:00", end: "12:00" }];

      const payload = {
        event_id: ev.id,
        route_id: routeId,
        ...(isValidUuid(h.id) ? { source_hotspot_id: h.id } : {}),
        name: h.name || h.nombre || "Punto",
        lat: Number(h.lat ?? 0),
        lng: Number(h.lng ?? 0),
        windows,
      };
      const { data: inserted, error } = await supabase
        .from("event_hotspot")
        .insert([payload])
        .select("id, name, windows, route_id")
        .single();
      if (error) throw error;

      const w0 = inserted?.windows?.[0] || {};
      setPuntos((arr) => [
        ...arr,
        {
          id: inserted.id,
          nombre: inserted.name,
          activo: true,
          horaIni: w0.start || "06:00",
          horaFin: w0.end || "12:00",
          route_id: inserted?.route_id || null,
        },
      ]);
      if (!uploadPoint) setUploadPoint(inserted.id);
    } catch (e) {
      console.error(e);
      alert("No se pudo agregar el punto.");
    }
  }

  async function removePoint(pid) {
    try {
      const { error } = await supabase.from("event_hotspot").delete().eq("id", pid);
      if (error) throw error;
      setPuntos((arr) => arr.filter((p) => p.id !== pid));
      if (uploadPoint === pid) setUploadPoint(puntos.find((x) => x.id !== pid)?.id || "");
    } catch (e) {
      console.error(e);
      alert("No se pudo quitar el punto (revisá si no tiene fotos asociadas).");
    }
  }

  /* ---- Helpers de Storage ---- */
  function getPublicUrl(storagePath) {
    if (!storagePath) return '';
    if (storagePath.startsWith('http')) return storagePath;
    const { data } = supabase.storage.from('fotos').getPublicUrl(storagePath);
    return data.publicUrl;
  }
  function splitStoragePath(storagePath) {
    const clean = String(storagePath || "").replace(/^\/+/, "");
    const parts = clean.split("/").filter(Boolean);
    const name = parts.pop() || "";
    const folder = parts.join("/");
    return { folder, name };
  }

  /* ---- subida firmada (fotos normales) ---- */
  async function getSignedUrl({ eventId, pointId, filename, size, contentType }) {
    try {
      if (!pointId || pointId === "") {
        throw new Error("Seleccioná un punto primero.");
      }
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token || null;
      if (!token) throw new Error("No se pudo obtener el token de autenticación");
      if (!isValidUuid(eventId)) throw new Error(`eventId no es UUID válido: ${eventId}`);
      if (!isValidUuid(pointId)) throw new Error(`pointId no es UUID válido: ${pointId}`);

      const { data, error } = await supabase.functions.invoke("signed-event-upload", {
        body: { eventId, pointId, filename, size, contentType },
        headers: { Authorization: `Bearer ${token}` }
      });
      if (error) throw new Error(error.message || "No se pudo firmar la subida");
      return data;
    } catch (error) {
      console.error("getSignedUrl:", error);
      throw error;
    }
  }

  async function onUploaded(assets) {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token || null;
      if (!token) throw new Error("Iniciá sesión para registrar fotos");

      const assetsToInsert = assets.map((a) => ({
        id: crypto.randomUUID(),
        event_id: ev.id,
        hotspot_id: a.pointId,
        storage_path: a.path,
        taken_at: new Date().toISOString(),
        meta: { 
          bytes: a.size,
          filename: a.filename || '',
          contentType: a.contentType || ''
        }
      }));

      const { data, error } = await supabase
        .from("event_asset")
        .insert(assetsToInsert)
        .select();
      if (error) throw new Error(`Error de base de datos: ${error.code} - ${error.message}`);

      const { data: rows, error: fetchError } = await supabase
        .from("event_asset")
        .select("*")
        .eq("event_id", ev.id)
        .order("taken_at", { ascending: true });
      if (fetchError) throw fetchError;
      setFotos(Array.isArray(rows) ? rows : []);
      toast({ type: "success", title: "Foto subida", description: "Se registró en el evento.", position: "bottom-right" });
    } catch (e) {
      console.error("onUploaded:", e);
      toast({ type: "error", title: "Error registrando foto", description: e.message || "Se subió la foto pero no se pudo registrar.", position: "bottom-right" });
    }
  }

  // Refrescar assets del evento
  async function refreshAssets() {
    const { data: rows, error } = await supabase
      .from("event_asset")
      .select("*")
      .eq("event_id", ev.id)
      .order("taken_at", { ascending: true });
    if (!error) setFotos(Array.isArray(rows) ? rows : []);
  }

  // Si la imagen ya no existe en el bucket, ofrecer limpiar el registro en DB
  async function handleMissingAsset(asset) {
    try {
      const ok = window.confirm(
        "Esta foto ya no existe en el bucket.\n¿Querés quitar también su registro del evento?"
      );
      if (!ok) return;
      const { error } = await supabase
        .from("event_asset")
        .delete()
        .eq("id", asset.id);
      if (error) throw error;
      setFotos((prev) => prev.filter((x) => x.id !== asset.id));
    } catch (e) {
      console.error("No se pudo limpiar el registro:", e);
      alert("No se pudo limpiar el registro en la base.");
    }
  }

  // Lista archivos reales en el bucket por carpeta y devuelve un Set con los nombres existentes
  async function listExistingInBucketByFolder(folder) {
    const { data, error } = await supabase.storage.from("fotos").list(folder || "", { limit: 1000 });
    if (error) throw error;
    const set = new Set((data || []).map((f) => f.name));
    return set;
  }

  // Reconciliar: compara event_asset vs objetos reales en bucket
  async function reconcileAssetsWithBucket({ strict = true } = {}) {
    if (!ev?.id) return;
    const byFolder = new Map();
    for (const a of fotos) {
      const { folder, name } = splitStoragePath(a.storage_path);
      if (!byFolder.has(folder)) byFolder.set(folder, []);
      byFolder.get(folder).push({ id: a.id, name, storage_path: a.storage_path });
    }
    const missing = [];
    for (const [folder, arr] of byFolder.entries()) {
      let existingSet;
      try {
        existingSet = await listExistingInBucketByFolder(folder);
      } catch (e) {
        console.warn("No se pudo listar folder:", folder, e?.message || e);
        continue;
      }
      for (const item of arr) {
        if (!existingSet.has(item.name)) {
          missing.push(item);
        }
      }
    }

    if (missing.length === 0) {
      await refreshAssets();
      return;
    }

    if (!strict) {
      setFotos((prev) => prev.filter((x) => !missing.some((m) => m.id === x.id)));
      return;
    }

    const ok = window.confirm(
      `Se detectaron ${missing.length} registro(s) sin archivo en el bucket.\n¿Querés eliminarlos también de la base?`
    );
    if (!ok) return;

    const ids = missing.map((m) => m.id);
    const { error } = await supabase.from("event_asset").delete().in("id", ids);
    if (error) {
      console.error("No se pudo limpiar huérfanos:", error);
      alert("No se pudieron eliminar algunos registros huérfanos.");
    }
    await refreshAssets();
  }

  /* ===== Render ===== */
  if (!authReady) return uiBox("Inicializando sesión…");
  if (noSession)
    return uiBox(
      <>
        Iniciá sesión para editar tu evento.
        <div className="mt-2 text-xs text-slate-400">Si ya iniciaste, recargá esta página.</div>
      </>
    );
  if (loading) return uiBox("Cargando…");
  if (!ev)
    return uiBox(
      <>
        <div className="mb-3 text-lg font-semibold">Evento no encontrado</div>
        <div className="text-xs text-slate-400 mb-3">
          Revisá que la URL sea <code>/studio/eventos/&lt;id&gt;</code>. Param recibido: <code>{paramId || "(vacío)"}</code>
        </div>
        <Link to="/studio/eventos" className="text-blue-400 font-semibold">Volver a eventos</Link>
      </>
    );

  const selectedList = isValidUuid(ev.price_list_id)
    ? priceLists.find((pl) => String(pl?.id || "") === String(ev.price_list_id))
    : null;

  const estadoTag = ev.estado === "publicado"
    ? { text: "Publicado", bg: "bg-emerald-600", ring: "ring-emerald-400/30" }
    : { text: "Borrador",  bg: "bg-amber-600",   ring: "ring-amber-400/30" };

  return (
    <main className="w-full max-w-[1100px] mx-auto px-5 py-6">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-3">
          <Link
            to="/studio/eventos"
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.12]"
            title="Volver al listado"
          >
            <span className="text-lg">←</span>
            <span className="text-sm font-medium">Volver</span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <button
              className="h-10 px-4 rounded-xl bg-green-600 hover:bg-green-700 text-white font-display font-bold border border-white/10"
              onClick={guardarTodo}
            >
              Guardar
            </button>
            <button
              className={`h-10 px-4 rounded-xl text-white font-display font-bold border border-white/10 ${
                ev.estado === "publicado" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
              }`}
              onClick={publicarToggle}
            >
              {ev.estado === "publicado" ? "Despublicar" : "Publicar"}
            </button>
          </div>
        </div>

        {/* Título y metadata */}
        <div className="mt-4">
          <h1 className="text-2xl md:text-3xl font-display font-black">{ev.nombre}</h1>
          <div className="mt-1 text-sm text-slate-300">
            {fmtDate(ev.fecha)} · {ev.ruta}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Tab active={tab === "resumen"} onClick={() => setTab("resumen")}>Resumen</Tab>
        <Tab active={tab === "puntos"} onClick={() => setTab("puntos")}>Puntos</Tab>
        <Tab active={tab === "subida"} onClick={() => setTab("subida")}>Subida</Tab>
        <Tab active={tab === "organizar"} onClick={() => setTab("organizar")}>Organizar</Tab>
      </div>

      {/* ===== Resumen ===== */}
      {tab === "resumen" && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Izquierda: info editable */}
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold mb-3">Información del evento</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nombre">
                <input className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3" value={ev.nombre} onChange={(e) => setEv({ ...ev, nombre: e.target.value })} />
              </Field>
              <Field label="Fecha">
                <input type="date" className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3" value={ev.fecha} onChange={(e) => setEv({ ...ev, fecha: e.target.value })} />
              </Field>
              <Field label="Ruta">
                <input className="h-11 w-full rounded-lg border border-white/15 bg-white/10 text-white px-3" value={ev.ruta} readOnly />
              </Field>

              {/* Si hay lista seleccionada, no mostramos precio base */}
              {!ev.price_list_id && (
                <Field label="Precio base (Q)">
                  <input
                    type="number"
                    min={1}
                    className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3"
                    value={ev.precioBase || 50}
                    onChange={(e) => setEv({ ...ev, precioBase: Number(e.target.value || 0) })}
                  />
                </Field>
              )}

              <Field label="Lista de precios">
                <select
                  className="h-11 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3"
                  value={uiSelectedPl}
                  onChange={(e) => {
                    const val = e.target.value || "";
                    setUiSelectedPl(val);
                    // Solo persistimos al estado del evento si es UUID válido
                    setEv({ ...ev, price_list_id: isValidUuid(val) ? val : null });
                  }}
                >
                  <option value="">— Sin lista (usa precio base)</option>
                  {priceLists.map((pl) => (
                    <option key={pl.id ?? pl.key ?? pl.nombre} value={pl.id ?? pl.key ?? pl.nombre}>
                      {pl.nombre}
                    </option>
                  ))}
                </select>
                {/* Aviso si la opción elegida no es UUID (no se guardará en la DB) */}
                {uiSelectedPl && !isValidUuid(uiSelectedPl) && (
                  <div className="mt-1 text-xs text-amber-300">
                    Esta lista no tiene ID válido (UUID). No se podrá asignar al evento hasta que tenga un UUID.
                  </div>
                )}
              </Field>

              <Field label="Notas (privadas)" full>
                <textarea rows={3} className="w-full rounded-lg border border-white/15 bg-white/5 text-white px-3 py-2" value={ev.notas || ""} onChange={(e) => setEv({ ...ev, notas: e.target.value })} />
              </Field>
            </div>

            {/* Portada */}
            <div className="mt-6">
              <h4 className="font-semibold mb-2">Portada del evento</h4>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:w-72 aspect-video rounded-xl overflow-hidden border border-white/10 bg-white/5 grid place-items-center">
                  {ev.cover_url ? (
                    <img
                      src={ev.cover_url}
                      alt="Portada del evento"
                      className="w-full h-full object-cover object-center"
                      onClick={() => setLbOpen(true)}
                      title="Ver grande"
                    />
                  ) : (
                    <div className="text-slate-400 text-sm">Sin portada</div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2">
                    {ev.cover_url && (
                      <button
                        className="h-10 px-3 rounded-lg bg-white/10 border border-white/15"
                        onClick={() => setLbOpen(true)}
                      >
                        Ver grande
                      </button>
                    )}
                    <label className="h-10 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center cursor-pointer">
                      Cambiar / Subir
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleCoverPick}
                      />
                    </label>
                    {ev.cover_url && (
                      <button
                        className="h-10 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white"
                        onClick={removeCover}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Recomendado 16:9 (ej. 1600×900).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Derecha: resumen formal */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold mb-3">Resumen</h3>

            {/* Estado grande */}
            <div className={`rounded-xl ${estadoTag.bg} ${estadoTag.ring} ring-2 text-white px-4 py-3 flex items-center justify-between`}>
              <div className="text-sm">Estado</div>
              <div className="text-lg font-display font-extrabold tracking-wide">{estadoTag.text}</div>
            </div>

            {/* KPIs */}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <KPI label="Puntos" value={puntos.length} />
              <KPI label="Fotos" value={fotos.length} />
            </div>

            {/* Lista de precios seleccionada (vista pública) */}
            {isValidUuid(ev.price_list_id) && selectedList ? (
              <div className="mt-4 rounded-xl border border-white/10 p-3 bg-white/5">
                <div className="text-xs text-slate-400 mb-1">Lista de precios</div>
                <div className="text-sm font-semibold mb-2">{selectedList.nombre}</div>
                {selectedList.notas ? (
                  <div className="text-xs text-slate-300 mb-2">{selectedList.notas}</div>
                ) : null}
                <div className="grid grid-cols-1 gap-2">
                  {(selectedList.items || []).map((it, idx) => (
                    <div key={idx} className="rounded-lg border border-white/10 p-2 bg-white/5 flex items-center justify-between">
                      <div className="text-sm">{it.nombre}</div>
                      <div className="text-base font-display font-bold">{formatQ(it.precio)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 text-xs text-white/70">
                Sin lista asignada. Se usará <strong>precio base</strong> (Q{ev.precioBase || 50}).
              </div>
            )}
          </div>
        </section>
      )}

      {/* ===== Puntos ===== */}
      {tab === "puntos" && (
        <section className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Puntos de foto</h3>
            </div>

            {puntos.length === 0 ? (
              <div className="text-slate-300 text-sm">Aún no agregaste puntos al evento.</div>
            ) : (
              <div className="space-y-3">
                {puntos.map((p) => {
                  const count = (fotos || []).filter((f) => (f.hotspot_id || null) === p.id).length;
                  return (
                    <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1">
                        <div className="font-semibold">{p.nombre}</div>
                        <div className="text-xs text-slate-400">
                          {p.horaIni || "—"} – {p.horaFin || "—"} · {count} foto{count === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div className="sm:w-[300px] grid grid-cols-3 gap-2">
                        <input type="time" className="h-10 rounded-lg border border-white/15 bg-white/5 text-white px-2" value={p.horaIni || ""} onChange={(e) => updatePointLocal(p.id, { horaIni: e.target.value })} />
                        <input type="time" className="h-10 rounded-lg border border-white/15 bg-white/5 text-white px-2" value={p.horaFin || ""} onChange={(e) => updatePointLocal(p.id, { horaFin: e.target.value })} />
                        <label className="inline-flex items-center gap-2 justify-center rounded-lg border border-white/15 bg-white/5">
                          <input type="checkbox" checked={!!p.activo} onChange={(e) => updatePointLocal(p.id, { activo: e.target.checked })} />
                          <span className="text-sm">Activo</span>
                        </label>
                      </div>
                      <button className="h-9 px-3 rounded-xl bg-red-600 text-white font-display font-bold" onClick={() => removePoint(p.id)}>Quitar</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold mb-3">Agregar desde mi catálogo</h3>

            {loadingCatalog ? (
              <div className="text-slate-300 text-sm">Cargando catálogo…</div>
            ) : (catalogFiltered || []).length === 0 ? (
              <div className="text-slate-300 text-sm">
                {catalog.length === 0
                  ? "No hay puntos en tu catálogo aún."
                  : `No hay puntos para la ruta “${ev.ruta}”. Cambiá la ruta del evento o creá puntos en tu perfil.`}
              </div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
                {catalogFiltered
                  .filter((h) => !puntos.some((p) => p.nombre === h.name))
                  .map((h, i) => (
                    <div key={h.key || `${h.name}-${h.route_name}-${h.lat}-${h.lng}-${i}`} className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{h.name}</div>
                        <div className="text-xs text-slate-400">{h.route_name}</div>
                        {Array.isArray(h.default_windows) && h.default_windows[0] && (
                          <div className="text-xs text-slate-400">
                            {h.default_windows[0].start}–{h.default_windows[0].end}
                          </div>
                        )}
                      </div>
                      <button className="h-8 px-3 rounded-lg bg-blue-600 text-white" onClick={() => addPointFromCatalog(h)}>
                        Agregar
                      </button>
                    </div>
                  ))}
                {catalogFiltered.length > 0 &&
                  catalogFiltered.every((h) => puntos.some((p) => p.nombre === h.name)) && (
                    <div className="text-slate-300 text-sm">Ya agregaste todos los puntos de esta ruta 🙌</div>
                  )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ===== Subida ===== */}
      {tab === "subida" && (
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-semibold mb-3">Subida de fotos</h3>
            
            {!uploadPoint && (
              <div className="bg-yellow-500/20 border border-yellow-500/50 p-3 rounded-lg mb-4">
                <div className="text-yellow-200 font-semibold">⚠️ Selecciona un punto</div>
                <div className="text-yellow-300 text-sm">Elige un punto de la lista antes de subir fotos</div>
              </div>
            )}
            
            {puntos.length === 0 ? (
              <div className="text-slate-300 text-sm">Agregá al menos un punto para habilitar la subida.</div>
            ) : (
              <UploadManager
                eventId={ev.id}
                pointId={uploadPoint}
                onUploaded={onUploaded}
                getSignedUrl={getSignedUrl}
                options={{ watermark: { src: null, scale: 0.25, opacity: 0.5, position: "br" } }}
              />
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3">
              <div className="text-xs text-slate-400 mb-1">Asignar al punto</div>
              <select 
                className="h-10 w-full rounded-lg border border-white/15 bg-white/5 text-white px-3" 
                value={uploadPoint} 
                onChange={(e) => setUploadPoint(e.target.value)}
              >
                <option value="">-- Selecciona un punto --</option>
                {puntos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-400">
              {!uploadPoint ? (
                <span className="text-yellow-400">⚠️ Selecciona un punto antes de subir fotos</span>
              ) : (
                "Arrastrá y soltá tus fotos. Se suben con URL firmada y luego se registran en la base."
              )}
            </div>
          </div>
        </section>
      )}

      {/* ===== Organizar ===== */}
      {tab === "organizar" && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Organizar por punto</h3>
            <button
              className="h-9 px-3 rounded-lg bg-white/10 border border-white/15"
              onClick={() => reconcileAssetsWithBucket({ strict: true })}
              title="Refrescar fotos del evento"
            >
              Refrescar
            </button>
          </div>
          {puntos.length === 0 ? (
            <div className="text-slate-300 text-sm">Sin puntos aún.</div>
          ) : (
            <div className="space-y-4">
              {puntos.map((p) => {
                const list = fotosPorPunto.get(p.id) || [];
                return (
                  <div key={p.id}>
                    <div className="font-semibold mb-2">
                      {p.nombre} · {p.horaIni ?? "—"}–{p.horaFin ?? "—"} · {list.length} foto{list.length === 1 ? "" : "s"}
                    </div>
                    {list.length === 0 ? (
                      <div className="text-slate-300 text-sm">Sin fotos aún.</div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {list.map((f) => (
                          <img 
                            key={f.id} 
                            src={getPublicUrl(f.storage_path)} 
                            alt="" 
                            className="w-full h-28 object-cover rounded-lg" 
                            onError={(e) => {
                              console.warn('Imagen no existe en bucket:', f.storage_path);
                              e.currentTarget.style.display = 'none';
                              handleMissingAsset(f);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Lightbox de portada */}
      {lbOpen && ev?.cover_url && (
        <PhotoLightbox
          images={[{ src: ev.cover_url, alt: "Portada del evento" }]}
          index={0}
          onIndexChange={() => {}}
          onClose={() => setLbOpen(false)}
          captionPosition="bottom-centered"
          arrowBlue
        />
      )}
    </main>
  );
}

/* ===== UI helpers ===== */
function uiBox(children) {
  return (
    <main className="w-full max-w-[1100px] mx-auto px-5 py-8">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">{children}</div>
    </main>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button
      className={
        "h-9 px-3 rounded-lg border " +
        (active ? "bg-blue-600 text-white border-white/10" : "bg-white/5 text-white border-white/15")
      }
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function Field({ label, full, children }) {
  return (
    <label className={"block " + (full ? "sm:col-span-2" : "")}>
      <div className="mb-1 text-sm text-slate-300">{label}</div>
      {children}
    </label>
  );
}

function KPI({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 p-3 bg-white/5">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="text-xl font-display font-bold">{value}</div>
    </div>
  );
}

/* ==== Portada: handlers ==== */
async function uploadCoverToStorage(file, eventId) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `covers/${eventId}/${Date.now()}_${file.name.replace(/[^\w.\-]+/g, "_")}`;
  const { error: upErr } = await supabase.storage.from("fotos").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || `image/${ext}`,
  });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from("fotos").getPublicUrl(path);
  return data.publicUrl;
}

async function setCoverUrl(eventId, url) {
  const { error } = await supabase.from("event").update({ cover_url: url }).eq("id", eventId);
  if (error) throw error;
}