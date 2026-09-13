import { useEffect, useState } from 'react'
import { AnimateIcon } from '../animate-icons/icon'
import { ArrowUp } from '../animate-icons/icons/ArrowUp'
import { cn } from '../../lib/cn'

/** Flecha flotante hacia arriba, aparece tras bajar lo suficiente — mismo
 * patrón que Mobbin usa en sus páginas de scroll largo. */
export function ScrollToTopButton({ threshold = 600 }: { threshold?: number }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > threshold)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return (
    <AnimateIcon animateOnHover animateOnTap asChild>
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Volver al inicio"
        className={cn(
          // El offset móvil suma `env(safe-area-inset-bottom)` — sin eso, en
          // dispositivos con una franja segura grande (ej. iPhone con línea
          // de inicio) el menú inferior real (que sí la suma en su propio
          // padding) termina siendo más alto que lo que este botón asumía, y
          // se solapan.
          // Negro fijo (no `bg-foreground`) a propósito — este botón, el de
          // reportar bug y el de "Buscar" del Home comparten el mismo negro de
          // marca sin importar el tema claro/oscuro activo, en vez de invertir
          // a blanco en modo oscuro como haría `bg-foreground`.
          'fixed right-4 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg transition-all duration-300 hover:bg-neutral-800 md:bottom-6 md:right-6 md:h-11 md:w-11',
          'bottom-[calc(5rem+env(safe-area-inset-bottom))]',
          visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
        )}
      >
        <ArrowUp size={16} className="md:h-5 md:w-5" />
      </button>
    </AnimateIcon>
  )
}
