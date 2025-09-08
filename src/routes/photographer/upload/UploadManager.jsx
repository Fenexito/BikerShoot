// src/pages/upload/UploadManager.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

// ============ Config ============
const CONCURRENCY = 1; // Reducido a 1 para debugging
const CHUNK_SIZE = 5 * 1024 * 1024;
const ACCEPT = "image/*";

// ============ Marca de agua opcional ============
async function applyWatermarkToFile(file, watermarkImg, { scale = 0.25, opacity = 0.5, margin = 16, position = "br" } = {}) {
  const img = await loadImageFromFile(file);
  const can = document.createElement("canvas");
  can.width = img.width; can.height = img.height;
  const ctx = can.getContext("2d");
  ctx.drawImage(img, 0, 0);

  if (watermarkImg) {
    const wmScale = scale * Math.min(can.width, can.height);
    const aspect = watermarkImg.width / watermarkImg.height;
    let w = wmScale, h = wmScale / aspect, x = margin, y = margin;
    if (position === "br") { x = can.width - w - margin; y = can.height - h - margin; }
    if (position === "tr") { x = can.width - w - margin; y = margin; }
    if (position === "bl") { x = margin; y = can.height - h - margin; }
    ctx.globalAlpha = opacity;
    ctx.drawImage(watermarkImg, x, y, w, h);
    ctx.globalAlpha = 1;
  }
  const blob = await new Promise((res) => can.toBlob(res, "image/jpeg", 0.9));
  return new File([blob], file.name.replace(/\.(\w+)$/, "_wm.$1"), { type: "image/jpeg" });
}
function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
function loadImageFromDataUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export default function UploadManager({
  eventId,
  pointId,
  onUploaded,
  getSignedUrl,
  options = {},
}) {
  const [queue, setQueue] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [running, setRunning] = useState(0);
  const [wmPreview, setWmPreview] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!options?.watermark?.src) { setWmPreview(null); return; }
    setWmPreview(options.watermark.src);
  }, [options?.watermark?.src]);

  const totalProgress = useMemo(() => {
    const items = queue;
    if (!items.length) return 0;
    const p = items.reduce((acc, it) => acc + (it.progress || 0), 0) / items.length;
    return Math.floor(p);
  }, [queue]);

  function pickFiles() {
    inputRef.current?.click();
  }

  function addFiles(files) {
    const toAdd = Array.from(files || []).map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      name: f.name,
      size: f.size,
      status: "queued",
      progress: 0,
    }));
    setQueue((q) => [...q, ...toAdd]);
  }

  function onDragOver(e) { e.preventDefault(); setDragOver(true); }
  function onDragLeave() { setDragOver(false); }
  function onDrop(e) {
    e.preventDefault(); setDragOver(false);
    if (!pointId) {
      alert("❌ Elegí el punto para estas fotos primero.");
      return;
    }
    addFiles(e.dataTransfer.files);
  }

  function onInputChange(e) {
    if (!pointId) {
      alert("❌ Elegí el punto para estas fotos primero.");
      return;
    }
    addFiles(e.target.files);
    e.target.value = "";
  }

  function updateItem(id, patch) {
    setQueue((q) => q.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function removeItem(id) {
    setQueue((q) => q.filter((it) => it.id !== id));
  }
  function clearDone() {
    setQueue((q) => q.filter((it) => it.status !== "done"));
  }

  // ============ SUBIDA CORREGIDA ============
  useEffect(() => {
    if (!queue.length || running >= CONCURRENCY) return;
    
    const nextItem = queue.find((it) => it.status === "queued");
    if (!nextItem) return;

    let cancelled = false;
    const controller = new AbortController();

    // Marcar como processing INMEDIATAMENTE
    updateItem(nextItem.id, { status: "uploading", progress: 0 });
    setRunning((n) => n + 1);

    async function run() {
      try {
        // 1) Marca de agua
        let fileToSend = nextItem.file;
        if (wmPreview && options?.watermark) {
          try {
            const wmImg = await loadImageFromDataUrl(wmPreview);
            fileToSend = await applyWatermarkToFile(nextItem.file, wmImg, {
              scale: options.watermark.scale ?? 0.25,
              opacity: options.watermark.opacity ?? 0.5,
              position: options.watermark.position ?? "br",
            });
          } catch (e) {
            console.warn("No se aplicó marca de agua:", e);
          }
        }

        // 2) Pedir signed URL
        updateItem(nextItem.id, { progress: 10 });
        const data = await getSignedUrl({
          eventId,
          pointId,
          filename: fileToSend.name,
          size: fileToSend.size,
          contentType: fileToSend.type || "application/octet-stream",
        });

        // REEMPLAZA todo el bloque de upload con ESTO:

        // 3) Subir DIRECTAMENTE con Supabase SDK
        updateItem(nextItem.id, { progress: 30 });
        const { path: finalPath } = data;

        console.log("🔼 Subiendo con Supabase SDK:", finalPath);

        const { data: uploaded, error: uploadError } = await supabase.storage
          .from('fotos')
          .upload(finalPath, fileToSend, {
            contentType: fileToSend.type,
            upsert: false,
            cacheControl: '3600'
          });

        if (uploadError) {
          console.error("❌ Error subiendo con SDK:", uploadError);
          throw new Error("Upload failed: " + uploadError.message);
        }

        console.log("✅ Upload exitoso con SDK:", uploaded);

        // 4) Marcar completado
        updateItem(nextItem.id, { status: "done", progress: 100, path: finalPath });

          // 5) Notificar para registrar en DB
          onUploaded?.([{
            path: finalPath,
            size: fileToSend.size,
            pointId,
            takenAt: new Date().toISOString(),
          }]);

      } catch (e) {
        if (cancelled) {
          updateItem(nextItem.id, { status: "cancelled" });
        } else {
          console.error("❌ Error en upload:", e);
          updateItem(nextItem.id, { status: "error" });
        }
      } finally {
        setRunning((n) => n - 1);
      }
    }

    run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [queue, running, eventId, pointId, getSignedUrl, wmPreview, options?.watermark, onUploaded]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="h-10 px-4 rounded-xl bg-blue-600 text-white font-display font-bold"
          onClick={pickFiles}
        >
          Elegir archivos
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={onInputChange}
        />
        <div className="text-sm text-white/80">
          Progreso total: {totalProgress}%
        </div>
        <div className="ml-auto">
          <button
            type="button"
            onClick={clearDone}
            className="h-9 px-3 rounded-lg border border-white/15 bg-white/5 text-white text-sm"
          >
            Limpiar completados
          </button>
        </div>
      </div>

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={
          "rounded-2xl border-2 border-dashed p-8 text-center transition-all " +
          (dragOver ? "border-blue-500/70 bg-blue-500/10" : "border-white/15 bg-white/5")
        }
      >
        <div className="text-white/90 font-medium">
          Arrastrá tus fotos aquí o <span className="underline decoration-blue-400 cursor-pointer" onClick={pickFiles}>elegí archivos</span>
        </div>
        <div className="text-xs text-white/60 mt-1">
          Se suben directo al storage con URL firmada.
        </div>
      </div>

      <div className="space-y-2">
        {queue.map((it) => (
          <div key={it.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="truncate font-semibold">{it.name}</div>
                  <div className="text-xs text-white/60">({(it.size/1024/1024).toFixed(2)} MB)</div>
                </div>
                <div className="h-2 rounded bg-white/10 mt-2 overflow-hidden">
                  <div
                    className={"h-2 transition-all " + (it.status === "error" ? "bg-red-500" : "bg-blue-500")}
                    style={{ width: `${it.progress || 0}%` }}
                  />
                </div>
              </div>
              <div className="text-sm w-24 text-right">
                {it.status === "queued" && "En cola"}
                {it.status === "uploading" && `${it.progress}%`}
                {it.status === "done" && "Listo"}
                {it.status === "error" && "Error"}
                {it.status === "cancelled" && "Cancelado"}
              </div>
              <button
                className="h-8 px-3 rounded-lg bg-white/10 text-white border border-white/15 text-sm"
                onClick={() => removeItem(it.id)}
                type="button"
              >
                Quitar
              </button>
            </div>
          </div>
        ))}
        {queue.length === 0 && (
          <div className="text-sm text-white/60">No hay archivos en cola.</div>
        )}
      </div>
    </div>
  );
}