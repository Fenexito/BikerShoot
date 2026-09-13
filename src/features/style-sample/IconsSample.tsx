import { Bot } from '../../ui/animate-icons/icons/Bot'

/** Página pública de muestra (mismo patrón que StudioSample/FlatSample) —
 * para ver en vivo, sin login, cómo se ven/animan los íconos portados de
 * Animate UI antes de usarlos en páginas reales. Se va agregando un ítem
 * por cada ícono que se porte. */
export function IconsSample() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 font-sans text-white" style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <h1 className="text-2xl font-bold">Animate UI Icons — muestra</h1>
      <p className="mt-2 text-white/60">Pasa el mouse (o toca) cada ícono para ver su animación.</p>

      <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 p-6">
          <Bot size={40} animateOnHover />
          <span className="text-sm text-white/70">Bot — hover</span>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 p-6">
          <Bot size={40} animateOnTap />
          <span className="text-sm text-white/70">Bot — tap/click</span>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 p-6">
          <Bot size={40} animate loop />
          <span className="text-sm text-white/70">Bot — loop automático</span>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 p-6">
          <Bot size={40} animateOnHover animation="blink" />
          <span className="text-sm text-white/70">Bot — variante "blink"</span>
        </div>
      </div>
    </div>
  )
}
