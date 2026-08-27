import { type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? props.name
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium uppercase tracking-wider2 text-muted-foreground"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-12 border border-border bg-input px-4 text-base text-foreground md:h-14',
            'placeholder:text-muted-foreground',
            'outline-none transition-colors duration-150 focus:border-accent',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-accent',
            className,
          )}
          {...props}
        />
        {error && <span className="text-xs text-accent">{error}</span>}
      </div>
    )
  },
)
Input.displayName = 'StudioInput'
