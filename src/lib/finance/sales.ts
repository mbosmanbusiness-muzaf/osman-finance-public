import type { SaleTx, BudgetRow, MonthKey } from '@/types'
import { fin, safeDiv } from '@/lib/utils'

/** Savdo (tranzaksiya) ko'rsatkichlari: savdo, yalpi foyda, marja, cheklar soni, sotilgan dona, o'rtacha chek. */
export interface SalesStats {
  revenue: number
  cogs: number
  grossProfit: number
  grossMargin: number // %
  receipts: number // cheklar soni (tranzaksiyalar)
  units: number // sotilgan tovar soni
  avgCheck: number // o'rtacha chek = savdo / cheklar soni
  avgUnitsPerCheck: number
  avgPrice: number // savdo / dona
  plan: number // mahsulot sotuv plani (scope='product') yig'indisi
}

export function salesStats(sales: SaleTx[], months: MonthKey[], budget: BudgetRow[] = []): SalesStats {
  const set = new Set(months)
  let revenue = 0, cogs = 0, receipts = 0, units = 0, plan = 0
  for (const s of sales) {
    if (!set.has(s.month)) continue
    revenue += fin(s.revenue); cogs += fin(s.cogs); units += fin(s.qty); receipts += 1
  }
  for (const b of budget) if (b.scope === 'product' && set.has(b.month)) plan += fin(b.plan)
  const grossProfit = revenue - cogs
  return {
    revenue, cogs, grossProfit, grossMargin: safeDiv(grossProfit, revenue) * 100, receipts, units,
    avgCheck: safeDiv(revenue, receipts), avgUnitsPerCheck: safeDiv(units, receipts), avgPrice: safeDiv(revenue, units), plan,
  }
}

export interface SalesMonthPoint extends SalesStats { month: MonthKey }

export function salesMonthlySeries(sales: SaleTx[], months: MonthKey[], budget: BudgetRow[] = []): SalesMonthPoint[] {
  return months.slice().sort().map((m) => ({ month: m, ...salesStats(sales, [m], budget) }))
}
