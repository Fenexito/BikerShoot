import { type SelectHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ label, className, id, children, ...props }, ref) => {
  const selectId = id ?? props.name
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={selectId} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={cn(
          'h-12 rounded-full border border-border bg-input px-5 text-sm text-foreground md:h-14',
          'outline-none transition-colors duration-150 focus:border-accent',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  )
})
Select.displayName = 'StudioSelect'
