import { translate as localize, useLanguageStore } from "@/i18n"
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const MAP = {
  good: { v: 'positive' as const, t: 'Normada', dot: 'bg-positive' },
  warn: { v: 'warning' as const, t: 'Diqqat', dot: 'bg-warning' },
  bad: { v: 'negative' as const, t: 'Xavf', dot: 'bg-negative' },
}

export function StatusBadge({ status, label }: { status: 'good' | 'warn' | 'bad'; label?: string }) {
  useLanguageStore((state) => state.language)
  const m = MAP[status]
  return (
    <Badge variant={m.v}>
      <span className={cn('status-dot', m.dot)} />
      {localize(label ?? m.t)}
    </Badge>
  )
}
