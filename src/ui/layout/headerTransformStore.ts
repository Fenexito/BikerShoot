import { create } from 'zustand'
import type { ReactNode } from 'react'

interface HeaderTransformState {
  content: ReactNode | null
  /** Si el header debe MOSTRAR `content` ahora mismo — lo decide la propia
   * página (no un umbral genérico), porque cada página sabe cuándo tiene
   * sentido transformarse (ej. cuando termina de reducirse su portada). */
  active: boolean
  /** HeaderUser siempre agrega, junto a `content`, un botón fijo de "Buscar…"
   * (búsqueda global) en el mismo lugar donde vivían buscar/favoritos/
   * carrito/notificaciones/perfil. Una página cuyo propio `content` YA
   * incluye una caja de búsqueda (ej. Search.tsx) pasa `true` aquí para que
   * ese botón extra no se duplique al lado del suyo. */
  hideSearchTrigger: boolean
  /** Por defecto la transformación del header SOLO aplica en escritorio — en
   * móvil la navegación real vive en la barra inferior y el header además se
   * auto-oculta al hacer scroll (ver `useAutoHideHeader`). Una página como
   * Buscar fotos, donde el biker entra sobre todo desde el teléfono y
   * NECESITA los filtros a mano en todo momento, pasa `true` aquí para que
   * en móvil también: (a) el header deje de auto-ocultarse, y (b) también
   * muestre el contenido transformado (con scroll horizontal si no cabe). */
  mobileEnabled: boolean
  setTransform: (content: ReactNode | null, active: boolean, hideSearchTrigger?: boolean, mobileEnabled?: boolean) => void
}

/** Contenido (y condición de activación) que reemplaza el header por defecto
 * cuando la página actual lo registra — ver `useHeaderTransform`. Vive en un
 * store global (no en contexto de React) porque el header y la página que
 * registra su contenido son hermanos en el árbol (ambos cuelgan de
 * `PortalLayout`, uno renderiza el `<header>` y el otro el `<Outlet/>`), sin
 * relación padre-hijo directa. */
export const useHeaderTransformStore = create<HeaderTransformState>((set) => ({
  content: null,
  active: false,
  hideSearchTrigger: false,
  mobileEnabled: false,
  setTransform: (content, active, hideSearchTrigger = false, mobileEnabled = false) => set({ content, active, hideSearchTrigger, mobileEnabled }),
}))
