import { cn } from '../../lib/cn'

const THUMB_CLASSES =
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none ' +
  '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-primary ' +
  '[&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer ' +
  '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:appearance-none ' +
  '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer ' +
  '[&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent'

function fmt(mins: number) {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, '0')
  const m = Math.round(mins % 60)
    .toString()
    .padStart(2, '0')
  return `${h}:${m}`
}

interface TimeRangeSliderProps {
  /** Límites disponibles EN MINUTOS (0-1439) — se recalculan según los
   * demás filtros elegidos (categoría/ruta/punto/fotógrafo): si esos
   * filtros ya acotan a un grupo de puntos con horarios de 6:00 a 9:00, el
   * usuario solo puede deslizar dentro de ese rango, no el día completo. */
  boundsMin: number
  boundsMax: number
  valueMin: number
  valueMax: number
  onChange: (min: number, max: number) => void
  /** `compact` — pensado para vivir siempre visible dentro de la barra de
   * filtros (en vez de dentro de un panel desplegable con espacio de
   * sobra): más angosto y sin el padding vertical extra. */
  size?: 'default' | 'compact'
}

/** Dos `<input type="range">` superpuestos (truco clásico para un slider de
 * rango sin librería): cada uno queda `pointer-events-none` salvo su propio
 * "thumb" (manija), que recupera `pointer-events-auto` vía selector de
 * pseudo-elemento — así cada manija se puede arrastrar de forma
 * independiente aunque ambos inputs ocupen el mismo espacio. */
export function TimeRangeSlider({ boundsMin, boundsMax, valueMin, valueMax, onChange, size = 'default' }: TimeRangeSliderProps) {
  const span = Math.max(1, boundsMax - boundsMin)
  const pctMin = ((valueMin - boundsMin) / span) * 100
  const pctMax = ((valueMax - boundsMin) / span) * 100

  return (
    <div className={size === 'compact' ? 'w-40 px-1' : 'w-64 px-1 py-2'}>
      <div className={cn('flex items-center justify-between font-semibold text-foreground', size === 'compact' ? 'mb-1 text-[10px]' : 'mb-3 text-xs')}>
        <span>{fmt(valueMin)}</span>
        {size !== 'compact' && <span className="text-muted-foreground">hasta</span>}
        <span>{fmt(valueMax)}</span>
      </div>
      <div className="relative h-4">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
          style={{ left: `${pctMin}%`, right: `${100 - pctMax}%` }}
        />
        <input
          type="range"
          min={boundsMin}
          max={boundsMax}
          value={valueMin}
          onChange={(e) => onChange(Math.min(Number(e.target.value), valueMax), valueMax)}
          className={`pointer-events-none absolute inset-x-0 top-0 h-4 w-full appearance-none bg-transparent ${THUMB_CLASSES}`}
        />
        <input
          type="range"
          min={boundsMin}
          max={boundsMax}
          value={valueMax}
          onChange={(e) => onChange(valueMin, Math.max(Number(e.target.value), valueMin))}
          className={`pointer-events-none absolute inset-x-0 top-0 h-4 w-full appearance-none bg-transparent ${THUMB_CLASSES}`}
        />
      </div>
    </div>
  )
}
