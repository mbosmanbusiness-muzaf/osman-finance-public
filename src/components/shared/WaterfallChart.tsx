import { t, useLanguageStore } from '@/i18n'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useChartPalette, useCurrency } from '@/hooks'
import { axisStyle, axisWidth, gridStyle } from './chart-utils'
import { ChartTooltip } from './ChartTooltip'

export interface WaterfallStepLike { name: string; value: number; type: 'total' | 'up' | 'down' }

/** Qaysi ustunlar imzolanadi: jamilar doim, qolganidan eng yiriklari — qo'shni imzolanmagan bo'lsa (yorliqlar ustma-ust tushmasligi uchun). */
function labelled(steps: WaterfallStepLike[], dense: boolean): boolean[] {
  const marked = steps.map((s) => s.type === 'total')
  if (!dense) return steps.map(() => true)
  const candidates = steps.map((s, i) => ({ i, abs: Math.abs(s.value), total: s.type === 'total' })).filter((c) => !c.total).sort((a, b) => b.abs - a.abs)
  let added = 0
  for (const c of candidates) {
    if (added >= 3) break
    if (marked[c.i] || marked[c.i - 1] || marked[c.i + 1]) continue
    marked[c.i] = true
    added += 1
  }
  return marked
}

/**
 * Suzuvchi ustunlar (floating bars) ko'rinishidagi waterfall.
 * Bosqich ko'p bo'lsa yorliqlar siyraklashtiriladi (AUDIT C3) — barcha qiymatlar podskazkada ko'rinadi.
 */
export function WaterfallChart({ steps, height = 280, labels = true }: { steps: WaterfallStepLike[]; height?: number; labels?: boolean }) {
  useLanguageStore((state) => state.language)
  const p = useChartPalette()
  const { money } = useCurrency()
  const dense = steps.length > 7
  const marked = labelled(steps, dense)
  let running = 0
  const data = steps.map((s, i) => {
    if (s.type === 'total') {
      running = s.value
      return { name: s.name, range: [Math.min(0, s.value), Math.max(0, s.value)], value: s.value, type: s.type, label: marked[i] ? money(s.value) : '' }
    }
    const start = running; running += s.value
    return { name: s.name, range: [Math.min(start, running), Math.max(start, running)], value: s.value, type: s.type, label: marked[i] ? money(s.value, { sign: true }) : '' }
  })
  const color = (kind: string) => (kind === 'total' ? p.actual : kind === 'up' ? p.positive : p.negative)
  const maxAbs = Math.max(...data.map((d) => Math.max(Math.abs(d.range[0]), Math.abs(d.range[1]))), 0)
  const short = (value: unknown) => { const s = t(String(value)); return s.length > 14 ? `${s.slice(0, 13)}…` : s }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 18, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid {...gridStyle(p)} />
        <XAxis
          dataKey="name" {...axisStyle(p)} interval={0} tick={{ fill: p.muted, fontSize: 10 }}
          angle={dense ? -30 : 0} textAnchor={dense ? 'end' : 'middle'} height={dense ? 56 : 30} tickFormatter={short}
        />
        <YAxis {...axisStyle(p)} tickFormatter={(v) => money(v)} width={axisWidth([money(maxAbs)])} />
        <Tooltip cursor={{ fill: p.grid }} content={<ChartTooltip formatter={(_v, _n, it) => money(Number((it.payload as { value: number })?.value ?? 0), { sign: true })} />} />
        <Bar dataKey="range" radius={[3, 3, 3, 3]} minPointSize={2} isAnimationActive={false}>
          {data.map((d, i) => <Cell key={`${d.name}-${i}`} fill={color(d.type)} />)}
          {labels && <LabelList dataKey="label" position="top" style={{ fill: p.textSecondary, fontSize: 10 }} />}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
