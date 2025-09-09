// src/components/ui/Modal.jsx
import React from "react";
import { useModal } from "../../state/ui.jsx";

// Si tenés un util cn, dejalo; si no, podés reemplazar cn por plantillas o classnames
function cn(...cls) {
  return cls.filter(Boolean).join(" ");
}

export default function ModalHost({ dark = false, className }) {
  const { modal, closeModal, setModal } = useModal();

  if (!modal) return null;
  const variant = modal.variant || "info";

  const colors = {
    info: dark ? "bg-studio-panel text-slate-100" : "bg-white text-slate-800",
    confirm: dark ? "bg-studio-panel text-slate-100" : "bg-white text-slate-800",
    danger: dark ? "bg-studio-panel text-red-100" : "bg-white text-red-700",
    success: dark ? "bg-studio-panel text-emerald-100" : "bg-white text-emerald-700",
    custom: "",
  };

  const btnBase =
    "inline-flex items-center justify-center px-4 py-2 rounded-lg font-semibold";
  const btnPrimary = dark
    ? "bg-blue-600 text-white hover:bg-blue-500"
    : "bg-blue-600 text-white hover:bg-blue-700";
  const btnGhost = dark
    ? "bg-transparent text-slate-300 hover:bg-white/10"
    : "bg-transparent text-slate-600 hover:bg-slate-100";
  const btnDanger = dark
    ? "bg-red-600 text-white hover:bg-red-500"
    : "bg-red-600 text-white hover:bg-red-700";

  const onCancel = () => {
    modal.onResolve?.(false);
    modal.onCancel?.();
  };
  const onConfirm = () => {
    if (modal.async) {
      setModal({ ...modal, busy: true });
      Promise.resolve(modal.onConfirm?.()).then(
        () => {
          setModal(null);
          modal.onResolve?.(true);
        },
        (err) => {
          setModal({
            ...modal,
            busy: false,
            error: err?.message || "Ocurrió un error",
          });
        }
      );
    } else {
      modal.onConfirm?.();
      modal.onResolve?.(true);
      setModal(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={
          modal.dismissOnBackdrop === false ? undefined : closeModal
        }
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={cn(
            "w-full max-w-md rounded-2xl shadow-2xl border",
            colors[variant],
            className,
            dark ? "border-white/10" : "border-slate-200"
          )}
        >
          {(modal.title || modal.icon) && (
            <div
              className={cn(
                "px-5 pt-5 flex items-center gap-3",
                modal.description ? "" : "pb-5"
              )}
            >
              {modal.icon && <div className="shrink-0">{modal.icon}</div>}
              {modal.title && (
                <h3 className="text-lg font-bold leading-tight">
                  {modal.title}
                </h3>
              )}
            </div>
          )}

          {modal.description && (
            <div className="px-5 pb-4 text-sm opacity-90">
              {typeof modal.description === "string" ? (
                <p>{modal.description}</p>
              ) : (
                modal.description
              )}
            </div>
          )}
          {modal.error && (
            <div className="px-5 pb-2 text-sm text-red-600">
              {modal.error}
            </div>
          )}

          {modal.content && <div className="px-5 pb-4">{modal.content}</div>}

          <div
            className={cn(
              "px-5 py-4 flex items-center justify-end gap-2",
              dark ? "bg-white/5" : "bg-slate-50"
            )}
          >
            {modal.cancelText !== null && (
              <button
                className={cn(btnBase, btnGhost)}
                onClick={onCancel}
                disabled={modal.busy}
              >
                {modal.cancelText ?? "Cancelar"}
              </button>
            )}
            <button
              className={cn(
                btnBase,
                modal.variant === "danger" ? btnDanger : btnPrimary,
                modal.busy && "opacity-70 pointer-events-none"
              )}
              onClick={onConfirm}
            >
              {modal.busy ? "Procesando..." : modal.confirmText ?? "Confirmar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
