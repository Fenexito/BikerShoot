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
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900',
            'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
            error && 'border-danger-500 focus:ring-danger-500',
            className,
          )}
          {...props}
        />
        {error && <span className="text-xs text-danger-600">{error}</span>}
      </div>
    )
  },
)
Input.displayName = 'Input'
