import { useMemo } from 'react'
import { useDataset, usePeriod } from '@/hooks'
import {
  cashSeries, cfMonthlySeries, cfTotals, cfWaterfall,
  type CashPoint, type CfMonthPoint, type CfTotals, type CfWaterfallStep, type Granularity,
} from '@/lib/finance'
import { fin, pctChange, sum } from '@/lib/utils'
import type { CashflowMonth } from '@/types'

export type SparkKey = 'closing' | 'ocf' | 'icf' | 'fcf' | 'freeCashFlow' | 'netChange'

export interface CashflowModel {
  totals: CfTotals
  prevTotals: CfTotals
  /** oldingi davr mavjudmi (24m rejimida yo'q) */
  hasPrev: boolean
  /** tanlangan davr oylari bo'yicha seriya */
  series: CfMonthPoint[]
  waterfall: CfWaterfallStep[]
  minCash: number
  /** davr oxirgi oyining plan qoldig'i (byudjet bo'lmasa null) */
  planClosing: number | null
  /** davr bo'yicha OCF plani yig'indisi (byudjet bo'lmasa null) */
  planOcf: number | null
  /** joriy davrgacha oxirgi 12 oy bo'yicha sparkline seriyalari */
  spark: Record<SparkKey, number[]>
  /** oy → cashflow qatori (jadval va dialog uchun) */
  byMonth: Map<string, CashflowMonth>
}

/**
 * Oqimlar taqqoslamasi: ishora bir xil va |Δ| ≤ 200% bo'lsa — %, aks holda absolyut farq (pul).
 * Nolga yaqin yoki ishorasi almashgan bazada % ("−559%") ma'nosiz.
 */
export function flowDelta(curr: number, prev: number, hasPrev: boolean): { value: number; isAbs: boolean } | null {
  if (!hasPrev) return null
  const c = fin(curr), p = fin(prev)
  const pct = p !== 0 && Math.sign(c) === Math.sign(p) ? pctChange(c, p) : null
  if (pct !== null && Math.abs(pct) <= 200) return { value: pct, isAbs: false }
  return { value: c - p, isAbs: true }
}

export function useCashflowModel(): CashflowModel {
  const { data, allMonths } = useDataset()
  const { months, prevMonths, asOf } = usePeriod()

  return useMemo(() => {
    const totals = cfTotals(data.cashflow, months)
    const prevTotals = cfTotals(data.cashflow, prevMonths)
    const series = cfMonthlySeries(data.cashflow, data.budget, months)
    const waterfall = cfWaterfall(totals)
    const minCash = fin(data.settings.minCashBalance)

    const lastPlanClosing = fin(series[series.length - 1]?.planClosing)
    const planClosing = data.budget.some((b) => b.scope === 'cash' && b.key === 'closingCash' && b.month === months[months.length - 1]) ? lastPlanClosing : null
    const planOcfSum = sum(series.map((s) => s.planOcf))
    const planOcf = months.length && months.every((month) => data.budget.some((b) => b.scope === 'cash' && b.key === 'ocf' && b.month === month)) ? planOcfSum : null

    const last12 = cfMonthlySeries(data.cashflow, data.budget, allMonths.filter((m) => m <= asOf).slice(-12))
    const spark: Record<SparkKey, number[]> = {
      closing: last12.map((s) => s.closing),
      ocf: last12.map((s) => s.ocf),
      icf: last12.map((s) => s.icf),
      fcf: last12.map((s) => s.fcf),
      freeCashFlow: last12.map((s) => s.freeCashFlow),
      netChange: last12.map((s) => s.netChange),
    }

    const byMonth = new Map<string, CashflowMonth>()
    for (const c of data.cashflow) byMonth.set(c.month, c)

    return { totals, prevTotals, hasPrev: prevMonths.length > 0, series, waterfall, minCash, planClosing, planOcf, spark, byMonth }
  }, [data, months, prevMonths, allMonths, asOf])
}

/** Kunlik/haftalik/oylik pul qoldig'i seriyasi (alohida memo — granularity o'zgarganda qayta hisoblanadi). */
export function useCashSeries(granularity: Granularity): CashPoint[] {
  const { data } = useDataset()
  const { months } = usePeriod()
  return useMemo(() => cashSeries(data.cashflow, data.budget, months, granularity), [data, months, granularity])
}
