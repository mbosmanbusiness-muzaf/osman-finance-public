import { translate as localize, useLanguageStore } from '@/i18n'
import { cn, fin, safeDiv } from '@/lib/utils'
import { fmtPct } from '@/lib/format'

interface PlanFactBarProps {
  fact: number
  plan: number
  /** xarajat moddasi: fakt ≤ plan yaxshi */
  isCost?: boolean
  format: (v: number) => string
  label?: string
  className?: string
  compact?: boolean
}

/** Bajarilish %ni hisoblaydi: daromad → fakt/plan, xarajat → plan/fakt. */
export function performancePct(fact: number, plan: number, isCost = false): number {
  const f = fin(fact), p = fin(plan)
  if (p === 0 && f === 0) return 100
  return (isCost ? safeDiv(p, f, f === 0 ? 1 : 0) : safeDiv(f, p, 0)) * 100
}

export function perfTone(p: number): 'good' | 'warn' | 'bad' {
  return p >= 100 ? 'good' : p >= 90 ? 'warn' : 'bad'
}

/** Plan | Fakt | % — kichik progress bar. */
export function PlanFactBar({ fact, plan, isCost = false, format, label = 'Plan', className, compact = false }: PlanFactBarProps) {
  useLanguageStore((state) => state.language)
  const pct = performancePct(fact, plan, isCost)
  const tone = perfTone(pct)
  const width = Math.max(2, Math.min(100, isCost ? safeDiv(fin(fact), fin(plan), 1) * 100 : pct))
  const color = tone === 'good' ? 'bg-positive' : tone === 'warn' ? 'bg-warning' : 'bg-negative'
  const textColor = tone === 'good' ? 'text-positive' : tone === 'warn' ? 'text-warning' : 'text-negative'
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between text-[11px] text-txt-muted num">
        <span>{localize(label)} {format(fin(plan))}</span>
        {!compact && <span>{localize('Fakt')} {format(fin(fact))}</span>}
        <span className={cn('font-semibold', textColor)}>{fmtPct(pct, 0)}</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-elevated overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}
