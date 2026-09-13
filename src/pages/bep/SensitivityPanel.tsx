import { translate as localize, useLanguageStore } from "@/i18n"
import { Slider } from '@/components/ui/slider'
import { useCurrency } from '@/hooks'
import type { BepResult, SensitivityDeltas } from '@/lib/finance/bep'
import { fmtNum, fmtPct } from '@/lib/format'
import { cn, pctChange } from '@/lib/utils'
import { MiniStat, type MiniStatProps } from './BepInputsStrip'
import { FACTORS, SLIDER_MAX, SLIDER_MIN, fmtSignedPct, isComputable, type FactorKey } from './helpers'

interface Props {
  deltas: SensitivityDeltas
  onChange: (key: FactorKey, value: number) => void
  scenario: BepResult
  base: BepResult
  active: boolean
  height: number
}

/** 4 slider (−20…+20%) + natija chizig'i: sof foyda, BEP dona, BEP summa, MoS % (ssenariy vs baza). */
export function SensitivityPanel({ deltas, onChange, scenario, base, active, height }: Props) {
  useLanguageStore((state) => state.language)
  const { money } = useCurrency()
  const sOk = isComputable(scenario)
  const bOk = isComputable(base)
  const both = sOk && bOk
  const stats: MiniStatProps[] = [
    { label: 'Sof foyda', value: money(scenario.profit), delta: pctChange(scenario.profit, base.profit), base: money(base.profit), active },
    { label: 'BEP (dona)', value: sOk ? fmtNum(scenario.bepUnits, 0) : '—', delta: both ? pctChange(scenario.bepUnits, base.bepUnits) : null, invert: true, base: bOk ? fmtNum(base.bepUnits, 0) : '—', active },
    { label: 'BEP (summa)', value: sOk ? money(scenario.bepRevenue) : '—', delta: both ? pctChange(scenario.bepRevenue, base.bepRevenue) : null, invert: true, base: bOk ? money(base.bepRevenue) : '—', active },
    { label: 'Margin of safety', value: sOk ? fmtPct(scenario.marginOfSafetyPct) : '—', delta: both ? scenario.marginOfSafetyPct - base.marginOfSafetyPct : null, unit: ' p.p.', base: bOk ? fmtPct(base.marginOfSafetyPct) : '—', active },
  ]
  return (
    <div style={{ height }} className="flex flex-col gap-3 px-2 overflow-auto">
      <div className="space-y-2 pt-1">
        {(FACTORS.map((f) => {
          const v = deltas[f.key]
          const good = v === 0 ? null : (v > 0) !== f.isCost
          return (
            <div key={f.key} className="grid grid-cols-[minmax(96px,128px)_1fr_52px] items-center gap-3">
              <span className="text-xs text-txt-secondary truncate" title={localize(f.label)}>{localize(f.label)}</span>
              <Slider value={[v]} min={SLIDER_MIN} max={SLIDER_MAX} step={1} onValueChange={(arr) => onChange(f.key, arr[0] ?? 0)} aria-label={localize(f.label)} />
              <span className={cn('num text-xs font-semibold text-right', good === null ? 'text-txt-muted' : good ? 'text-positive' : 'text-negative')}>{localize(fmtSignedPct(v))}</span>
            </div>
          )
        }))}
        <p className="text-[11px] text-txt-muted">{localize("Slider surilganda KPI, BEP grafigi, tornado va egri chiziqlar jonli qayta hisoblanadi.")}</p>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 mt-auto pb-1">
        {(stats.map((s) => <MiniStat key={s.label} {...s} />))}
      </div>
    </div>
  )
}
