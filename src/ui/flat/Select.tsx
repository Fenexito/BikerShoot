import { type SelectHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ label, className, id, children, ...props }, ref) => {
  const selectId = id ?? props.name
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={cn(
          'h-12 rounded-md border-2 border-transparent bg-muted px-3 text-sm text-foreground',
          'outline-none transition-colors duration-200 focus:border-primary focus:bg-background',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  )
})
Select.displayName = 'FlatSelect'
