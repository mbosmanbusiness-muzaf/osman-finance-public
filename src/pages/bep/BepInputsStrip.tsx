import { translate as localize, useLanguageStore } from '@/i18n'
import { DeltaChip } from '@/components/shared'
import { useCurrency } from '@/hooks'
import type { BepResult } from '@/lib/finance/bep'
import { fmtNum } from '@/lib/format'
import { pctChange } from '@/lib/utils'

export interface MiniStatProps {
  label: string
  value: string
  /** ssenariy → baza o'zgarishi (faol bo'lsa) */
  delta?: number | null
  unit?: string
  invert?: boolean
  base?: string
  active: boolean
}

/** Kichik ko'rsatkich: sarlavha → qiymat → (ssenariy faol bo'lsa) Δ chip + "Baza: …". */
export function MiniStat({ label, value, delta, unit, invert, base, active }: MiniStatProps) {
  useLanguageStore((state) => state.language)
  const hasDelta = active && delta !== null && delta !== undefined
  return (
    <div className="rounded-lg bg-elevated/60 px-2.5 py-1.5 min-w-0">
      <div className="text-[11px] text-txt-muted truncate" title={localize(label)}>{localize(label)}</div>
      <div className="num text-sm font-semibold text-txt-primary truncate" title={value}>{value}</div>
      <div className="flex items-center gap-1.5 min-h-[18px] flex-wrap">
        {hasDelta ? <DeltaChip value={delta} invert={invert} unit={unit} /> : <span className="text-[11px] text-txt-muted">{active ? '—' : localize('baza')}</span>}
        {active && base && <span className="text-[11px] text-txt-muted truncate">{localize('Baza:')} {base}</span>}
      </div>
    </div>
  )
}

interface StripProps {
  scenario: BepResult
  base: BepResult
  active: boolean
  periodLabel: string
}

/** BEP modelining kirish ma'lumotlari: hajm, narx, o'zgaruvchan xarajat/dona, contribution/dona, tushum. */
export function BepInputsStrip({ scenario, base, active, periodLabel }: StripProps) {
  useLanguageStore((state) => state.language)
  const { money } = useCurrency()
  const items: MiniStatProps[] = [
    { label: 'Hajm (dona)', value: fmtNum(scenario.units, 0), delta: pctChange(scenario.units, base.units), base: fmtNum(base.units, 0), active },
    { label: "O'rtacha narx (dona)", value: money(scenario.price), delta: pctChange(scenario.price, base.price), base: money(base.price), active },
    { label: "O'zg. xarajat (dona)", value: money(scenario.varCostPerUnit), delta: pctChange(scenario.varCostPerUnit, base.varCostPerUnit), invert: true, base: money(base.varCostPerUnit), active },
    { label: 'Contribution (dona)', value: money(scenario.contributionPerUnit), delta: pctChange(scenario.contributionPerUnit, base.contributionPerUnit), base: money(base.contributionPerUnit), active },
    { label: 'Tushum', value: money(scenario.revenue), delta: pctChange(scenario.revenue, base.revenue), base: money(base.revenue), active },
    { label: "O'zgaruvchan xarajatlar", value: money(scenario.variableCosts), delta: pctChange(scenario.variableCosts, base.variableCosts), invert: true, base: money(base.variableCosts), active },
  ]
  return (
    <div className="card-surface p-4 animate-fade-in">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h3 className="section-title">{localize("Model kirish ma'lumotlari")}</h3>
          <p className="text-xs text-txt-muted">{localize("Narx = tushum / sotilgan dona; o'zgaruvchan xarajat = COGS + logistika + marketing; qolgan OPEX, amortizatsiya va foizlar — doimiy.")}</p>
        </div>
        <span className="text-xs text-txt-muted num shrink-0">{periodLabel}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {items.map((it) => <MiniStat key={it.label} {...it} />)}
      </div>
    </div>
  )
}
