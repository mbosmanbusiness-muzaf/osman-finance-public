import { t, translate as localize, useLanguageStore } from '@/i18n'
import { Info } from 'lucide-react'
import { DeltaChip, Sparkline } from '@/components/shared'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useCurrency, usePeriod } from '@/hooks'
import type { RatioCard, RatioStatus } from '@/lib/finance'
import { fmtDays, fmtNum, fmtPct, fmtRatio, localizeDigits } from '@/lib/format'
import type { KpiUnit } from '@/types'
import { cn, fin } from '@/lib/utils'

const DOT: Record<RatioStatus, string> = { good: 'bg-positive', warn: 'bg-warning', bad: 'bg-negative' }
const TEXT: Record<RatioStatus, string> = { good: 'text-positive', warn: 'text-warning', bad: 'text-negative' }
const STATUS_LABEL: Record<RatioStatus, string> = { good: 'Normada', warn: 'Diqqat', bad: 'Xavf' }

export function fmtUnit(v: number, unit: KpiUnit, money: (n: number) => string): string {
  switch (unit) {
    case 'pct': return fmtPct(v)
    case 'days': return fmtDays(v)
    case 'ratio': return fmtRatio(v)
    case 'score': return localizeDigits(fin(v).toFixed(2))
    case 'money': return money(v)
  }
}

/** Norma oralig'i: birlik bir marta oxirida ("45–70 kun"), aks holda ru/en da qator sig'masdi (AUDIT). */
function rangeText(min: number, max: number, unit: KpiUnit, money: (n: number) => string): string {
  switch (unit) {
    case 'money': return `${money(min)}–${money(max)}`
    case 'days': return `${fmtNum(min, 0)}–${fmtNum(max, 0)} ${t('kun')}`
    case 'pct': return `${localizeDigits(fin(min).toFixed(1))}–${localizeDigits(fin(max).toFixed(1))}%`
    case 'ratio': return `${localizeDigits(fin(min).toFixed(2))}–${localizeDigits(fin(max).toFixed(2))}×`
    case 'score': return `${localizeDigits(fin(min).toFixed(2))}–${localizeDigits(fin(max).toFixed(2))}`
  }
}

/** Norma diapazoni ichida qiymat qayerda turganini ko'rsatuvchi kichik chiziq. */
function NormBar({ value, normMin, normMax, target, status }: { value: number; normMin: number; normMax: number; target: number; status: RatioStatus }) {
  useLanguageStore((state) => state.language)
  const span = Math.max(1e-9, normMax - normMin)
  const lo = Math.min(normMin - span * 0.35, value), hi = Math.max(normMax + span * 0.35, value)
  const pos = (x: number) => `${Math.max(0, Math.min(100, ((x - lo) / Math.max(1e-9, hi - lo)) * 100))}%`
  return (
    <div className="relative h-1.5 w-full rounded-full bg-elevated mt-0.5">
      <div className="absolute inset-y-0 rounded-full bg-positive/30" style={{ left: pos(normMin), width: `calc(${pos(normMax)} - ${pos(normMin)})` }} />
      <div className="absolute -top-0.5 h-2.5 w-px bg-txt-muted" style={{ left: pos(target) }} title={localize('Maqsad')} />
      <div className={cn('absolute -top-[3px] h-3 w-3 rounded-full border-2 border-surface', DOT[status])} style={{ left: `calc(${pos(value)} - 6px)` }} />
    </div>
  )
}

/** Koeffitsiyent kartasi: qiymat → ▲/▼ → norma/maqsad chizig'i → sparkline → 1 qatorlik izoh. */
export function RatioCardView({ card }: { card: RatioCard }) {
  useLanguageStore((state) => state.language)
  const { money } = useCurrency()
  const { compareLabel, noCompareText } = usePeriod()
  const fmt = (v: number) => fmtUnit(v, card.unit, money)
  // izoh shabloni tanlangan tilda, qiymatlar — tilning o'nlik ajratgichi bilan ("0,24")
  const explain = t(card.explainKey, Object.fromEntries(Object.entries(card.explainValues).map(([key, value]) => [key, localizeDigits(value)])))
  const diff = fin(card.value) - fin(card.prev)
  const unit = card.unit === 'pct' ? ' p.p.' : card.unit === 'days' ? ' kun' : ''
  const decimals = card.unit === 'days' ? 0 : card.unit === 'pct' ? 1 : 2
  return (
    <div className="card-surface p-4 flex flex-col gap-2 min-w-0 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className={cn('status-dot', DOT[card.status])} />
          <span className="text-xs font-medium text-txt-secondary line-clamp-2 leading-tight" title={localize(card.label)}>{localize(card.label)}</span>
        </span>
        <Tooltip>
          <TooltipTrigger asChild><button className="shrink-0 text-txt-muted hover:text-txt-primary" aria-label={localize('Formula')}><Info className="h-3.5 w-3.5" /></button></TooltipTrigger>
          <TooltipContent side="top"><span className="num">{localize(card.formula)}</span></TooltipContent>
        </Tooltip>
      </div>
      <div className="flex items-baseline justify-between gap-2 min-w-0">
        <div className="kpi-value truncate" title={fmt(card.value)}>{fmt(card.value)}</div>
        <span className={cn('shrink-0 text-[11px] font-medium', TEXT[card.status])}>{localize(STATUS_LABEL[card.status])}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap min-h-[20px]">
        {card.hasPrev ? (
          <>
            <DeltaChip value={diff} invert={card.lowerIsBetter} unit={unit} decimals={decimals} />
            <span className="text-[11px] text-txt-muted">{localize(compareLabel)}</span>
          </>
        ) : <span className="text-[11px] text-txt-muted">{localize(noCompareText)}</span>}
      </div>
      <div>
        <div className="flex flex-wrap justify-between gap-x-2 text-[11px] text-txt-muted num">
          <span className="whitespace-nowrap">{localize('Norma')} {rangeText(card.normMin, card.normMax, card.unit, money)}</span>
          <span className="whitespace-nowrap">{localize('Maqsad')} {fmt(card.target)}</span>
        </div>
        <NormBar value={fin(card.value)} normMin={card.normMin} normMax={card.normMax} target={card.target} status={card.status} />
      </div>
      {card.sub && (
        <div className="flex flex-wrap gap-1">
          {card.sub.map((s) => (
            <span key={s.label} className="chip chip-muted">{localize(s.label)} <span className="text-txt-primary">{fmtUnit(s.value, s.unit, money)}</span></span>
          ))}
        </div>
      )}
      <Sparkline data={card.series} neutral height={28} />
      <p className="text-[11px] text-txt-secondary leading-snug line-clamp-2" title={explain}>{explain}</p>
    </div>
  )
}
