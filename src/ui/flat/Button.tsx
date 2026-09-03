import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'outline'
type Size = 'sm' | 'default' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-10 px-4 text-sm gap-1.5',
  default: 'h-12 px-6 text-base gap-2',
  lg: 'h-14 px-8 text-base gap-2.5',
}

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary'

const variantClasses: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-blue-600',
  secondary: 'bg-muted text-foreground hover:bg-gray-200',
  outline: 'border border-border text-foreground bg-transparent hover:bg-muted',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'default', loading, disabled, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-all duration-150',
          'active:scale-[0.98]',
          'disabled:pointer-events-none disabled:opacity-50',
          focusRing,
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
        {children}
      </button>
    )
  },
)
Button.displayName = 'FlatButton'
