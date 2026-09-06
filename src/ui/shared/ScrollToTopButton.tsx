import { useEffect, useState } from 'react'
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
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Volver al inicio"
      className={cn(
        'fixed bottom-24 right-4 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-all duration-300 md:bottom-6 md:right-6 md:h-11 md:w-11',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 md:h-5 md:w-5">
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  )
}
