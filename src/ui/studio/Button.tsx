import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'default' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const Spinner = () => (
  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
)

const sizeText: Record<Size, string> = {
  sm: 'text-xs py-2 gap-2',
  default: 'text-sm py-3 gap-2.5',
  lg: 'text-base py-4 gap-3',
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'default', loading, disabled, className, children, ...props }, ref) => {
    if (variant === 'primary') {
      return (
        <button
          ref={ref}
          disabled={disabled || loading}
          className={cn(
            'group relative inline-flex items-center justify-center px-0 font-semibold uppercase tracking-wider2',
            'text-accent whitespace-nowrap transition-all duration-150 active:translate-y-px',
            'disabled:pointer-events-none disabled:opacity-50',
            focusRing,
            sizeText[size],
            className,
          )}
          {...props}
        >
          {loading && <Spinner />}
          {children}
          <span className="absolute -bottom-0.5 left-0 h-0.5 w-full origin-left scale-x-100 bg-accent transition-transform duration-150 group-hover:scale-x-110" />
        </button>
      )
    }

    if (variant === 'secondary') {
      return (
        <button
          ref={ref}
          disabled={disabled || loading}
          className={cn(
            'inline-flex items-center justify-center gap-2 border border-foreground px-6 font-semibold uppercase tracking-wider2',
            'text-foreground whitespace-nowrap transition-all duration-150 active:translate-y-px',
            'hover:bg-foreground hover:text-background',
            'disabled:pointer-events-none disabled:opacity-50',
            focusRing,
            sizeText[size],
            className,
          )}
          {...props}
        >
          {loading && <Spinner />}
          {children}
        </button>
      )
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'group relative inline-flex items-center justify-center px-4 font-semibold uppercase tracking-wider2',
          'text-muted-foreground whitespace-nowrap transition-all duration-150 active:translate-y-px',
          'hover:text-foreground',
          'disabled:pointer-events-none disabled:opacity-50',
          focusRing,
          sizeText[size],
          className,
        )}
        {...props}
      >
        {loading && <Spinner />}
        {children}
        <span className="absolute -bottom-0.5 left-4 right-4 h-px origin-left scale-x-0 bg-foreground transition-transform duration-150 group-hover:scale-x-100" />
      </button>
    )
  },
)
Button.displayName = 'StudioButton'
