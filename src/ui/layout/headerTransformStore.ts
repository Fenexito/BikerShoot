import { create } from 'zustand'
import type { ReactNode } from 'react'

export interface HeaderTransformOptions {
  /** HeaderUser siempre agrega, junto a `content`, un botón fijo de "Buscar…"
   * (búsqueda global) en el mismo lugar donde vivían buscar/favoritos/
   * carrito/notificaciones/perfil. Una página cuyo propio `content` YA
   * incluye una caja de búsqueda pasa `true` aquí para que ese botón extra
   * no se duplique al lado del suyo. */
  hideSearchTrigger?: boolean
  /** Por defecto la transformación del header SOLO aplica en escritorio — en
   * móvil la navegación real vive en la barra inferior y el header además se
   * auto-oculta al hacer scroll (ver `useAutoHideHeader`). Una página como
   * Buscar fotos, donde el biker entra sobre todo desde el teléfono y
   * NECESITA los filtros a mano en todo momento, pasa `true` aquí para que
   * en móvil también: (a) el header deje de auto-ocultarse, y (b) también
   * muestre el contenido transformado (con scroll horizontal si no cabe). */
  mobileEnabled?: boolean
  /** En móvil, con `mobileEnabled`, el hueco de la flecha de "volver" (que
   * normalmente esta página ni usa) se libera para que la propia página
   * pueda poner ahí su propio control (ej. el botón de "más filtros" de
   * Buscar fotos) en vez de un espacio reservado vacío. */
  hideBackSlotOnMobile?: boolean
  /** Segunda fila OPCIONAL que, cuando `extraActive` es true, hace que el
   * propio `<header>` (el pill) CREZCA de alto para mostrarla — no es un
   * panel flotante aparte, es el mismo header extendiéndose. Pensado para
   * "más filtros" en Buscar fotos: no caben los 6 filtros en una sola fila
   * en móvil, así que los primeros 3 viven en `content` y los otros 3 acá,
   * revelados/ocultados con una animación de alto (ver HeaderUser.tsx). */
  extraContent?: ReactNode | null
  extraActive?: boolean
}

interface HeaderTransformState extends HeaderTransformOptions {
  content: ReactNode | null
  /** Si el header debe MOSTRAR `content` ahora mismo — lo decide la propia
   * página (no un umbral genérico), porque cada página sabe cuándo tiene
   * sentido transformarse (ej. cuando termina de reducirse su portada). */
  active: boolean
  setTransform: (content: ReactNode | null, active: boolean, options?: HeaderTransformOptions) => void
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
  hideBackSlotOnMobile: false,
  extraContent: null,
  extraActive: false,
  setTransform: (content, active, options = {}) =>
    set({
      content,
      active,
      hideSearchTrigger: options.hideSearchTrigger ?? false,
      mobileEnabled: options.mobileEnabled ?? false,
      hideBackSlotOnMobile: options.hideBackSlotOnMobile ?? false,
      extraContent: options.extraContent ?? null,
      extraActive: options.extraActive ?? false,
    }),
}))
