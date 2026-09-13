import { translate as localize, useLanguageStore } from "@/i18n"
import type { ReactNode } from 'react'
import { useChartPalette, useCurrency } from '@/hooks'
import { fin } from '@/lib/utils'

interface Item { name?: string; value?: number | string | Array<number | string>; color?: string; dataKey?: string | number; payload?: Record<string, unknown> }

export interface ChartTooltipProps {
  active?: boolean
  payload?: Item[]
  label?: string | number
  /** qiymat formatlash (default — pul, joriy valyuta) */
  formatter?: (value: number, name: string, item: Item) => string
  labelFormatter?: (label: string | number, payload?: Item[]) => ReactNode
  /** ko'rsatilmaydigan seriyalar */
  hide?: string[]
}

/** Barcha grafiklar uchun yagona tooltip (tema va valyutaga mos). */
export function ChartTooltip({ active, payload, label, formatter, labelFormatter, hide = [] }: ChartTooltipProps) {
  useLanguageStore((state) => state.language)
  const p = useChartPalette()
  const { money } = useCurrency()
  if (!active || !payload?.length) return null
  // qiymati yo'q seriya (masalan, prognoz oyida "fakt") tooltipda "0" bo'lib chiqmasin
  const items = payload.filter((it) => !hide.includes(String(it.dataKey ?? it.name)) && it.value !== undefined && it.value !== null)
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 shadow-float text-xs min-w-[150px] dark:bg-elevated">
      {(label !== undefined && <div className="mb-1.5 font-medium text-txt-primary">{localize(labelFormatter ? labelFormatter(label, payload) : String(label))}</div>)}
      <div className="space-y-1">
        {(items.map((it, i) => {
          const raw = Array.isArray(it.value) ? fin(it.value[1]) - fin(it.value[0]) : fin(it.value)
          const name = String(it.name ?? it.dataKey ?? '')
          const text = formatter ? formatter(raw, name, it) : money(raw)
          return (
            <div key={i} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-txt-secondary">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: it.color ?? p.gold }} />
                {localize(name)}
              </span>
              <span className="num font-medium text-txt-primary">{localize(text)}</span>
            </div>
          )
        }))}
      </div>
    </div>
  )
}
