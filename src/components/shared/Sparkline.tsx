import { useLanguageStore } from "@/i18n"
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts'
import { useChartPalette } from '@/hooks'
import { fin } from '@/lib/utils'

interface SparklineProps {
  data: number[]
  color?: string
  height?: number
  /** kamayish yaxshi bo'lsa (xarajat) — rang teskari */
  invert?: boolean
  neutral?: boolean
}

/** Kichik trend chizig'i (KPI kartalarda): faqat chiziq, to'ldirishsiz — katta raqam bilan raqobatlashmasligi uchun. */
export function Sparkline({ data, color, height = 36, invert = false, neutral = false }: SparklineProps) {
  useLanguageStore((state) => state.language)
  const p = useChartPalette()
  const pts = (data ?? []).map((v, i) => ({ i, v: fin(v) }))
  if (pts.length < 2) return <div style={{ height }} />
  const first = pts[0].v, last = pts[pts.length - 1].v
  const up = last >= first
  const stroke = color ?? (neutral ? p.muted : (up !== invert ? p.positive : p.negative))
  return (
    <div style={{ height, width: '100%' }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line type="monotone" dataKey="v" stroke={stroke} strokeWidth={1.5} isAnimationActive={false} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
