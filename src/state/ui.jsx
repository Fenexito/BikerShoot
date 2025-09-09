// src/state/ui.jsx
import React, { createContext, useContext, useState, useCallback } from "react";

const ModalContext = createContext(null);
const ToastContext = createContext(null);

export function UIProvider({ children }) {
  const [modal, setModal] = useState(null);
  const [toasts, setToasts] = useState([]);

  // Modal: abre y devuelve una promesa que resuelve true/false
  const openModal = useCallback((options) => {
    return new Promise((resolve) => {
      setModal({
        ...options,
        onResolve: (val) => {
          setModal(null);
          resolve(val);
        },
      });
    });
  }, []);

  const closeModal = useCallback(() => setModal(null), []);

  // Toast: agrega uno con auto-cierre
  const toast = useCallback((opts) => {
    const id = Math.random().toString(36).slice(2);
    const t = { id, duration: 3000, ...opts };
    setToasts((prev) => [t, ...prev]);
    if (t.duration !== Infinity) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, t.duration);
    }
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return (
    <ModalContext.Provider value={{ modal, openModal, closeModal, setModal }}>
      <ToastContext.Provider value={{ toasts, toast, dismiss }}>
        {children}
      </ToastContext.Provider>
    </ModalContext.Provider>
  );
}

export const useModal = () => useContext(ModalContext);
export const useToast = () => useContext(ToastContext);
