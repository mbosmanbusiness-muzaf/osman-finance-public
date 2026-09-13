import type { BepBase, BepResult, SensitivityDeltas, TornadoRow } from '@/lib/finance/bep'
import { applySensitivity, bepBase, bepCompute, tornado, VARIABLE_OPEX_ITEMS } from '@/lib/finance/bep'
import { pnlPlanTotals } from '@/lib/finance/pnl'
import type { BudgetRow, Dataset, MonthKey } from '@/types'
import { fin, safeDiv, pctChange } from '@/lib/utils'
import { fmtCompactNum } from '@/lib/format'

export type FactorKey = keyof SensitivityDeltas

export interface FactorDef {
  key: FactorKey
  label: string
  short: string
  /** xarajat omili: o'sishi foydaga salbiy */
  isCost: boolean
}

/** 4 sensitivity omili (slider tartibi). */
export const FACTORS: FactorDef[] = [
  { key: 'price', label: 'Narx', short: 'Narx', isCost: false },
  { key: 'volume', label: 'Hajm (sotuv soni)', short: 'Hajm', isCost: false },
  { key: 'varCost', label: "O'zgaruvchan xarajat", short: "O'zg. xar.", isCost: true },
  { key: 'fixedCost', label: 'Doimiy xarajat', short: 'Doimiy xar.', isCost: true },
]

export const ZERO_DELTAS: SensitivityDeltas = { price: 0, volume: 0, varCost: 0, fixedCost: 0 }
export const SLIDER_MIN = -20
export const SLIDER_MAX = 20
/** Jadval (ssenariy gridi) qadamlari. */
export const GRID_STEPS = [-20, -10, 0, 10, 20]
/** Egri chiziqlar (sensitivity grafigi) qadamlari. */
export const CURVE_STEPS = [-20, -15, -10, -5, 0, 5, 10, 15, 20]

export const isActive = (d: SensitivityDeltas): boolean => FACTORS.some((f) => fin(d[f.key]) !== 0)

/** BEP hisoblanadimi: hajm > 0 va contribution margin > 0. */
export const isComputable = (r: BepResult): boolean =>
  r.units > 0 && r.contributionPerUnit > 0 && r.contributionMarginRatio > 0 && r.bepUnits > 0 && r.bepRevenue > 0

export const BEP_NOT_COMPUTABLE = "BEP hisoblanmaydi: contribution margin ≤ 0 (narx o'zgaruvchan xarajatdan past)"

/** Dona sonini qisqa ko'rinishda (tilga mos): uz — "1,2 mln" / "373 ming" / 842; ru — "373 тыс."; en — "373K". */
export function fmtUnits(v: number): string {
  return fmtCompactNum(v)
}

/** +10% / −5% / 0% */
export function fmtSignedPct(v: number): string {
  const n = fin(v)
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}%`
}

export function mosStatus(mos: number): 'good' | 'warn' | 'bad' {
  const m = fin(mos)
  return m >= 20 ? 'good' : m >= 10 ? 'warn' : 'bad'
}

/** "Narx +10% · Hajm −5%" */
export function describeDeltas(d: SensitivityDeltas): string {
  return FACTORS.filter((f) => fin(d[f.key]) !== 0).map((f) => `${f.short} ${fmtSignedPct(d[f.key])}`).join(' · ')
}

/** Har oy uchun BEP natijasi (sparkline). */
export function monthlyBep(data: Dataset, months: MonthKey[]): BepResult[] {
  return months.map((m) => bepCompute(bepBase(data.pnl, data.sales, [m])))
}

export interface PlanBep {
  hasPlan: boolean
  netProfit: number
  fixedCosts: number
  /** 0..1 */
  cmr: number
  bepRevenue: number
}

/** Byudjet (scope='pnl') asosida plan BEP ko'rsatkichlari: doimiy xarajat, CM ratio, BEP (summa), sof foyda. */
export function planBep(budget: BudgetRow[], months: MonthKey[]): PlanBep {
  const t = pnlPlanTotals(budget, months)
  const set = new Set(months)
  let varOpex = 0
  for (const b of budget) {
    if (b.scope === 'pnl' && b.group === 'opex' && set.has(b.month) && VARIABLE_OPEX_ITEMS.includes(b.key)) varOpex += fin(b.plan)
  }
  const fixedCosts = t.opex - varOpex + t.depreciation + t.interest
  const cmr = safeDiv(t.revenue - t.cogs - varOpex, t.revenue)
  return { hasPlan: t.revenue > 0, netProfit: t.netProfit, fixedCosts, cmr, bepRevenue: cmr > 0 ? fixedCosts / cmr : 0 }
}

export interface GridRow {
  id: string
  key: FactorKey
  factor: string
  delta: number
  profit: number
  dProfit: number
  dProfitPct: number
  bepUnits: number
  bepRevenue: number
  mosPct: number
  computable: boolean
}

/** Ssenariy gridi: omil × o'zgarish (−20…+20) — bazaga nisbatan. */
export function scenarioGrid(base: BepBase): GridRow[] {
  const b = bepCompute(base)
  const out: GridRow[] = []
  for (const f of FACTORS) {
    for (const d of GRID_STEPS) {
      const r = applySensitivity(base, { ...ZERO_DELTAS, [f.key]: d })
      const ok = isComputable(r)
      out.push({
        id: `${f.key}:${d}`, key: f.key, factor: f.label, delta: d,
        profit: r.profit, dProfit: r.profit - b.profit, dProfitPct: pctChange(r.profit, b.profit),
        bepUnits: ok ? r.bepUnits : 0, bepRevenue: ok ? r.bepRevenue : 0, mosPct: ok ? r.marginOfSafetyPct : 0, computable: ok,
      })
    }
  }
  return out
}

export interface CurvePoint { delta: number; price: number; volume: number; varCost: number; fixedCost: number }

/** Har omil −20…+20% o'zgarganda foyda (boshqa omillar o'zgarmas). */
export function sensitivityCurves(pivot: BepBase): CurvePoint[] {
  return CURVE_STEPS.map((d) => {
    const pt = { delta: d } as CurvePoint
    for (const f of FACTORS) pt[f.key] = fin(applySensitivity(pivot, { ...ZERO_DELTAS, [f.key]: d }).profit)
    return pt
  })
}

export interface TornadoBar extends TornadoRow {
  /** foyda og'ishi (≤ 0) */
  lowDelta: number
  /** foyda og'ishi (≥ 0) */
  highDelta: number
  lowPct: string
  highPct: string
}

/** Tornado: ±pct o'zgarishda foydaning pivot foydadan og'ishi (swing bo'yicha saralangan). */
export function tornadoBars(pivot: BepBase, pct = 20): TornadoBar[] {
  const profit = bepCompute(pivot).profit
  return tornado(pivot, pct).map((r) => {
    const isCost = FACTORS.find((f) => f.key === r.key)?.isCost ?? false
    return {
      ...r,
      lowDelta: Math.min(0, fin(r.low) - profit), highDelta: Math.max(0, fin(r.high) - profit),
      lowPct: fmtSignedPct(isCost ? pct : -pct), highPct: fmtSignedPct(isCost ? -pct : pct),
    }
  })
}
