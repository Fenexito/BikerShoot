import { useState, type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/cn'
import { IconEye, IconEyeOff } from '../shared/icons'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, type, ...props }, ref) => {
    const inputId = id ?? props.name
    const isPassword = type === 'password'
    const [revealed, setRevealed] = useState(false)
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={isPassword ? (revealed ? 'text' : 'password') : type}
            className={cn(
              'h-12 w-full rounded-full border border-border bg-input px-5 text-base text-foreground md:h-14',
              'placeholder:text-muted-foreground',
              'outline-none transition-colors duration-150 focus:border-accent',
              'disabled:cursor-not-allowed disabled:opacity-50',
              isPassword && 'pr-12',
              error && 'border-accent',
              className,
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              tabIndex={-1}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {revealed ? <IconEyeOff className="h-[18px] w-[18px]" /> : <IconEye className="h-[18px] w-[18px]" />}
            </button>
          )}
        </div>
        {error && <span className="text-xs text-accent">{error}</span>}
      </div>
    )
  },
)
Input.displayName = 'StudioInput'
