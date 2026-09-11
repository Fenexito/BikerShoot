// Adaptado de reactbits.dev (Counter, variante JS-CSS) — mismo mecanismo de
// "rodillo" de dígitos (cada dígito es una tira vertical 0-9 que se desliza
// con `transform`, animada por CSS `transition`), tipado a TS. El original
// solo recibe `value` ya calculado; el conteo ascendente desde 0 (el efecto
// de "contador subiendo" al entrar en pantalla) lo maneja quien lo usa, con
// un hook aparte (ver `useCountUp` en Home.tsx) — mantiene este componente
// puramente de presentación, igual que el original.
import './Counter.css'

interface CounterProps {
  value: number
  places?: number[]
  fontSize?: number
  padding?: number
  gap?: number
  textColor?: string
  fontWeight?: React.CSSProperties['fontWeight']
  /** Si es false (por defecto), un dígito que no aplica todavía (ej. las
   * centenas de un valor de una sola cifra) no muestra ceros a la
   * izquierda — se oculta por completo en vez de mostrar "0". */
  digitPlaceHolders?: boolean
  className?: string
}

const DIGITS = Array.from({ length: 10 }, (_, n) => n)

const Counter = ({
  value,
  places = [100, 10, 1],
  fontSize = 40,
  padding = 0,
  gap = 6,
  textColor = 'currentColor',
  fontWeight = 700,
  digitPlaceHolders = false,
  className = '',
}: CounterProps) => {
  const height = fontSize + padding
  const safeValue = Math.max(0, Math.round(value))

  return (
    <div
      className={`counter-js-css${className ? ` ${className}` : ''}`}
      style={
        {
          gap,
          fontSize,
          fontWeight,
          color: textColor,
          lineHeight: `${height}px`,
        } as React.CSSProperties
      }
    >
      {places.map((place, i) => {
        const digit = Math.floor(safeValue / place) % 10
        // Un dígito "cuenta" si el valor ya lo alcanza, o si es el último
        // (unidades) — así un valor de 7 no muestra "007", pero un valor de
        // 0 sí muestra al menos un dígito.
        const show = digitPlaceHolders || safeValue >= place || i === places.length - 1
        return (
          <div key={place} className="counter-js-css__digit" style={{ height, width: `${fontSize * 0.62}px` }}>
            <div className="counter-js-css__strip" style={{ transform: `translateY(-${(show ? digit : 0) * height}px)` }}>
              {DIGITS.map((n) => (
                <div key={n} className="counter-js-css__num" style={{ height }}>
                  {show ? n : ''}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default Counter
