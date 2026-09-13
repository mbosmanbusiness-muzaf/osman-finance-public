import type { Palette } from '@/lib/palette'
import { t } from '@/i18n'

/** Recharts o'qlari uchun umumiy uslub; kategoriya yorliqlari (waterfall bosqichlari, guruhlar) tanlangan tilga tarjima qilinadi. */
export function axisStyle(p: Palette) {
  return {
    tick: { fill: p.muted, fontSize: 11 }, axisLine: false as const, tickLine: false as const, stroke: p.muted,
    tickFormatter: (value: unknown) => (typeof value === 'string' ? t(value) : String(value)),
  }
}

/**
 * Y o'qi kengligi eng uzun yozuv bo'yicha (ru "млрд", en "B" — uzunligi har xil).
 * Kiritma: o'qda ko'rinadigan namunaviy matnlar (masalan, `money(max)` va `money(0)`).
 */
export function axisWidth(labels: (string | number)[], min = 48, max = 104): number {
  const longest = labels.reduce<number>((n, l) => Math.max(n, String(l ?? '').length), 0)
  return Math.min(max, Math.max(min, Math.round(longest * 7.2) + 14))
}

/** Ingichka yaxlit gorizontal chiziqlar (hairline). */
export function gridStyle(p: Palette) {
  return { stroke: p.grid, vertical: false as const }
}

export const tooltipCursor = (p: Palette) => ({ fill: p.grid })

export const legendStyle = (p: Palette) => ({ wrapperStyle: { fontSize: 12, color: p.textSecondary }, iconType: 'circle' as const, iconSize: 8, formatter: (value: string) => t(value) })

/** Ssenariy uslublari (IBCS): fakt — to'ldirilgan, plan — punktir kontur, o'tgan yil — bo'g'iq. */
export const scenarioLine = (p: Palette, scenario: 'actual' | 'plan' | 'prior' | 'forecast') => ({
  stroke: p[scenario],
  strokeWidth: scenario === 'actual' ? 2.5 : 2,
  strokeDasharray: scenario === 'plan' ? '5 4' : scenario === 'forecast' ? '2 3' : undefined,
  dot: false as const,
  isAnimationActive: false as const,
})
