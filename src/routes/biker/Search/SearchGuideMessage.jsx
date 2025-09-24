// src/routes/biker/Search/SearchGuideMessage.jsx
import React from "react";

/**
 * Mensaje guía centrado cuando el buscador está sin resultados.
 * Truco: aplicamos un margen inferior negativo para compensar el pb-28 del layout
 * SIN tocar Search.jsx. Así ya no queda el espacio muerto abajo cuando no hay fotos.
 */
export default function SearchGuideMessage({ message }) {
  if (!message) return null;

  return (
    <div className="w-full flex items-center justify-center mb-[-7rem]">
      <div className="text-center text-slate-600 text-sm sm:text-base px-4 py-6">
        {message}
      </div>
    </div>
  );
}
