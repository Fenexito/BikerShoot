import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'dark'
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
  sm: 'text-sm h-10 px-4 gap-1.5',
  default: 'text-sm h-12 px-6 gap-2',
  lg: 'text-base h-14 px-8 gap-2.5',
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

const variantClasses: Record<Variant, string> = {
  primary: 'bg-accent text-accent-foreground hover:opacity-90',
  secondary: 'border border-border text-foreground bg-transparent hover:bg-muted',
  ghost: 'text-muted-foreground hover:text-foreground hover:bg-muted',
  dark: 'bg-foreground text-background hover:opacity-90',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'default', loading, disabled, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-full font-semibold transition-all duration-150',
          'active:scale-[0.98]',
          'disabled:pointer-events-none disabled:opacity-50',
          focusRing,
          variantClasses[variant],
          sizeText[size],
          className,
        )}
        {...props}
      >
        {loading && <Spinner />}
        {children}
      </button>
    )
  },
)
Button.displayName = 'StudioButton'
