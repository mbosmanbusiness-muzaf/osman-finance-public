import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { t, translate as localize, useLanguageStore } from '@/i18n'
import { ChartTooltip, axisStyle, gridStyle, legendStyle } from '@/components/shared'
import { useChartPalette, useCurrency } from '@/hooks'
import { fmtDate, fmtMonth } from '@/lib/format'
import type { CashPoint, Granularity } from '@/lib/finance'
import { EmptyNote } from './common'

interface Props {
  data: CashPoint[]
  granularity: Granularity
  minCash: number
}

/** Tooltip sarlavhasi: kun → to'liq sana, hafta → dushanba sanasi, oy → to'liq oy nomi. */
function pointTitle(key: string, granularity: Granularity): string {
  if (granularity === 'month') return fmtMonth(key, true)
  if (granularity === 'week') return t('{date} haftasi', { date: fmtDate(key.replace(/^W:/, '')) })
  return fmtDate(key)
}

/** Pul qoldig'i (area) + plan qoldiq (punktir) + minimal xavfsiz qoldiq (qizil punktir). */
export function CashBalanceChart({ data, granularity, minCash }: Props) {
  useLanguageStore((state) => state.language)
  const p = useChartPalette()
  const { money } = useCurrency()
  if (!data.length) return <EmptyNote />
  const rows = data.map((d) => ({ ...d, label: granularity === 'month' ? fmtMonth(d.key) : d.label }))
  const few = rows.length <= 3
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="cf-balance-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.gold} stopOpacity={0.35} />
            <stop offset="100%" stopColor={p.gold} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridStyle(p)} />
        <XAxis dataKey="label" {...axisStyle(p)} interval="preserveStartEnd" minTickGap={28} />
        <YAxis {...axisStyle(p)} tickFormatter={(v: number) => money(v)} width={64} />
        <Tooltip
          content={<ChartTooltip labelFormatter={(_l, payload) => pointTitle(String((payload?.[0]?.payload as { key?: string } | undefined)?.key ?? ''), granularity)} />}
          cursor={{ fill: p.grid, stroke: p.muted, strokeDasharray: '3 3' }}
        />
        <Legend {...legendStyle(p)} />
        <Area type="monotone" dataKey="balance" name={localize("Pul qoldig'i")} stroke={p.gold} strokeWidth={2} fill="url(#cf-balance-grad)" dot={few} activeDot={{ r: 4 }} isAnimationActive={false} />
        <Line type="monotone" dataKey="planBalance" name={localize('Plan qoldiq')} stroke={p.info} strokeWidth={1.5} strokeDasharray="5 4" dot={few} isAnimationActive={false} />
        <ReferenceLine
          y={minCash}
          stroke={p.negative}
          strokeDasharray="6 4"
          ifOverflow="extendDomain"
          label={{ value: localize('Minimal xavfsiz qoldiq'), position: 'insideTopLeft', fill: p.negative, fontSize: 11 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
