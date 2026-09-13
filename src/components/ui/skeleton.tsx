import { useLanguageStore } from "@/i18n"
import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  useLanguageStore((state) => state.language)
  return <div className={cn('animate-pulse rounded-xl bg-elevated', className)} {...props} />
}

export { Skeleton }
