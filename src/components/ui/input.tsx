import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn('flex h-9 w-full rounded-lg border border-border bg-surface px-3 py-1 text-sm text-txt-primary transition-[border-color,box-shadow] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-txt-muted focus-visible:outline-none focus-visible:border-gold/70 focus-visible:ring-[3px] focus-visible:ring-gold/20 disabled:cursor-not-allowed disabled:opacity-50 num', className)}
    ref={ref}
    {...props}
  />
))
Input.displayName = 'Input'

export { Input }
