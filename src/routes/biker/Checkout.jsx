// src/routes/biker/Checkout.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useCart } from "../../state/CartContext.jsx";
import { supabase } from "../../lib/supabaseClient";

// ================== Utils ==================
const fmtQ = (n) =>
  `Q${Math.round(Number(n || 0)).toLocaleString("es-GT", {
    useGrouping: true,
    maximumFractionDigits: 0,
  })}`;

const classNames = (...xs) => xs.filter(Boolean).join(" ");

const emailOk = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
const phoneOkGT = (s) => /^\+?(\d{8,12})$/.test(String(s || "").replace(/\s+/g, ""));

function genUUID() {
  // uuid v4 simple
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 0xf) >> 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Estados de sub-orden/pedido
const ESTADOS = {
  EN_PROCESO: "EN_PROCESO", // creado, sin pago aún
  PENDIENTE: "PENDIENTE",   // usuario envió comprobante, falta que el fotógrafo confirme
  PAGADO: "PAGADO",         // fotógrafo confirmó pago
  COMPLETADO: "COMPLETADO", // fotos entregadas
  CANCELADO: "CANCELADO",
};

// Agrega query param vendor para deep-link
const buildOrderLink = (orderId, vendorId) => {
  if (!orderId) return "";
  const base = `/app/historial/${orderId}`;
  return vendorId ? `${base}?vendor=${encodeURIComponent(vendorId)}` : base;
};

// Mensaje prellenado para WhatsApp
const buildWaMessage = ({ buyerName, orderId, vendorId }) => {
  const link = buildOrderLink(orderId, vendorId);
  const lines = [
    `¡Hola! Soy ${buyerName || "cliente"}.`,
    `Te escribo por mi pedido #${String(orderId).slice(0, 8)}.`,
    `Podés ver los detalles aquí: ${link}`,
  ];
  return encodeURIComponent(lines.join("\n"));
};

// ================== Checkout ==================
export default function Checkout() {
  const { items, clear, removeItem, getPhotographerName } = useCart();

  // ====== Agrupar por fotógrafo ======
  const grouped = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const pid = String(it?.meta?.photographerId || "na");
      if (!map.has(pid)) {
        map.set(pid, {
          pid,
          name: getPhotographerName(it),
          items: [],
          total: 0,
        });
      }
      const g = map.get(pid);
      g.items.push(it);
      g.total += (Number(it.price) || 0) * (it.qty || 1);
    }
    return Array.from(map.values());
  }, [items, getPhotographerName]);

  const subTotalQ = useMemo(
    () => items.reduce((s, it) => s + (Number(it.price) || 0) * (it.qty || 1), 0),
    [items]
  );

  // ====== Perfil (autorrellenar) ======
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [buyer, setBuyer] = useState({
    nombre: "",
    email: "",
    whatsapp: "",
    notas: "",
  });

  // Helpers para mapear campos "creativos" de perfiles
  const pickName = (obj) => {
    if (!obj) return "";
    const n1 = obj.full_name || obj.display_name || obj.name;
    if (n1 && String(n1).trim()) return String(n1).trim();
    const first = obj.first_name || obj.firstname || obj.given_name;
    const last  = obj.last_name || obj.lastname || obj.family_name;
    if ((first && String(first).trim()) || (last && String(last).trim())) {
      return [first, last].filter(Boolean).join(" ").trim();
    }
    return "";
  };
  const pickPhone = (obj) => {
    if (!obj) return "";
    const cand =
      obj.whatsapp ||
      obj.phone_wa ||
      obj.phone ||
      obj.telefono ||
      obj.celular ||
      obj.mobile ||
      obj.whatsapp_gt ||
      obj.whats ||
      "";
    const raw = String(cand || "").trim();
    if (!raw) return "";
    const digits = raw.replace(/\D/g, "");
    // Si trae 8 dígitos chapines, lo dejamos así. Si trae prefijo (10-12), lo respetamos.
    if (digits.length === 8) return digits;
    if (digits.length >= 10) return digits;
    return raw; // último recurso
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingProfile(true);
        const { data: auth } = await supabase.auth.getUser();
        const u = auth?.user;
        const uid = u?.id;
        let name = pickName(u?.user_metadata) || "";
        let email = u?.email || "";
        let phone = pickPhone(u?.user_metadata) || "";

        // Intentar en "biker_profile"
        let profile = null;
        try {
          const { data } = await supabase
            .from("biker_profile")
            .select("*")
            .eq("user_id", uid)
            .maybeSingle();
          if (data) profile = data;
        } catch {}
        // Intentar en "perfil" (tabla general), si no se encontró en biker_profile
        if (!profile) {
          try {
            const { data } = await supabase
              .from("perfil")
              .select("*")
              .eq("id", uid)
              .maybeSingle();
            if (data) profile = data;
          } catch {}
        }

        if (profile) {
          // Nombre: biker_profile.nombre | perfil.display_name | otros campos
          name =
            profile.nombre ||
            profile.display_name ||
            pickName(profile) ||
            name ||
            "";
          // Email: biker_profile.correo | perfil.email | auth.email
          email = profile.correo || profile.email || email || "";
          // Teléfono/WhatsApp: biker_profile.telefono | perfil.phone | otros alias
          const p2 =
            profile.telefono ||
            profile.phone ||
            profile.whatsapp ||
            pickPhone(profile) ||
            "";
          phone = p2 || phone || "";
        }

        if (alive) {
          setBuyer((s) => ({
            ...s,
            nombre: s.nombre || name || "",
            email: s.email || email || "",
            whatsapp: s.whatsapp || phone || "",
          }));
        }
      } finally {
        if (alive) setLoadingProfile(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // ====== Cupón (opcional) ======
  const [coupon, setCoupon] = useState("");
  const [discountQ, setDiscountQ] = useState(0);
  const [couponInfo, setCouponInfo] = useState(null);

  const totalQ = Math.max(0, subTotalQ - discountQ);

  const tryApplyCoupon = () => {
    const code = String(coupon || "").trim().toUpperCase();
    if (!code) {
      setCouponInfo({ ok: false, msg: "Ingresá un cupón válido." });
      setDiscountQ(0);
      return;
    }
    let d = 0;
    if (code === "DOMINGO10") d = Math.round(subTotalQ * 0.1);
    else if (code === "BICI20") d = Math.round(subTotalQ * 0.2);
    else if (code === "QUINCE") d = 15;
    else {
      setCouponInfo({ ok: false, msg: "Cupón inválido o expirado." });
      setDiscountQ(0);
      return;
    }
    if (d > subTotalQ) d = subTotalQ;
    setDiscountQ(d);
    setCouponInfo({ ok: true, msg: `Cupón aplicado: -${fmtQ(d)}` });
  };

  // Repartir descuento proporcional entre fotógrafos (para los totales por sub-orden)
  const vendorTotals = useMemo(() => {
    if (!grouped.length) return [];
    if (!discountQ) return grouped.map((g) => ({ ...g, totalConDesc: g.total }));
    const result = [];
    let acc = 0;
    for (let i = 0; i < grouped.length; i++) {
      const g = grouped[i];
      const isLast = i === grouped.length - 1;
      let part = Math.round((g.total / Math.max(1, subTotalQ)) * discountQ);
      if (isLast) {
        // ajustar residuo al último
        const used = acc + part;
        const diff = discountQ - used;
        part += diff;
      } else {
        acc += part;
      }
      result.push({
        ...g,
        discount: part,
        totalConDesc: Math.max(0, g.total - part),
      });
    }
    return result;
  }, [grouped, subTotalQ, discountQ]);

  // ====== Bancos por fotógrafo (photographer_profile.pagos + telefono) ======
  const [bankByPhotog, setBankByPhotog] = useState(new Map());
  const visiblePids = useMemo(() => vendorTotals.map((g) => g.pid).filter(Boolean), [vendorTotals]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!visiblePids.length) return;
      try {
        const { data, error } = await supabase
          .from("photographer_profile")
          .select("user_id, pagos, telefono, whatsapp, phone, phone_wa, correo")
          .in("user_id", visiblePids);
        if (error) throw error;
        const map = new Map();
        for (const row of data || []) {
          // Normalizar 'pagos' → array de cuentas
          let cuentas = [];
          const pagos = row?.pagos;
          if (Array.isArray(pagos)) {
            cuentas = pagos;
          } else if (pagos && typeof pagos === "object") {
            if (Array.isArray(pagos.accounts)) cuentas = pagos.accounts;
            else if (pagos.banco || pagos.cuenta || pagos.nombre) cuentas = [pagos];
          }
          // WhatsApp/telefono del fotógrafo
          const waRaw =
            row?.telefono ||
            row?.phone_wa ||
            row?.whatsapp ||
            row?.phone ||
            "";
          const waDigits = String(waRaw || "").replace(/\D/g, "");
          map.set(String(row.user_id), { cuentas, whatsapp: waDigits });
        }
        if (alive) setBankByPhotog(map);
      } catch {
        // si falla, igual seguimos con placeholder
        const map = new Map();
        for (const pid of visiblePids) map.set(String(pid), { cuentas: [], whatsapp: "" });
        if (alive) setBankByPhotog(map);
      }
    })();
    return () => {
      alive = false;
    };
  }, [visiblePids.join(",")]);

  // ====== Crear pedido + sub-órdenes ======
  const [orderId, setOrderId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [phase, setPhase] = useState("fill"); // fill -> pay
  const [savedInDb, setSavedInDb] = useState(false);

  const canSubmit =
    items.length > 0 &&
    buyer.nombre.trim().length >= 2 &&
    emailOk(buyer.email) &&
    phoneOkGT(buyer.whatsapp) &&
    !creating;

  async function createOrder() {
    if (!canSubmit) return;
    setCreating(true);
    const id = genUUID();
    setOrderId(id);

    // payload principal
    const payload = {
      id,
      buyer_name: buyer.nombre.trim(),
      buyer_email: buyer.email.trim(),
      buyer_whatsapp: buyer.whatsapp.trim(),
      notas: buyer.notas.trim() || null,
      coupon: coupon.trim() || null,
      discount_q: discountQ,
      subtotal_q: subTotalQ,
      total_q: totalQ,
      status: ESTADOS.EN_PROCESO,
      created_at: new Date().toISOString(),
    };

    // items
    const itemsPayload = items.map((it) => ({
      order_id: id,
      item_id: String(it.id),
      img: it.img || null,
      price_q: Math.round(Number(it.price) || 0),
      qty: it.qty || 1,
      meta: it.meta || null,
      photographer_id: String(it?.meta?.photographerId || ""),
    }));

    // sub-órdenes por fotógrafo
    const vendorsPayload = vendorTotals.map((g) => ({
      order_id: id,
      photographer_id: g.pid,
      photographer_name: g.name,
      subtotal_q: Math.round(g.total),
      discount_q: Math.round(g.discount || 0),
      total_q: Math.round(g.totalConDesc),
      status: ESTADOS.EN_PROCESO,
      payment_proof_url: null,
      created_at: new Date().toISOString(),
    }));

    let okDb = false;
    try {
      // Si existen, guardamos. Si no, seguimos sin romper UX.
      // Tablas sugeridas:
      // checkout_order (id PK text, buyer_*, notas, coupon, discount_q, subtotal_q, total_q, status, created_at)
      // checkout_order_items (order_id, item_id, img, price_q, qty, meta, photographer_id)
      // checkout_order_vendor (order_id, photographer_id, photographer_name, subtotal_q, discount_q, total_q, status, payment_proof_url, created_at)
      const { error: e1 } = await supabase.from("checkout_order").insert(payload);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("checkout_order_items").insert(itemsPayload);
      if (e2) throw e2;
      const { error: e3 } = await supabase.from("checkout_order_vendor").insert(vendorsPayload);
      if (e3) throw e3;
      okDb = true;
    } catch (e) {
      // console.warn("No se pudo escribir a DB:", e?.message || e);
      okDb = false;
    }
    setSavedInDb(okDb);
    setPhase("pay");
    setCreating(false);
  }

  // ====== Operaciones por sub-orden ======
  async function uploadProof(orderId, pid, file) {
    if (!file || !orderId || !pid) return null;
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${orderId}/${pid}/${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage
        .from("payments") // <-- asegurate de tener este bucket
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("payments").getPublicUrl(data.path);
      return pub?.publicUrl || null;
    } catch (e) {
      return null;
    }
  }

  async function markVendorPending(orderId, pid, proofUrl) {
    // estado PENDIENTE cuando el usuario envió comprobante
    try {
      await supabase
        .from("checkout_order_vendor")
        .update({ status: ESTADOS.PENDIENTE, payment_proof_url: proofUrl || null })
        .eq("order_id", orderId)
        .eq("photographer_id", pid);
    } catch {}
  }

  // recomputa estado agregado de la orden (simple y robusto)
  async function recomputeOrderStatus(orderId) {
    try {
      const { data: rows } = await supabase
        .from("checkout_order_vendor")
        .select("status")
        .eq("order_id", orderId);

      const statuses = (rows || []).map((r) => r.status);
      if (!statuses.length) return;

      let agg = ESTADOS.EN_PROCESO;
      const all = (s) => statuses.every((x) => x === s);
      const some = (s) => statuses.some((x) => x === s);

      if (all(ESTADOS.CANCELADO)) agg = ESTADOS.CANCELADO;
      else if (all(ESTADOS.COMPLETADO)) agg = ESTADOS.COMPLETADO;
      else if (some(ESTADOS.PAGADO) || some(ESTADOS.PENDIENTE)) agg = ESTADOS.PENDIENTE;
      else agg = ESTADOS.EN_PROCESO;

      await supabase
        .from("checkout_order")
        .update({ status: agg })
        .eq("id", orderId);
    } catch {}
  }

  // ====== UI ======
  return (
    <main className="container-max px-5 py-8">
      <h1 className="text-2xl sm:text-3xl font-black mb-6">Checkout</h1>

      {items.length === 0 && !orderId && phase === "fill" ? (
        <div className="max-w-2xl text-slate-600">
          Tu carrito está vacío, mano. Regresá a buscar tus fotos y agregalas al carrito.
        </div>
      ) : (
        <>
          {phase === "fill" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Columna izquierda: Resumen */}
              <section className="lg:col-span-2 space-y-5">
                {grouped.map((g) => (
                  <article key={g.pid} className="border rounded-2xl overflow-hidden bg-white">
                    <header className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
                      <h2 className="font-extrabold text-slate-900 truncate">{g.name}</h2>
                      <div className="font-bold text-slate-900">{fmtQ(g.total)}</div>
                    </header>
                    <ul className="divide-y">
                      {g.items.map((it) => {
                        const ruta = it?.meta?.route || it?.meta?.ruta || it?.meta?.trayecto || "";
                        let punto = it?.meta?.hotspot || "";
                        if (/^[0-9a-f-]{16,}$/i.test(String(punto)) || /^\d{3,}$/.test(String(punto))) {
                          punto = "";
                        }
                        const archivo = it?.meta?.fileName || it?.meta?.filename || "";
                        const fecha = (it?.meta?.fecha && String(it.meta.fecha).trim()) || "";
                        const totalItem = Math.round((Number(it.price) || 0) * (it.qty || 1));
                        return (
                          <li key={it.id} className="p-3 sm:p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-24 h-24 rounded-lg border bg-white flex items-center justify-center overflow-hidden shrink-0">
                                {it.img ? (
                                  <img
                                    src={it.img}
                                    alt=""
                                    className="w-full h-full object-contain"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                ) : null}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-extrabold text-slate-900 truncate">
                                  {fecha || "—"}
                                </div>
                                <div className="mt-0.5 text-[12px] leading-tight text-slate-700 space-y-0.5">
                                  <div><span className="font-semibold">Ruta:</span> {ruta || "—"}</div>
                                  <div><span className="font-semibold">Punto:</span> {punto || "—"}</div>
                                  <div className="truncate"><span className="font-semibold">Archivo:</span> {archivo || "—"}</div>
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-2">
                                <div className="text-slate-900 font-bold">{fmtQ(totalItem)}</div>
                                <button
                                  className="h-7 px-3 rounded-md bg-red-600 text-white text-[12px] font-semibold"
                                  onClick={() => removeItem(it.id)}
                                >
                                  Quitar
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                ))}

                <div className="flex items-center justify-between">
                  <button
                    className="text-sm text-slate-600 hover:text-slate-800 underline"
                    onClick={clear}
                  >
                    Vaciar carrito
                  </button>
                  <div className="text-sm text-slate-500">
                    {items.length} foto{items.length === 1 ? "" : "s"} en total
                  </div>
                </div>
              </section>

              {/* Columna derecha: Datos + Cupón + Total */}
              <aside className="lg:col-span-1">
                <div className="rounded-2xl border bg-white p-4 space-y-4">
                  <h3 className="font-bold text-slate-900 text-lg">Tus datos</h3>

                  <div className="space-y-3">
                    <Field
                      label="Nombre completo"
                      placeholder="Tu nombre y apellido"
                      value={buyer.nombre}
                      onChange={(v) => setBuyer((s) => ({ ...s, nombre: v }))}
                      error={buyer.nombre === "" || buyer.nombre.trim().length >= 2 ? "" : "Decime tu nombre completo"}
                      loading={loadingProfile}
                    />
                    <Field
                      label="Correo"
                      placeholder="tu@correo.com"
                      value={buyer.email}
                      onChange={(v) => setBuyer((s) => ({ ...s, email: v }))}
                      error={buyer.email === "" || emailOk(buyer.email) ? "" : "Ingresá un correo válido"}
                      loading={loadingProfile}
                    />
                    <Field
                      label="WhatsApp"
                      placeholder="Ej. 55555555"
                      value={buyer.whatsapp}
                      onChange={(v) => setBuyer((s) => ({ ...s, whatsapp: v }))}
                      helper="Para confirmarte y enviarte el enlace de tus fotos."
                      error={buyer.whatsapp === "" || phoneOkGT(buyer.whatsapp) ? "" : "Número inválido"}
                      loading={loadingProfile}
                    />

                    <Field
                      label="Notas (opcional)"
                      placeholder="Algo que debamos saber..."
                      value={buyer.notas}
                      onChange={(v) => setBuyer((s) => ({ ...s, notas: v }))}
                      isTextArea
                    />
                  </div>

                  {/* Cupón */}
                  <div className="pt-2">
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                      Cupón (opcional)
                    </label>
                    <div className="flex gap-2">
                      <input
                        className="h-10 px-3 rounded-lg border bg-white flex-1"
                        placeholder="DOMINGO10, QUINCE, BICI20…"
                        value={coupon}
                        onChange={(e) => setCoupon(e.target.value)}
                      />
                      <button
                        className="h-10 px-3 rounded-lg bg-slate-900 text-white text-sm"
                        onClick={tryApplyCoupon}
                      >
                        Aplicar
                      </button>
                    </div>
                    {couponInfo ? (
                      <div
                        className={classNames(
                          "mt-1 text-[12px]",
                          couponInfo.ok ? "text-emerald-600" : "text-red-600"
                        )}
                      >
                        {couponInfo.msg}
                      </div>
                    ) : null}
                  </div>

                  {/* Totales */}
                  <div className="border-t pt-3 space-y-1 text-sm">
                    <Row label="Subtotal" value={fmtQ(subTotalQ)} />
                    <Row label="Descuento" value={discountQ ? `- ${fmtQ(discountQ)}` : "—"} />
                    <Row label="Total" value={fmtQ(totalQ)} bold />
                  </div>

                  <button
                    disabled={!canSubmit}
                    className={classNames(
                      "w-full h-11 rounded-xl font-bold",
                      canSubmit
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : "bg-slate-200 text-slate-500 cursor-not-allowed"
                    )}
                    onClick={createOrder}
                  >
                    {creating ? "Creando pedido…" : "Continuar al pago"}
                  </button>
                </div>
              </aside>
            </div>
          )}

          {phase === "pay" && orderId && (
            <div className="space-y-6">
              <header className="rounded-2xl border bg-white p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-500">Pedido</div>
                  <div className="font-mono text-lg font-bold">#{String(orderId).slice(0, 8)}</div>
                  <div className="text-[12px] text-slate-500">
                    Estado: <span className="font-semibold">EN PROCESO</span>
                    {savedInDb ? "" : " (no guardado en sistema)"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-500">Total</div>
                  <div className="text-lg font-extrabold">{fmtQ(totalQ)}</div>
                </div>
              </header>

              {vendorTotals.map((g) => {
                const bank = bankByPhotog.get(String(g.pid)) || { cuentas: [], whatsapp: "" };
                const cuentas = Array.isArray(bank.cuentas) ? bank.cuentas : [];
                // si son 8 dígitos chapines, anteponer +502; si ya trae prefijo, respetarlo
                let waTo = null;
                if (bank.whatsapp) {
                  const d = String(bank.whatsapp).replace(/\D/g, "");
                  waTo = d.length === 8 ? `https://wa.me/502${d}` : `https://wa.me/${d}`;
                }
                const [file, setFile] = useState(null);
                const [sending, setSending] = useState(false);
                const [sent, setSent] = useState(false);

                // componente inline para cada vendor
                const onConfirmPago = async () => {
                  setSending(true);
                  let url = null;
                  if (file) {
                    url = await uploadProof(orderId, g.pid, file);
                  }
                  // marca PENDIENTE (comprobante enviado)
                  await markVendorPending(orderId, g.pid, url);
                  await recomputeOrderStatus(orderId);
                  setSent(true);
                  setSending(false);
                };

                const waLink = `${waTo || "https://wa.me/502"}?text=${buildWaMessage({
                  buyerName: buyer.nombre,
                  orderId,
                  vendorId: g.pid,
                })}`;

                return (
                  <article key={g.pid} className="rounded-2xl border bg-white p-4">
                    <header className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-bold text-slate-900 text-lg truncate">
                        {g.name}
                      </h3>
                      <div className="text-right">
                        <div className="text-sm text-slate-500">Total a pagar</div>
                        <div className="text-lg font-extrabold">{fmtQ(g.totalConDesc)}</div>
                      </div>
                    </header>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-700 mb-1">Cuentas del fotógrafo</div>
                        {cuentas.length ? (
                          <ul className="space-y-1 text-sm">
                            {cuentas.map((c, idx) => (
                              <li key={idx} className="rounded-md border p-2">
                                <div><span className="font-semibold">Banco:</span> {c.banco || c.bank || "—"}</div>
                                <div><span className="font-semibold">Tipo:</span> {c.tipo || c.type || "—"}</div>
                                <div><span className="font-semibold">Cuenta:</span> {c.cuenta || c.number || c.no || "—"}</div>
                                <div><span className="font-semibold">Nombre:</span> {c.nombre || c.holder || "—"}</div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-sm text-slate-600">
                            El fotógrafo aún no publicó cuentas. Escribile por WhatsApp para coordinar el pago.
                          </div>
                        )}

                        <a
                          className="inline-flex items-center gap-2 mt-3 h-10 px-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold"
                          href={waLink}
                          target="_blank"
                          rel="noreferrer"
                          title="Chatear por WhatsApp"
                        >
                          WhatsApp con el fotógrafo
                        </a>
                      </div>

                      <div>
                        <div className="text-sm font-semibold text-slate-700 mb-1">Adjuntar comprobante</div>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => setFile(e.target.files?.[0] || null)}
                          className="block w-full text-sm border rounded-lg p-2 bg-white"
                        />
                        <button
                          disabled={sending || sent || !orderId}
                          onClick={onConfirmPago}
                          className={classNames(
                            "mt-3 h-10 px-3 rounded-lg text-sm font-semibold",
                            sending || sent
                              ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                              : "bg-blue-600 hover:bg-blue-700 text-white"
                          )}
                        >
                          {sent ? "Comprobante enviado ✔" : sending ? "Enviando…" : "Confirmar pago"}
                        </button>

                        <div className="text-[12px] text-slate-600 mt-2">
                          Al confirmar, el estado pasa a <strong>PENDIENTE</strong> hasta que el fotógrafo valide el pago.
                        </div>
                      </div>
                    </div>

                    <footer className="mt-4 text-[12px] text-slate-600">
                      Link de orden:{" "}
                      <a className="underline" href={buildOrderLink(orderId, g.pid)}>
                        {buildOrderLink(orderId, g.pid)}
                      </a>
                    </footer>
                  </article>
                );
              })}

              <div className="rounded-2xl border bg-white p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-slate-600">
                  Cuando todas las sub-órdenes estén <strong>COMPLETADAS</strong>, tu pedido quedará cerrado.
                </div>
                <div className="flex gap-2">
                  <a
                    className="h-10 px-3 rounded-lg border text-sm flex items-center"
                    href={buildOrderLink(orderId)}
                  >
                    Ver mi pedido
                  </a>
                  <button
                    className="h-10 px-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold"
                    onClick={() => {
                      // Después de pasar a “pago”, limpiamos el carrito para evitar compras duplicadas
                      clear();
                    }}
                  >
                    Listo, gracias
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

// ====== Subcomponentes ======
function Field({ label, placeholder, value, onChange, error, helper, isTextArea, loading }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-slate-700 mb-1">{label}</label>
      {isTextArea ? (
        <textarea
          className={classNames(
            "w-full min-h-[84px] px-3 py-2 rounded-lg border bg-white",
            error ? "border-red-400" : "border-slate-300"
          )}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading}
        />
      ) : (
        <input
          className={classNames(
            "w-full h-10 px-3 rounded-lg border bg-white",
            error ? "border-red-400" : "border-slate-300"
          )}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading}
        />
      )}
      {helper ? <div className="text-[11px] text-slate-500 mt-1">{helper}</div> : null}
      {error ? <div className="text-[11px] text-red-600 mt-1">{error}</div> : null}
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={classNames("flex items-center justify-between", bold ? "font-extrabold text-slate-900" : "text-slate-700")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
