import { translate as localize, useLanguageStore } from "@/i18n"
import type { ReactNode } from 'react'
import { cn, fin } from '@/lib/utils'
import { fmtValue, type ValueFormat } from '@/lib/format'
import { useCurrency } from '@/hooks'
import { Sparkline } from './Sparkline'
import { DeltaChip } from './DeltaChip'
import { PlanFactBar } from './PlanFactBar'

export interface KpiCardProps {
  title: string
  value: number
  /** 'money' | 'pct' | 'number' | 'days' | 'ratio' | 'score' yoki maxsus funksiya */
  format?: ValueFormat | ((v: number) => string)
  /** % o'zgarish (oldingi davrga). null → ko'rsatilmaydi */
  delta?: number | null
  deltaLabel?: string
  /** delta birligi: % (default) yoki 'p.p.' / ' kun' */
  deltaUnit?: string
  /** delta kasr xonalari (default 1) */
  deltaDecimals?: number
  /** delta'ni o'zicha formatlash (masalan, absolyut pul farqi) */
  deltaFormat?: (v: number) => string
  /** xarajat/kamayish yaxshi */
  invert?: boolean
  /** plan qiymati → Plan | Fakt | % bar */
  plan?: number | null
  planLabel?: string
  sparkline?: number[]
  hint?: string
  status?: 'good' | 'warn' | 'bad' | null
  icon?: ReactNode
  className?: string
  onClick?: () => void
  /** kichik karta (Overview 8 ta) */
  size?: 'md' | 'sm'
}

const STATUS_DOT = { good: 'bg-positive', warn: 'bg-warning', bad: 'bg-negative' }
const STATUS_TEXT = { good: 'Normada', warn: 'Diqqat', bad: 'Xavf' }

/**
 * KPI karta — yagona tuzilma (3A): holat nuqtasi + sarlavha → katta raqam → taqqoslama →
 * (ixtiyoriy) plan chizig'i → sparkline (to'ldirishsiz) → (ixtiyoriy) 2 qatorlik izoh.
 */
export function KpiCard({ title, value, format = 'money', delta, deltaLabel, deltaUnit, deltaDecimals, deltaFormat, invert = false, plan, planLabel, sparkline, hint, status, icon, className, onClick, size = 'md' }: KpiCardProps) {
  useLanguageStore((state) => state.language)
  const { currency } = useCurrency()
  const fmt = (v: number) => (typeof format === 'function' ? format(v) : fmtValue(v, format, currency))
  const v = fin(value)
  const hasDelta = delta !== undefined && delta !== null
  const shown = localize(fmt(v))
  return (
    <div
      className={cn('card-surface h-full p-4 flex flex-col gap-2.5 min-w-0 animate-fade-in', onClick && 'cursor-pointer transition-colors hover:border-gold/50', className)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 min-w-0">
          {status && <span className={cn('status-dot', STATUS_DOT[status])} aria-label={localize(STATUS_TEXT[status])} />}
          <span className="text-[13px] font-medium text-txt-secondary line-clamp-2 leading-tight" title={localize(title)}>{localize(title)}</span>
        </span>
        {icon && <span className="shrink-0 text-txt-muted">{icon}</span>}
      </div>
      <div className={cn('kpi-value truncate', size === 'sm' && 'text-xl')} title={shown}>{shown}</div>
      <div className="flex items-center gap-2 min-h-[20px] flex-wrap">
        {hasDelta && <DeltaChip value={delta} invert={invert} unit={deltaUnit} decimals={deltaDecimals} format={deltaFormat} />}
        {deltaLabel && hasDelta && <span className="text-[11px] text-txt-muted">{localize(deltaLabel)}</span>}
        {hint && !hasDelta && <span className="text-[11px] leading-snug text-txt-muted line-clamp-2" title={localize(hint)}>{localize(hint)}</span>}
      </div>
      {plan !== undefined && plan !== null && <PlanFactBar fact={v} plan={plan} isCost={invert} format={fmt} label={planLabel ?? 'Plan'} compact />}
      {sparkline && sparkline.length > 1 && <Sparkline data={sparkline} invert={invert} height={size === 'sm' ? 28 : 36} />}
      {hint && hasDelta && <span className="text-[11px] leading-snug text-txt-muted line-clamp-2" title={localize(hint)}>{localize(hint)}</span>}
    </div>
  )
}
