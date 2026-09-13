import { translate as localize, useLanguageStore } from "@/i18n"
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTooltip, axisStyle, gridStyle, legendStyle } from '@/components/shared'
import { useChartPalette, useCurrency } from '@/hooks'
import { fmtMonth } from '@/lib/format'
import type { CfMonthPoint } from '@/lib/finance'
import { EmptyNote } from './common'

/** Oylar bo'yicha 3 oqim (stacked, ishora bo'yicha) + sof o'zgarish chizig'i. */
export function FlowsCompositionChart({ series }: { series: CfMonthPoint[] }) {
  useLanguageStore((state) => state.language)
  const p = useChartPalette()
  const { money } = useCurrency()
  if (!series.length) return <EmptyNote />
  const rows = series.map((s) => ({ label: fmtMonth(s.month), ocf: s.ocf, icf: s.icf, fcf: s.fcf, netChange: s.netChange }))
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} stackOffset="sign" margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid {...gridStyle(p)} />
        <XAxis dataKey="label" {...axisStyle(p)} />
        <YAxis {...axisStyle(p)} tickFormatter={(v: number) => money(v)} width={64} />
        <Tooltip content={<ChartTooltip formatter={(v) => money(v, { sign: true })} />} cursor={{ fill: p.grid }} />
        <Legend {...legendStyle(p)} />
        <ReferenceLine y={0} stroke={p.muted} />
        <Bar dataKey="ocf" name={localize("Operatsion CF")} stackId="cf" fill={p.positive} maxBarSize={40} isAnimationActive={false} />
        <Bar dataKey="icf" name={localize("Investitsion CF")} stackId="cf" fill={p.info} maxBarSize={40} isAnimationActive={false} />
        <Bar dataKey="fcf" name={localize("Moliyaviy CF")} stackId="cf" fill={p.purple} maxBarSize={40} isAnimationActive={false} />
        <Line type="monotone" dataKey="netChange" name={localize("Sof o'zgarish")} stroke={p.gold} strokeWidth={2} dot={{ r: 3, fill: p.gold, stroke: p.gold }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
