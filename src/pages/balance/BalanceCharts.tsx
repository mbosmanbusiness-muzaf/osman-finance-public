import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, Treemap, XAxis, YAxis } from 'recharts'
import { t, translate as localize, useLanguageStore } from '@/i18n'
import { ChartTooltip, axisStyle, axisWidth, gridStyle, legendStyle } from '@/components/shared'
import { useChartPalette, useCurrency } from '@/hooks'
import { categoryColor, seriesColor } from '@/lib/palette'
import { fmtMonth, fmtPct } from '@/lib/format'
import { fin } from '@/lib/utils'
import type { BalanceMonth } from '@/types'
import type { InventoryCategoryRow } from '@/lib/finance'
import { balanceTotals } from '@/lib/finance'

export function EmptyNote({ text = "Ma'lumot yo'q" }: { text?: string }) {
  useLanguageStore((state) => state.language)
  return <div className="h-full flex items-center justify-center text-sm text-txt-muted">{localize(text)}</div>
}

export const ASSET_KEYS: { key: keyof BalanceMonth; label: string }[] = [
  { key: 'cash', label: 'Pul mablag\'lari' }, { key: 'receivables', label: 'Debitorlik' }, { key: 'inventory', label: 'Zaxira' },
  { key: 'otherCurrentAssets', label: 'Boshqa joriy aktivlar' }, { key: 'fixedAssetsNet', label: 'Asosiy vositalar (sof)' }, { key: 'intangibles', label: 'Nomoddiy aktivlar' },
]
export const LIAB_KEYS: { key: keyof BalanceMonth; label: string }[] = [
  { key: 'payables', label: 'Kreditorlik' }, { key: 'shortTermDebt', label: 'Qisqa muddatli kredit' }, { key: 'otherCurrentLiabilities', label: 'Boshqa joriy majburiyatlar' },
  { key: 'longTermDebt', label: 'Uzoq muddatli kredit' }, { key: 'shareCapital', label: 'Ustav kapitali' }, { key: 'retainedEarnings', label: 'Taqsimlanmagan foyda' },
]

/** Grafik uchun guruhlar: 12 ta seriya bitta stackda o'qilmasdi (AUDIT) — har tomonda 4–5 guruh. */
interface Group { label: string; keys: (keyof BalanceMonth)[] }
const ASSET_GROUPS: Group[] = [
  { label: "Pul mablag'lari", keys: ['cash'] },
  { label: 'Debitorlik', keys: ['receivables'] },
  { label: 'Zaxira', keys: ['inventory'] },
  { label: 'Boshqa joriy aktivlar', keys: ['otherCurrentAssets'] },
  { label: 'Uzoq muddatli aktivlar', keys: ['fixedAssetsNet', 'intangibles'] },
]
const LIAB_GROUPS: Group[] = [
  { label: 'Kreditorlik', keys: ['payables'] },
  { label: 'Kreditlar', keys: ['shortTermDebt', 'longTermDebt'] },
  { label: 'Boshqa joriy majburiyatlar', keys: ['otherCurrentLiabilities'] },
  { label: 'Kapital', keys: ['shareCapital', 'retainedEarnings'] },
]

const groupSum = (bal: BalanceMonth, g: Group) => g.keys.reduce((a, k) => a + Math.max(0, fin(bal[k] as number)), 0)

/** Bitta ustun: tarkib stacked ko'rinishda, o'z legendasi bilan. */
function CompositionBar({ name, groups, bal, domainMax }: { name: string; groups: Group[]; bal: BalanceMonth; domainMax: number }) {
  const p = useChartPalette()
  const { money } = useCurrency()
  const row = Object.fromEntries([['name', localize(name)], ...groups.map((g) => [g.label, groupSum(bal, g)])])
  return (
    <div className="flex-1 min-w-0 h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[row]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="35%">
          <CartesianGrid {...gridStyle(p)} />
          <XAxis dataKey="name" {...axisStyle(p)} />
          <YAxis {...axisStyle(p)} tickFormatter={(v: number) => money(v)} width={axisWidth([money(domainMax)])} domain={[0, domainMax]} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: p.grid }} />
          <Legend {...legendStyle(p)} wrapperStyle={{ fontSize: 10, color: p.textSecondary }} />
          {groups.map((g, i) => <Bar key={g.label} dataKey={g.label} stackId="s" fill={categoryColor(p, i)} isAnimationActive={false} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Aktiv / Passiv+Kapital tarkibi — ikkita ustun yonma-yon, har birida 4–5 guruh va o'z legendasi. */
export function AssetLiabChart({ bal }: { bal: BalanceMonth }) {
  useLanguageStore((state) => state.language)
  const assets = ASSET_GROUPS.reduce((a, g) => a + groupSum(bal, g), 0)
  const liabs = LIAB_GROUPS.reduce((a, g) => a + groupSum(bal, g), 0)
  const domainMax = Math.max(assets, liabs, 1)
  return (
    <div className="h-full w-full flex gap-3 min-w-0">
      <CompositionBar name="Aktivlar" groups={ASSET_GROUPS} bal={bal} domainMax={domainMax} />
      <CompositionBar name="Passiv + Kapital" groups={LIAB_GROUPS} bal={bal} domainMax={domainMax} />
    </div>
  )
}

/** Balans dinamikasi: jami aktivlar, kapital, jami qarz. */
export function BalanceTrendChart({ rows }: { rows: BalanceMonth[] }) {
  useLanguageStore((state) => state.language)
  const p = useChartPalette()
  const { money } = useCurrency()
  if (!rows.length) return <EmptyNote />
  const data = rows.map((b) => { const tot = balanceTotals(b); return { label: fmtMonth(b.month), assets: tot.totalAssets, equity: tot.equity, debt: tot.totalDebt, liabilities: tot.totalLiabilities } })
  const maxMoney = Math.max(...data.map((d) => fin(d.assets)), 0)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridStyle(p)} />
        <XAxis dataKey="label" {...axisStyle(p)} minTickGap={12} />
        <YAxis {...axisStyle(p)} tickFormatter={(v: number) => money(v)} width={axisWidth([money(maxMoney)])} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: p.grid }} />
        <Legend {...legendStyle(p)} />
        <Line dataKey="assets" name={localize('Jami aktivlar')} stroke={seriesColor(p, 'revenue')} strokeWidth={2.5} dot={false} isAnimationActive={false} />
        <Line dataKey="equity" name={localize('Kapital')} stroke={seriesColor(p, 'profit')} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line dataKey="liabilities" name={localize('Jami majburiyatlar')} stroke={seriesColor(p, 'receivables')} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line dataKey="debt" name={localize('Kreditlar')} stroke={seriesColor(p, 'payables')} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

/** Aylanma kapital: debitorlik, zaxira, kreditorlik. */
export function WorkingCapitalChart({ rows }: { rows: BalanceMonth[] }) {
  useLanguageStore((state) => state.language)
  const p = useChartPalette()
  const { money } = useCurrency()
  if (!rows.length) return <EmptyNote />
  const data = rows.map((b) => ({ label: fmtMonth(b.month), ar: fin(b.receivables), inv: fin(b.inventory), ap: fin(b.payables), wc: fin(b.receivables) + fin(b.inventory) - fin(b.payables) }))
  const maxMoney = Math.max(...data.map((d) => Math.max(d.ar, d.inv, d.ap, d.wc)), 0)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...gridStyle(p)} />
        <XAxis dataKey="label" {...axisStyle(p)} minTickGap={12} />
        <YAxis {...axisStyle(p)} tickFormatter={(v: number) => money(v)} width={axisWidth([money(maxMoney)])} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: p.grid }} />
        <Legend {...legendStyle(p)} />
        <Line dataKey="ar" name={localize('Debitorlik')} stroke={seriesColor(p, 'receivables')} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line dataKey="inv" name={localize('Zaxira')} stroke={seriesColor(p, 'inventory')} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line dataKey="ap" name={localize('Kreditorlik')} stroke={seriesColor(p, 'payables')} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line dataKey="wc" name={localize('Sof aylanma (AR + Zaxira − AP)')} stroke={seriesColor(p, 'revenue')} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

interface CellProps { x?: number; y?: number; width?: number; height?: number; name?: string; index?: number }

const INK_DARK = '#1A1714'
/** Katak rangiga qarab o'qiladigan matn rangi (WCAG nisbiy yorug'lik: to'q yoki oq — qaysi kontrast yuqori). */
export function readableInk(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  return (l + 0.05) / 0.0593 >= 1.05 / (l + 0.05) ? INK_DARK : '#FFFFFF'
}

function TreemapCell({ x = 0, y = 0, width = 0, height = 0, name = '', index = 0, lookup, colors, gap, money }: CellProps & { lookup: Map<string, InventoryCategoryRow>; colors: string[]; gap: string; money: (v: number) => string }) {
  const row = lookup.get(name)
  const fill = colors[index % colors.length]
  const ink = readableInk(fill)
  const big = width > 110 && height > 56
  const mid = width > 70 && height > 30
  return (
    <g>
      <rect x={x} y={y} width={Math.max(0, width)} height={Math.max(0, height)} fill={fill} stroke={gap} strokeWidth={2} rx={8} />
      {mid && <text x={x + 10} y={y + 18} fill={ink} stroke="none" fontSize={11} fontWeight={600}>{localize(name)}</text>}
      {mid && row && <text x={x + 10} y={y + 33} fill={ink} stroke="none" fontSize={11}>{money(row.value)} · {fmtPct(row.share, 0)}</text>}
      {big && row && <text x={x + 10} y={y + 48} fill={ink} stroke="none" fontSize={10} fillOpacity={0.85}>{t('aylanish {days} kun · 90+: {idle}', { days: Math.round(row.turnoverDays), idle: money(row.idleValue) })}</text>}
    </g>
  )
}

/** Zaxira — tovar kategoriyasi bo'yicha treemap (qiymat, aylanish kuni, harakatsiz 90+). */
export function InventoryTreemap({ rows }: { rows: InventoryCategoryRow[] }) {
  useLanguageStore((state) => state.language)
  const p = useChartPalette()
  const { money } = useCurrency()
  const data = rows.filter((r) => r.value > 0).map((r) => ({ name: r.category, size: r.value }))
  if (!data.length) return <EmptyNote text="Zaxira ma'lumoti yo'q" />
  const lookup = new Map(rows.map((r) => [r.category, r]))
  return (
    <ResponsiveContainer width="100%" height="100%">
      <Treemap data={data} dataKey="size" aspectRatio={4 / 3} stroke={p.surface} isAnimationActive={false}
        content={<TreemapCell lookup={lookup} colors={p.series} gap={p.surface} money={money} />}>
        <Tooltip content={<ChartTooltip formatter={(v, n) => {
          const r = lookup.get(n)
          return r
            ? `${money(v)} · ${fmtPct(r.share)} · ${t('aylanish {days} kun · harakatsiz 90+: {idle} ({items} ta)', { days: Math.round(r.turnoverDays), idle: money(r.idleValue), items: r.idleItems })}`
            : money(v)
        }} />} />
      </Treemap>
    </ResponsiveContainer>
  )
}
