import { translate as localize, useLanguageStore } from "@/i18n"
import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTooltip, axisStyle, gridStyle, legendStyle } from '@/components/shared'
import { useChartPalette, useCurrency } from '@/hooks'
import { bepChartData, type BepResult } from '@/lib/finance/bep'
import { FACTORS, fmtSignedPct, fmtUnits, type CurvePoint, type TornadoBar } from './helpers'

/** Tushum × umumiy xarajat chiziqlari hajm bo'yicha; BEP nuqtasi va joriy hajm belgilangan. */
export function BepChart({ r }: { r: BepResult }) {
  useLanguageStore((state) => state.language)
  const p = useChartPalette()
  const { money } = useCurrency()
  const data = useMemo(() => bepChartData(r, 24), [r])
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 18, right: 16, left: 4, bottom: 0 }}>
        <CartesianGrid {...gridStyle(p)} />
        <XAxis type="number" dataKey="units" domain={[0, 'dataMax']} {...axisStyle(p)} tickFormatter={(v: number) => fmtUnits(v)} />
        <YAxis {...axisStyle(p)} tickFormatter={(v: number) => money(v)} width={64} />
        <Tooltip content={<ChartTooltip labelFormatter={(l) => `Hajm: ${fmtUnits(Number(l))} dona`} />} cursor={{ fill: p.grid, stroke: p.grid }} />
        <Legend {...legendStyle(p)} />
        <Line type="linear" dataKey="revenue" name={localize("Tushum")} stroke={p.gold} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="linear" dataKey="totalCost" name={localize("Umumiy xarajat")} stroke={p.negative} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="linear" dataKey="fixedCost" name={localize("Doimiy xarajat")} stroke={p.muted} strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        <ReferenceLine x={r.bepUnits} stroke={p.warning} strokeDasharray="3 3" label={{ value: localize(`BEP ${fmtUnits(r.bepUnits)}`), position: 'insideTopLeft', fill: p.warning, fontSize: 11 }} />
        <ReferenceLine x={r.units} stroke={p.info} strokeDasharray="3 3" label={{ value: localize(`Joriy hajm ${fmtUnits(r.units)}`), position: 'insideBottomRight', fill: p.info, fontSize: 11 }} />
        <ReferenceDot x={r.bepUnits} y={r.bepRevenue} r={5} fill={p.warning} stroke={p.surface} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  )
}

/** Tornado: har omil ±20% o'zgarganda foydaning pivot foydadan og'ishi. */
export function TornadoChart({ rows }: { rows: TornadoBar[] }) {
  useLanguageStore((state) => state.language)
  const p = useChartPalette()
  const { money } = useCurrency()
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical" stackOffset="sign" margin={{ top: 8, right: 16, left: 4, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid {...gridStyle(p)} vertical horizontal={false} />
        <XAxis type="number" {...axisStyle(p)} tickFormatter={(v: number) => money(v)} />
        <YAxis type="category" dataKey="factor" width={128} {...axisStyle(p)} />
        <Tooltip
          content={<ChartTooltip formatter={(v, _n, it) => {
            const row = it.payload as TornadoBar | undefined
            const dir = it.dataKey === 'lowDelta' ? row?.lowPct : row?.highPct
            return `${money(v, { sign: true })}${dir ? ` (${dir})` : ''}`
          }} />}
          cursor={{ fill: p.grid }}
        />
        <Legend {...legendStyle(p)} />
        <ReferenceLine x={0} stroke={p.muted} />
        <Bar dataKey="lowDelta" name={localize("Salbiy holat")} stackId="t" fill={p.negative} isAnimationActive={false} radius={[3, 0, 0, 3]} />
        <Bar dataKey="highDelta" name={localize("Ijobiy holat")} stackId="t" fill={p.positive} isAnimationActive={false} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Foyda egri chiziqlari: har omil −20…+20% (boshqalari o'zgarmas). */
export function SensitivityCurvesChart({ data }: { data: CurvePoint[] }) {
  useLanguageStore((state) => state.language)
  const p = useChartPalette()
  const { money } = useCurrency()
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
        <CartesianGrid {...gridStyle(p)} />
        <XAxis dataKey="delta" type="number" domain={[-20, 20]} ticks={[-20, -10, 0, 10, 20]} {...axisStyle(p)} tickFormatter={(v: number) => fmtSignedPct(v)} />
        <YAxis {...axisStyle(p)} tickFormatter={(v: number) => money(v)} width={64} />
        <Tooltip content={<ChartTooltip labelFormatter={(l) => `O'zgarish: ${fmtSignedPct(Number(l))}`} />} cursor={{ fill: p.grid, stroke: p.grid }} />
        <Legend {...legendStyle(p)} />
        <ReferenceLine y={0} stroke={p.negative} strokeDasharray="3 3" label={{ value: localize('Zarar chegarasi'), position: 'insideBottomRight', fill: p.negative, fontSize: 11 }} />
        <ReferenceLine x={0} stroke={p.muted} strokeDasharray="3 3" label={{ value: localize('Baza'), position: 'insideTop', fill: p.muted, fontSize: 11 }} />
        {(FACTORS.map((f, i) => (
          <Line key={f.key} type="monotone" dataKey={f.key} name={localize(f.label)} stroke={p.series[i]} strokeWidth={f.key === 'price' ? 2.5 : 1.75} dot={false} isAnimationActive={false} />
        )))}
      </LineChart>
    </ResponsiveContainer>
  )
}
