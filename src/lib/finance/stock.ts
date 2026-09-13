import { safeDiv } from '@/lib/utils'
import type { InventoryProductRow } from './balance'
import type { CoverageRow } from './insights'

export const STOCK_AGE_BUCKETS = [
  { key: '0–30', max: 30 }, { key: '31–60', max: 60 }, { key: '61–90', max: 90 }, { key: '91–180', max: 180 }, { key: '180+', max: Infinity },
] as const
export type StockAgeKey = (typeof STOCK_AGE_BUCKETS)[number]['key']
export interface StockAgeRow { category: string; total: number; buckets: Record<StockAgeKey, number> }

/** Zaxira yoshi (oxirgi harakatdan beri kun): kategoriya × yosh oralig'i, qiymat bo'yicha. */
export function stockAgeByCategory(rows: InventoryProductRow[]): StockAgeRow[] {
  const map = new Map<string, StockAgeRow>()
  for (const r of rows) {
    const b = STOCK_AGE_BUCKETS.find((x) => r.idleDays <= x.max) ?? STOCK_AGE_BUCKETS[STOCK_AGE_BUCKETS.length - 1]
    const row = map.get(r.category) ?? { category: r.category, total: 0, buckets: { '0–30': 0, '31–60': 0, '61–90': 0, '91–180': 0, '180+': 0 } }
    row.buckets[b.key] += r.value
    row.total += r.value
    map.set(r.category, row)
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

export interface CoverageBalanceRow { category: string; deficit: number; excess: number; deficitCount: number; excessCount: number }

/**
 * Kamomad va ortiqcha zaxira (kategoriya bo'yicha): me'yoriy ta'minlanganlik [minDays, maxDays] dan tashqaridagi qiymat (tannarxda).
 * Sotuvi bo'lmagan SKU zaxirasi to'liq ortiqcha hisoblanadi.
 */
export function coverageBalance(rows: CoverageRow[], minDays: number, maxDays: number): CoverageBalanceRow[] {
  const map = new Map<string, CoverageBalanceRow>()
  for (const r of rows) {
    const deficit = r.coverageDays !== null && r.coverageDays < minDays ? (minDays - r.coverageDays) * r.dailyUnits * r.unitCost : 0
    const excess = r.coverageDays === null ? r.value : r.coverageDays > maxDays ? (r.coverageDays - maxDays) * r.dailyUnits * r.unitCost : 0
    const row = map.get(r.category) ?? { category: r.category, deficit: 0, excess: 0, deficitCount: 0, excessCount: 0 }
    if (deficit > 0) { row.deficit += deficit; row.deficitCount++ }
    if (excess > 0) { row.excess += excess; row.excessCount++ }
    map.set(r.category, row)
  }
  return Array.from(map.values()).sort((a, b) => b.deficit + b.excess - (a.deficit + a.excess))
}

/** Umumiy ta'minlanganlik (kun): zaxira qiymati / oxirgi davr o'rtacha kunlik tannarxi. */
export function totalCoverageDays(rows: CoverageRow[]): number {
  const value = rows.reduce((a, r) => a + r.value, 0)
  const dailyCost = rows.reduce((a, r) => a + r.dailyUnits * r.unitCost, 0)
  return safeDiv(value, dailyCost)
}
