import { translate as localize, useLanguageStore } from "@/i18n"
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useChartPalette, useCurrency } from '@/hooks'
import { fmtMonth } from '@/lib/format'
import { axisStyle, gridStyle, legendStyle } from './chart-utils'
import { ChartTooltip } from './ChartTooltip'

export interface TrendPoint { month: string; fact: number; plan?: number }

interface TrendModalProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  subtitle?: string
  data: TrendPoint[]
  /** qiymat formatlash (default pul) */
  format?: (v: number) => string
}

/** Modda/ko'rsatkichning oylik trendi (modal). */
export function TrendModal({ open, onOpenChange, title, subtitle, data, format }: TrendModalProps) {
  useLanguageStore((state) => state.language)
  const p = useChartPalette()
  const { money } = useCurrency()
  const fmt = format ?? ((v: number) => money(v))
  const hasPlan = data.some((d) => d.plan !== undefined)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{localize(title)}</DialogTitle>
          <DialogDescription>{localize(subtitle ?? 'Oylik trend: fakt (ustun) va plan (chiziq)')}</DialogDescription>
        </DialogHeader>
        <div style={{ height: 380 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.map((d) => ({ ...d, label: fmtMonth(d.month) }))} margin={{ top: 10, right: 10, left: 8, bottom: 0 }}>
              <CartesianGrid {...gridStyle(p)} />
              <XAxis dataKey="label" {...axisStyle(p)} />
              <YAxis {...axisStyle(p)} tickFormatter={(v) => fmt(v)} width={70} />
              <Tooltip content={<ChartTooltip formatter={(v) => fmt(v)} />} cursor={{ fill: p.grid }} />
              <Legend {...legendStyle(p)} />
              <Bar dataKey="fact" name={localize("Fakt")} fill={p.gold} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              {(hasPlan && <Line dataKey="plan" name={localize("Plan")} stroke={p.info} strokeWidth={2} dot={false} isAnimationActive={false} />)}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </DialogContent>
    </Dialog>
  )
}
