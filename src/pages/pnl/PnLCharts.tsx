import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { t, translate as localize, useLanguageStore } from '@/i18n'
import { ChartTooltip, axisStyle, axisWidth, gridStyle, legendStyle } from '@/components/shared'
import { useChartPalette, useCurrency } from '@/hooks'
import { categoryColor, seriesColor } from '@/lib/palette'
import { fmtMonth, fmtPct } from '@/lib/format'
import { fin, safeDiv } from '@/lib/utils'
import type { CategoryProfit, PnLMonthPoint } from '@/lib/finance'
import type { OpexItem } from './usePnLData'

/** Bo'sh kesim uchun qisqa izoh (bo'sh grafik o'rniga). */
export function ChartNote({ text = "Ma'lumot yo'q" }: { text?: string }) {
  useLanguageStore((state) => state.language)
  return <div className="h-full flex items-center justify-center text-sm text-txt-muted">{localize(text)}</div>
}

/**
 * 12 oylik dinamika: ustun — tushum, punktir — plan tushum (chap o'q, pul),
 * chiziq — sof marja % (o'ng o'q). Ilgari o'ng o'q ham pulda edi: sof foyda tushumdan
 * "balandroq" ko'rinib, noto'g'ri o'qilardi (AUDIT C4).
 */
export function DynamicsChart({ series }: { series: PnLMonthPoint[] }) {
  useLanguageStore((state) => state.language)
  const p = useChartPalette()
  const { money } = useCurrency()
  if (!series.length) return <ChartNote />
  const rows = series.map((s) => ({
    label: fmtMonth(s.month),
    revenue: fin(s.revenue),
    netProfit: fin(s.netProfit),
    planRevenue: fin(s.planRevenue),
    netMargin: Number((safeDiv(fin(s.netProfit), fin(s.revenue), 0) * 100).toFixed(1)),
  }))
  const hasPlan = rows.some((r) => r.planRevenue > 0)
  const maxMoney = Math.max(...rows.map((r) => Math.max(r.revenue, r.planRevenue)), 0)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridStyle(p)} />
        <XAxis dataKey="label" {...axisStyle(p)} />
        <YAxis yAxisId="left" {...axisStyle(p)} tickFormatter={(v: number) => money(v)} width={axisWidth([money(maxMoney)])} />
        <YAxis yAxisId="right" orientation="right" {...axisStyle(p)} tickFormatter={(v: number) => `${v}%`} width={44} />
        <Tooltip
          cursor={{ fill: p.grid }}
          content={<ChartTooltip formatter={(v, _n, it) => {
            if (it.dataKey !== 'netMargin') return money(v)
            const row = it.payload as { netProfit?: number } | undefined
            return `${fmtPct(v)} · ${money(fin(row?.netProfit))}`
          }} />}
        />
        <Legend {...legendStyle(p)} />
        <Bar yAxisId="left" dataKey="revenue" name={localize('Tushum')} fill={seriesColor(p, 'revenue')} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        {hasPlan && <Line yAxisId="left" dataKey="planRevenue" name={localize('Plan tushum')} stroke={p.plan} strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} />}
        <Line yAxisId="right" dataKey="netMargin" name={localize('Sof marja %')} stroke={seriesColor(p, 'profit')} strokeWidth={2.5} dot={{ r: 3, fill: seriesColor(p, 'profit'), strokeWidth: 0 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/** Kategoriya bo'yicha yalpi foyda — gorizontal ustunlar bir rangda, yorliq — marja % (ikkilamchi). */
export function CategoryChart({ categories }: { categories: CategoryProfit[] }) {
  useLanguageStore((state) => state.language)
  const p = useChartPalette()
  const { money } = useCurrency()
  if (!categories.length) return <ChartNote />
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={categories} layout="vertical" margin={{ top: 4, right: 56, left: 4, bottom: 0 }}>
        <CartesianGrid {...gridStyle(p)} vertical horizontal={false} />
        <XAxis type="number" {...axisStyle(p)} tickFormatter={(v: number) => money(v)} />
        <YAxis type="category" dataKey="category" {...axisStyle(p)} width={axisWidth(categories.map((c) => localize(c.category)), 96, 170)} />
        <Tooltip
          cursor={{ fill: p.grid }}
          content={
            <ChartTooltip
              labelFormatter={(label, payload) => {
                const row = payload?.[0]?.payload as unknown as CategoryProfit | undefined
                if (!row) return String(label)
                return (
                  <span>
                    {String(label)}
                    <span className="block font-normal text-txt-secondary num">
                      {t('Tushum {revenue} · COGS {cogs} · Marja {margin}', { revenue: money(fin(row.revenue)), cogs: money(fin(row.cogs)), margin: fmtPct(fin(row.margin)) })}
                    </span>
                  </span>
                )
              }}
            />
          }
        />
        <Bar dataKey="grossProfit" name={localize('Yalpi foyda')} fill={seriesColor(p, 'revenue')} radius={[0, 3, 3, 0]} isAnimationActive={false}>
          <LabelList dataKey="margin" position="right" formatter={(v: number) => fmtPct(v)} style={{ fill: p.muted, fontSize: 11 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** OPEX tarkibi — donut + o'ng tomonda modda ro'yxati (summa va ulush %). */
export function OpexDonut({ items, total, expanded = false }: { items: OpexItem[]; total: number; expanded?: boolean }) {
  useLanguageStore((state) => state.language)
  const p = useChartPalette()
  const { money } = useCurrency()
  if (!items.length || total <= 0) return <ChartNote />
  const color = (i: number) => categoryColor(p, i)
  const shown = items.slice(0, expanded ? 12 : 8)
  return (
    <div className="flex h-full min-w-0 gap-3">
      <div className="relative flex-1 min-w-0 h-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Tooltip content={<ChartTooltip formatter={(v, _name, it) => `${money(v)} · ${fmtPct(fin(it.payload?.share))}`} />} />
            <Pie data={items} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="84%" paddingAngle={2} stroke={p.surface} isAnimationActive={false}>
              {items.map((it, i) => <Cell key={it.name} fill={color(i)} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] text-txt-muted">{localize('Jami OPEX')}</span>
          <span className="num font-heading font-semibold text-base text-txt-primary">{money(total)}</span>
        </div>
      </div>
      <ul className="w-[48%] shrink-0 self-center space-y-1 text-xs min-w-0">
        {shown.map((it, i) => (
          <li key={it.name} className="flex items-center gap-2 min-w-0">
            <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: color(i) }} />
            <span className="line-clamp-2 leading-tight text-txt-secondary flex-1" title={localize(it.name)}>{localize(it.name)}</span>
            <span className="num text-txt-primary shrink-0">{money(it.value)}</span>
            <span className="num text-txt-muted w-11 text-right shrink-0">{fmtPct(it.share)}</span>
          </li>
        ))}
        {items.length > shown.length && <li className="text-txt-muted">{t('+{n} ta boshqa modda', { n: items.length - shown.length })}</li>}
      </ul>
    </div>
  )
}
