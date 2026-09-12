import { create } from 'zustand'
import type { ReactNode } from 'react'

export interface HeaderTransformOptions {
  /** HeaderUser siempre agrega, junto a `content`, un botón fijo de "Buscar…"
   * (búsqueda global) en el mismo lugar donde vivían buscar/favoritos/
   * carrito/notificaciones/perfil. Una página cuyo propio `content` YA
   * incluye una caja de búsqueda pasa `true` aquí para que ese botón extra
   * no se duplique al lado del suyo. */
  hideSearchTrigger?: boolean
  /** Igual que `hideSearchTrigger`, pero para el ícono de carrito fijo que
   * HeaderUser conserva en la capa transformada — el detalle de un pedido no
   * quiere ningún atajo de compra a la vista, ya que ahí el biker no está
   * navegando fotos para comprar. */
  hideCartTrigger?: boolean
  /** Por defecto la transformación del header SOLO aplica en escritorio — en
   * móvil la navegación real vive en la barra inferior y el header además se
   * auto-oculta al hacer scroll (ver `useAutoHideHeader`). Una página como
   * Buscar fotos, donde el biker entra sobre todo desde el teléfono y
   * NECESITA los filtros a mano en todo momento, pasa `true` aquí para que
   * en móvil también: (a) el header deje de auto-ocultarse, y (b) también
   * muestre el contenido transformado (con scroll horizontal si no cabe). */
  mobileEnabled?: boolean
  /** En móvil, con `mobileEnabled`, esta página puede poner SU PROPIO control
   * exactamente donde vive la flecha de "volver" (mismo lugar, mismo
   * espaciado) — reemplazándola en vez de solo dejar el hueco vacío. Pensado
   * para el botón de "más filtros" de Buscar fotos: antes vivía metido en la
   * fila de filtros; ahora ocupa el mismo lugar/tamaño que la flecha atrás
   * en el resto de páginas. En escritorio (o si esto no aplica) se sigue
   * viendo la flecha de volver normal. */
  mobileBackSlotContent?: ReactNode | null
  /** Con `mobileEnabled`, por defecto el header/menú inferior TODAVÍA se
   * auto-ocultan al bajar en el scroll (pensado para Buscar fotos: más
   * espacio para ver fotos). Una página como el detalle de un pedido, que
   * es puro texto/información para leer mientras se hace scroll (no fotos
   * para "navegar"), no quiere que NADA se oculte — pasa `true` acá para
   * que ni el header ni el menú inferior se auto-oculten mientras esta
   * página esté activa. */
  suppressAutoHide?: boolean
  /** Segunda fila OPCIONAL que, cuando `extraActive` es true, hace que el
   * propio `<header>` (el pill) CREZCA de alto para mostrarla — no es un
   * panel flotante aparte, es el mismo header extendiéndose. Pensado para
   * "más filtros" en Buscar fotos EN MÓVIL — en escritorio esta página
   * pone los 6 filtros en una sola fila dentro de `content` y no usa esto. */
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
  hideCartTrigger: false,
  mobileEnabled: false,
  mobileBackSlotContent: null,
  suppressAutoHide: false,
  extraContent: null,
  extraActive: false,
  setTransform: (content, active, options = {}) =>
    set({
      content,
      active,
      hideSearchTrigger: options.hideSearchTrigger ?? false,
      hideCartTrigger: options.hideCartTrigger ?? false,
      mobileEnabled: options.mobileEnabled ?? false,
      mobileBackSlotContent: options.mobileBackSlotContent ?? null,
      suppressAutoHide: options.suppressAutoHide ?? false,
      extraContent: options.extraContent ?? null,
      extraActive: options.extraActive ?? false,
    }),
}))
