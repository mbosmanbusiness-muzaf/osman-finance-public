import { translate as localize, useLanguageStore } from "@/i18n"
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTooltip, axisStyle, gridStyle, legendStyle } from '@/components/shared'
import { useChartPalette, useCurrency } from '@/hooks'
import type { BudgetNode, PnLMonthPoint } from '@/lib/finance'
import { fmtMonth, fmtPct } from '@/lib/format'
import { fin } from '@/lib/utils'
import type { PnLGroup } from '@/types'

export function EmptyNote({ text = "Ma'lumot yo'q" }: { text?: string }) {
  useLanguageStore((state) => state.language)
  return <div className="h-full flex items-center justify-center text-sm text-txt-muted">{localize(text)}</div>
}

export const GROUP_SHORT: Record<PnLGroup, string> = {
  revenue: 'Tushum', cogs: 'COGS', opex: 'OPEX', depreciation: 'Amort.', otherIncome: 'Boshqa dar.', interest: 'Foizlar', tax: 'Soliq',
}

/** Guruhlar bo'yicha Plan vs Fakt (juft ustunlar). */
export function GroupsPlanFactChart({ nodes }: { nodes: BudgetNode[] }) {
  useLanguageStore((state) => state.language)
  const p = useChartPalette()
  const { money } = useCurrency()
  const data = nodes.map((n) => ({ name: n.group ? GROUP_SHORT[n.group] : n.label, plan: fin(n.plan), fact: fin(n.fact), perf: fin(n.performance) }))
  if (!data.length) return <EmptyNote />
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
        <CartesianGrid {...gridStyle(p)} />
        <XAxis dataKey="name" {...axisStyle(p)} />
        <YAxis {...axisStyle(p)} tickFormatter={(v: number) => money(v)} width={64} />
        <Tooltip content={<ChartTooltip labelFormatter={(l, pl) => { const r = pl?.[0]?.payload as { perf?: number } | undefined; return `${String(l)}${r ? ` · bajarilish ${fmtPct(fin(r.perf), 0)}` : ''}` }} />} cursor={{ fill: p.grid }} />
        <Legend {...legendStyle(p)} />
        <Bar dataKey="plan" name={localize("Plan")} fill={p.info} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="fact" name={localize("Fakt")} fill={p.gold} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Moddalar bajarilishi % — gorizontal, rang holat bo'yicha; 90 va 100 chiziqlari. */
export function ItemsPerformanceChart({ items }: { items: BudgetNode[] }) {
  useLanguageStore((state) => state.language)
  const p = useChartPalette()
  const { money } = useCurrency()
  const data = items.filter((i) => fin(i.plan) > 0).sort((a, b) => a.performance - b.performance).map((i) => ({ name: i.label, perf: Math.min(200, fin(i.performance)), status: i.status, plan: i.plan, fact: i.fact, isCost: i.isCostItem }))
  if (!data.length) return <EmptyNote text="Plan kiritilmagan" />
  const color = (s: string) => (s === 'good' ? p.positive : s === 'warn' ? p.warning : p.negative)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, left: 4, bottom: 0 }} barCategoryGap="22%">
        <CartesianGrid {...gridStyle(p)} vertical horizontal={false} />
        <XAxis type="number" domain={[0, (max: number) => Math.max(120, Math.ceil(max / 10) * 10)]} {...axisStyle(p)} tickFormatter={(v: number) => `${v}%`} />
        <YAxis type="category" dataKey="name" width={130} {...axisStyle(p)} tick={{ fill: p.muted, fontSize: 10 }} interval={0} />
        <Tooltip content={<ChartTooltip formatter={(v, _n, it) => { const r = it.payload as { plan: number; fact: number; isCost: boolean }; return `${fmtPct(v, 0)} · plan ${money(r.plan)} · fakt ${money(r.fact)}${r.isCost ? ' (xarajat: plan/fakt)' : ''}` }} />} cursor={{ fill: p.grid }} />
        <ReferenceLine x={100} stroke={p.positive} strokeDasharray="4 4" />
        <ReferenceLine x={90} stroke={p.warning} strokeDasharray="4 4" />
        <Bar dataKey="perf" name={localize("Bajarilish %")} radius={[0, 3, 3, 0]} isAnimationActive={false}>
          {(data.map((d) => <Cell key={d.name} fill={color(d.status)} />))}
          <LabelList dataKey="perf" position="right" formatter={(v: number) => `${Math.round(v)}%`} style={{ fill: p.textSecondary, fontSize: 10 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Oylik plan vs fakt: tushum (ustun/punktir) va sof foyda (chiziq/punktir, o'ng o'q). */
export function MonthlyPlanFactChart({ series }: { series: PnLMonthPoint[] }) {
  useLanguageStore((state) => state.language)
  const p = useChartPalette()
  const { money } = useCurrency()
  if (!series.length) return <EmptyNote />
  const data = series.map((s) => ({ label: fmtMonth(s.month), revenue: fin(s.revenue), planRevenue: fin(s.planRevenue), netProfit: fin(s.netProfit), planNetProfit: fin(s.planNetProfit) }))
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridStyle(p)} />
        <XAxis dataKey="label" {...axisStyle(p)} minTickGap={12} />
        <YAxis yAxisId="l" {...axisStyle(p)} tickFormatter={(v: number) => money(v)} width={64} />
        <YAxis yAxisId="r" orientation="right" {...axisStyle(p)} tickFormatter={(v: number) => money(v)} width={64} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: p.grid }} />
        <Legend {...legendStyle(p)} />
        <Bar yAxisId="l" dataKey="revenue" name={localize("Tushum (fakt)")} fill={p.gold} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        <Line yAxisId="l" dataKey="planRevenue" name={localize("Tushum (plan)")} stroke={p.info} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
        <Line yAxisId="r" dataKey="netProfit" name={localize("Sof foyda (fakt)")} stroke={p.positive} strokeWidth={2.5} dot={false} isAnimationActive={false} />
        <Line yAxisId="r" dataKey="planNetProfit" name={localize("Sof foyda (plan)")} stroke={p.positive} strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
