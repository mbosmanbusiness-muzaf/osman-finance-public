import type { PnLRow, SaleTx, MonthKey } from '@/types'
import { safeDiv, fin } from '@/lib/utils'

export interface BepBase {
  units: number
  revenue: number
  price: number // o'rtacha narx (dona)
  variableCosts: number
  varCostPerUnit: number
  fixedCosts: number
}

export interface BepResult extends BepBase {
  contributionPerUnit: number
  contributionMarginRatio: number // 0..1
  bepUnits: number
  bepRevenue: number
  marginOfSafety: number // summa
  marginOfSafetyPct: number
  profit: number
}

/** O'zgaruvchan xarajat: COGS + Logistika (OPEX) + Marketing (yarim o'zgaruvchan sifatida). Doimiy: qolgan OPEX + amortizatsiya + foizlar. */
export const VARIABLE_OPEX_ITEMS = ['Logistika', 'Marketing']

export function bepBase(pnl: PnLRow[], sales: SaleTx[], months: MonthKey[]): BepBase {
  const set = new Set(months)
  let revenue = 0, cogs = 0, varOpex = 0, fixed = 0
  for (const r of pnl) {
    if (!set.has(r.month)) continue
    const a = fin(r.amount)
    if (r.group === 'revenue') revenue += a
    else if (r.group === 'cogs') cogs += a
    else if (r.group === 'opex') { if (VARIABLE_OPEX_ITEMS.includes(r.item)) varOpex += a; else fixed += a }
    else if (r.group === 'depreciation' || r.group === 'interest') fixed += a
  }
  let units = 0
  for (const s of sales) if (set.has(s.month)) units += fin(s.qty)
  const price = safeDiv(revenue, units)
  const variableCosts = cogs + varOpex
  return { units, revenue, price, variableCosts, varCostPerUnit: safeDiv(variableCosts, units), fixedCosts: fixed }
}

export function bepCompute(b: BepBase): BepResult {
  const contributionPerUnit = b.price - b.varCostPerUnit
  const contributionMarginRatio = safeDiv(b.revenue - b.variableCosts, b.revenue)
  const bepUnits = contributionPerUnit > 0 ? b.fixedCosts / contributionPerUnit : 0
  const bepRevenue = contributionMarginRatio > 0 ? b.fixedCosts / contributionMarginRatio : 0
  const marginOfSafety = b.revenue - bepRevenue
  return {
    ...b, contributionPerUnit, contributionMarginRatio, bepUnits, bepRevenue, marginOfSafety,
    marginOfSafetyPct: safeDiv(marginOfSafety, b.revenue) * 100, profit: b.revenue - b.variableCosts - b.fixedCosts,
  }
}

export interface SensitivityDeltas { price: number; volume: number; varCost: number; fixedCost: number } // % (−20..+20)

export function applySensitivity(base: BepBase, d: SensitivityDeltas): BepResult {
  const price = base.price * (1 + fin(d.price) / 100)
  const units = base.units * (1 + fin(d.volume) / 100)
  const varCostPerUnit = base.varCostPerUnit * (1 + fin(d.varCost) / 100)
  const fixedCosts = base.fixedCosts * (1 + fin(d.fixedCost) / 100)
  return bepCompute({ units, revenue: units * price, price, variableCosts: units * varCostPerUnit, varCostPerUnit, fixedCosts })
}

export interface TornadoRow { factor: string; key: keyof SensitivityDeltas; low: number; high: number; swing: number }

/** Har omil ±pct o'zgarganda foydaning diapazoni (tornado). */
export function tornado(base: BepBase, pct = 20): TornadoRow[] {
  const zero: SensitivityDeltas = { price: 0, volume: 0, varCost: 0, fixedCost: 0 }
  const factors: { key: keyof SensitivityDeltas; factor: string }[] = [
    { key: 'price', factor: 'Narx' }, { key: 'volume', factor: 'Hajm' }, { key: 'varCost', factor: "O'zgaruvchan xarajat" }, { key: 'fixedCost', factor: 'Doimiy xarajat' },
  ]
  return factors.map(({ key, factor }) => {
    const lo = applySensitivity(base, { ...zero, [key]: -pct }).profit
    const hi = applySensitivity(base, { ...zero, [key]: pct }).profit
    return { factor, key, low: Math.min(lo, hi), high: Math.max(lo, hi), swing: Math.abs(hi - lo) }
  }).sort((a, b) => b.swing - a.swing)
}

/** BEP grafigi: hajm bo'yicha tushum va umumiy xarajat chiziqlari. */
export function bepChartData(r: BepResult, points = 24) {
  const maxUnits = Math.max(r.units, r.bepUnits) * 1.4 || 100
  const out: { units: number; revenue: number; totalCost: number; fixedCost: number }[] = []
  for (let i = 0; i <= points; i++) {
    const u = (maxUnits * i) / points
    out.push({ units: u, revenue: u * r.price, totalCost: r.fixedCosts + u * r.varCostPerUnit, fixedCost: r.fixedCosts })
  }
  return out
}
