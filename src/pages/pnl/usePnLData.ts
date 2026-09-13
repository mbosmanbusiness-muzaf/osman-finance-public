import { useMemo } from 'react'
import { useDataset, usePeriod } from '@/hooks'
import {
  pnlTotals, pnlPlanTotals, pnlMonthlySeries, pnlByCategory, pnlWaterfall, salesStats, salesMonthlySeries,
  type PnLTotals, type PnLMonthPoint, type CategoryProfit, type WaterfallStep, type SalesStats, type SalesMonthPoint,
} from '@/lib/finance'
import { fin, safeDiv } from '@/lib/utils'
import type { KpiTarget } from '@/types'

export interface OpexItem { name: string; value: number; share: number }

export interface PnLPageData {
  /** tanlangan davr jami (fakt) */
  totals: PnLTotals
  /** o'tgan davr jami — oldingi oylar bo'lmasa null */
  prevTotals: PnLTotals | null
  /** byudjet (plan) jami */
  planTotals: PnLTotals
  /** tanlangan oylarda plan qatorlari bormi */
  hasPlan: boolean
  /** joriy davrgacha oxirgi 12 oy — sparkline va dinamika grafigi */
  last12: PnLMonthPoint[]
  /** tanlangan oylar — oylik jadval */
  monthly: PnLMonthPoint[]
  categories: CategoryProfit[]
  opexItems: OpexItem[]
  opexTotal: number
  waterfall: WaterfallStep[]
  targets: Record<string, KpiTarget>
  /** savdo ko'rsatkichlari: cheklar, dona, o'rtacha chek */
  sales: SalesStats
  salesPrev: SalesStats | null
  salesLast12: SalesMonthPoint[]
}

/** P&L sahifasining barcha hisob-kitoblari — davr o'zgarganda bir marta qayta hisoblanadi. */
export function usePnLData(): PnLPageData {
  const { data, allMonths } = useDataset()
  const { months, prevMonths, asOf, comparisonTotals } = usePeriod()

  return useMemo<PnLPageData>(() => {
    const totals = pnlTotals(data.pnl, months)
    const prevTotals = comparisonTotals
    const planTotals = pnlPlanTotals(data.budget, months)
    const hasPlan = planTotals.revenue > 0

    const upTo = allMonths.filter((m) => m <= asOf).slice(-12)
    const last12 = pnlMonthlySeries(data.pnl, data.budget, upTo)
    const monthly = pnlMonthlySeries(data.pnl, data.budget, months)
    const categories = pnlByCategory(data.pnl, months)

    // OPEX tarkibi — modda (item) bo'yicha, bitta o'tishda
    const inRange = new Set(months)
    const opexMap = new Map<string, number>()
    for (const r of data.pnl) {
      if (r.group !== 'opex' || !inRange.has(r.month)) continue
      opexMap.set(r.item, (opexMap.get(r.item) ?? 0) + fin(r.amount))
    }
    let opexTotal = 0
    for (const v of opexMap.values()) opexTotal += v
    const opexItems: OpexItem[] = Array.from(opexMap, ([name, value]) => ({ name, value, share: safeDiv(value, opexTotal) * 100 }))
      .filter((i) => i.value > 0)
      .sort((a, b) => b.value - a.value)

    const targets: Record<string, KpiTarget> = {}
    for (const t of data.kpiTargets) targets[t.key] = t

    const sales = salesStats(data.sales, months, data.budget)
    const salesPrev = prevMonths.length ? salesStats(data.sales, prevMonths, data.budget) : null
    const salesLast12 = salesMonthlySeries(data.sales, upTo, data.budget)

    return { totals, prevTotals, planTotals, hasPlan, last12, monthly, categories, opexItems, opexTotal, waterfall: pnlWaterfall(totals), targets, sales, salesPrev, salesLast12 }
  }, [data, allMonths, months, prevMonths, asOf, comparisonTotals])
}

/** Maqsadga nisbatan holat: ≥ maqsad → good, ≥ 90% → warn, aks holda bad. */
export function statusVsTarget(value: number, target: KpiTarget | undefined): 'good' | 'warn' | 'bad' | null {
  if (!target) return null
  const v = fin(value), t = fin(target.target)
  if (target.lowerIsBetter) return v <= t ? 'good' : v <= t * 1.1 ? 'warn' : 'bad'
  return v >= t ? 'good' : v >= t * 0.9 ? 'warn' : 'bad'
}
