import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/cn'

/** Segmented control para saltar entre el login de biker y el de Studio —
 * mismo lenguaje visual que un selector de tema (dos opciones, una
 * resaltada), no un simple link de texto. */
export function PortalSwitch({ current }: { current: 'biker' | 'studio' }) {
  const navigate = useNavigate()

  return (
    <div className="flex gap-1 rounded-full bg-muted p-1 text-sm font-medium">
      <button
        onClick={() => navigate('/login')}
        className={cn('rounded-full px-4 py-2 transition-colors', current === 'biker' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
      >
        Biker
      </button>
      <button
        onClick={() => navigate('/studio/login')}
        className={cn('rounded-full px-4 py-2 transition-colors', current === 'studio' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
      >
        Fotógrafo
      </button>
    </div>
  )
}
