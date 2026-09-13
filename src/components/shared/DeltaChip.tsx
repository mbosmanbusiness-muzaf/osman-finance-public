import { translate as localize, useLanguageStore } from "@/i18n"
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn, fin } from '@/lib/utils'
import { fmtPct, localizeDigits, roundTo } from '@/lib/format'

interface DeltaChipProps {
  /** foiz o'zgarish (12.4 → ▲ +12.4%) */
  value: number | null | undefined
  /** kamayish yaxshi (xarajat) */
  invert?: boolean
  /** "p.p." kabi birlik — default % */
  unit?: string
  label?: string
  className?: string
  decimals?: number
  /** o'z formatlash (masalan, pul farqi: +1.2B) */
  format?: (v: number) => string
}

/** ▲ +12.4% / ▼ −3.1% taqqoslama chipi. */
export function DeltaChip({ value, invert = false, unit, label, className, decimals = 1, format }: DeltaChipProps) {
  useLanguageStore((state) => state.language)
  const v = format ? fin(value) : roundTo(fin(value), decimals)
  const flat = format ? Math.abs(v) < 0.5 : v === 0
  const good = invert ? v < 0 : v > 0
  const tone = flat ? 'chip-muted' : good ? 'chip-pos' : 'chip-neg'
  const Icon = flat ? Minus : v > 0 ? ArrowUpRight : ArrowDownRight
  const text = format ? format(v) : unit ? `${v > 0 ? '+' : ''}${localizeDigits(v.toFixed(decimals)).replace('-', '−')}${unit}` : fmtPct(v, decimals, true)
  return (
    <span className={cn('chip', tone, className)} title={localize(label)}>
      <Icon className="h-3 w-3" />
      {localize(text)}
      {localize(label && <span className="font-normal opacity-80 ml-0.5">{localize(label)}</span>)}
    </span>
  )
}
