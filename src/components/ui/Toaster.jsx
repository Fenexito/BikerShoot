// src/components/ui/Toaster.jsx
import React from "react";

export default function Toaster({ dark = false }) {
  const { toasts, dismiss } = require("../../state/ui.jsx").useToast();

  const palette = (type) => {
    switch (type) {
      case "success":
        return dark ? ["bg-emerald-500/15 border-emerald-400/30 text-emerald-200"] : ["bg-emerald-50 border-emerald-200 text-emerald-800"];
      case "error":
        return dark ? ["bg-red-500/15 border-red-400/30 text-red-200"] : ["bg-red-50 border-red-200 text-red-800"];
      case "warning":
        return dark ? ["bg-amber-500/15 border-amber-400/30 text-amber-200"] : ["bg-amber-50 border-amber-200 text-amber-800"];
      default:
        return dark ? ["bg-white/10 border-white/20 text-slate-100"] : ["bg-white border-slate-200 text-slate-800"];
    }
  };

  return (
    <div className="fixed z-[90] inset-0 pointer-events-none">
      {/* Arriba a la derecha */}
      <div className="absolute right-4 top-4 w-full max-w-sm space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto border shadow-lg rounded-xl p-3 ${palette(t.type)}`}
            role="status"
          >
            <div className="flex items-start gap-3">
              {t.icon && <div className="mt-0.5">{t.icon}</div>}
              <div className="flex-1">
                {t.title && <div className="font-semibold">{t.title}</div>}
                {t.description && <div className="text-sm opacity-90">{t.description}</div>}
              </div>
              <button onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100">✕</button>
            </div>
          </div>
        ))}
      </div>

      {/* Abajo centrado (opcional para toasts con position: "bottom") */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-4 w-full max-w-md space-y-2">
        {toasts.filter(t => t.position === "bottom").map((t) => (
          <div key={t.id} className={`pointer-events-auto border shadow-lg rounded-xl p-3 ${palette(t.type)}`}>
            <div className="flex items-start gap-3">
              {t.icon && <div className="mt-0.5">{t.icon}</div>}
              <div className="flex-1">
                {t.title && <div className="font-semibold">{t.title}</div>}
                {t.description && <div className="text-sm opacity-90">{t.description}</div>}
              </div>
              <button onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100">✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
