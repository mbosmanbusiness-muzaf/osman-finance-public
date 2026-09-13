import { translate as localize, useLanguageStore } from "@/i18n"
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { ChartCard, ChartTooltip, DeltaChip, PlanFactBar, axisStyle } from '@/components/shared'
import { useChartPalette, useCurrency, usePeriod } from '@/hooks'
import { fmtMonth } from '@/lib/format'
import { fin } from '@/lib/utils'
import { EmptyNote } from './common'
import { flowDelta, type CashflowModel } from './useCashflowModel'

interface FlowCardProps {
  title: string
  subtitle: string
  total: number
  prev: number
  hasPrev: boolean
  /** plan (faqat OCF) */
  plan?: number | null
  invert?: boolean
  points: { month: string; value: number }[]
  exportName: string
}

/** Bitta oqim kartasi: katta raqam + ▲/▼ + (plan bar) + oylik ustunlar (ishora bo'yicha rang). */
export function FlowCard({ title, subtitle, total, prev, hasPrev, plan, invert = false, points, exportName }: FlowCardProps) {
  useLanguageStore((state) => state.language)
  const p = useChartPalette()
  const { money } = useCurrency()
  const { compareLabel, noCompareText } = usePeriod()
  const delta = flowDelta(total, prev, hasPrev)
  const rows = points.map((pt) => ({ label: fmtMonth(pt.month), value: fin(pt.value) }))
  const exportData = points.map((pt) => ({ Oy: fmtMonth(pt.month), [title]: fin(pt.value) }))
  return (
    <ChartCard
      title={localize(title)}
      subtitle={localize(subtitle)}
      height={196}
      exportData={exportData}
      exportName={exportName}
      headerRight={delta !== null
        ? <DeltaChip value={delta.value} invert={invert} label={localize(compareLabel)} format={delta.isAbs ? (v) => money(v, { sign: true }) : undefined} />
        : <span className="text-[11px] text-txt-muted">{localize(noCompareText)}</span>}
    >
      <div className="h-full flex flex-col px-2">
        <div className="kpi-value truncate pt-1" title={localize(money(total))}>{localize(money(total))}</div>
        {(plan !== undefined && plan !== null && <PlanFactBar fact={total} plan={plan} format={(v) => money(v)} label={localize("Plan")} compact className="mt-2" />)}
        <div className="flex-1 min-h-0 mt-2">
          {(rows.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="label" {...axisStyle(p)} interval="preserveStartEnd" minTickGap={20} height={18} />
                <Tooltip content={<ChartTooltip formatter={(v) => money(v, { sign: true })} />} cursor={{ fill: p.grid }} />
                <ReferenceLine y={0} stroke={p.grid} />
                <Bar dataKey="value" name={localize(title)} maxBarSize={28} radius={[2, 2, 0, 0]} isAnimationActive={false}>
                  {(rows.map((r, i) => <Cell key={i} fill={r.value >= 0 ? p.positive : p.negative} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyNote />)}
        </div>
      </div>
    </ChartCard>
  )
}

/** Operatsion / Investitsion / Moliyaviy CF — 3 ustunli karta qatori. */
export function FlowCards({ model }: { model: CashflowModel }) {
  useLanguageStore((state) => state.language)
  const { totals, prevTotals, hasPrev, series, planOcf } = model
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <FlowCard
        title={localize("Operatsion CF")}
        subtitle={localize("Asosiy faoliyatdan sof pul oqimi: mijozlardan tushum minus operatsion to'lovlar.")}
        total={totals.ocf}
        prev={prevTotals.ocf}
        hasPrev={hasPrev}
        plan={planOcf}
        points={series.map((s) => ({ month: s.month, value: s.ocf }))}
        exportName="Cashflow_OCF"
      />
      <FlowCard
        title={localize("Investitsion CF")}
        subtitle={localize("Kapital xarajatlar (CapEx) va aktivlar sotuvidan pul oqimi.")}
        total={totals.icf}
        prev={prevTotals.icf}
        hasPrev={hasPrev}
        invert
        points={series.map((s) => ({ month: s.month, value: s.icf }))}
        exportName="Cashflow_ICF"
      />
      <FlowCard
        title={localize("Moliyaviy CF")}
        subtitle={localize("Kreditlar olish/qaytarish va dividendlar bo'yicha pul oqimi.")}
        total={totals.fcf}
        prev={prevTotals.fcf}
        hasPrev={hasPrev}
        points={series.map((s) => ({ month: s.month, value: s.fcf }))}
        exportName="Cashflow_FCF"
      />
    </div>
  )
}
