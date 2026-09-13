import { useLanguageStore } from "@/i18n"
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium num transition-colors', {
  variants: {
    variant: {
      default: 'border-transparent bg-gold/15 text-gold-bright',
      secondary: 'border-transparent bg-elevated text-txt-secondary',
      outline: 'border-border text-txt-secondary',
      positive: 'border-transparent bg-positive/15 text-positive',
      negative: 'border-transparent bg-negative/15 text-negative',
      warning: 'border-transparent bg-warning/15 text-warning',
      info: 'border-transparent bg-info/15 text-info',
    },
  },
  defaultVariants: { variant: 'default' },
})

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  useLanguageStore((state) => state.language)
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
