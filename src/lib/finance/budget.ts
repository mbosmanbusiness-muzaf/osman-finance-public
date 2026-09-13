import type { PnLRow, BudgetRow, MonthKey, PnLGroup } from '@/types'
import { PNL_GROUP_LABELS, PNL_GROUP_ORDER, isIncomeGroup } from '@/types'
import { safeDiv, fin } from '@/lib/utils'
import { pnlTotals, pnlPlanTotals } from './pnl'

export type PerfStatus = 'good' | 'warn' | 'bad'

export interface BudgetNode {
  id: string
  label: string
  level: 0 | 1
  group: PnLGroup | null
  isCostItem: boolean
  plan: number
  fact: number
  variance: number // fact − plan
  variancePct: number
  /** Bajarilish %: daromad → fact/plan; xarajat → plan/fact (100%+ = byudjet ichida) */
  performance: number
  status: PerfStatus
  /** foydaga ta'siri (musbat = yaxshi) */
  profitImpact: number
  children?: BudgetNode[]
}

export function perfStatus(p: number): PerfStatus {
  if (p >= 100) return 'good'
  if (p >= 90) return 'warn'
  return 'bad'
}

export function performanceOf(fact: number, plan: number, isCostItem: boolean): number {
  if (isCostItem) return plan === 0 && fact === 0 ? 100 : safeDiv(plan, fact, fact === 0 ? 1 : 0) * 100
  return plan === 0 && fact === 0 ? 100 : safeDiv(fact, plan, 0) * 100
}

function mkNode(id: string, label: string, level: 0 | 1, group: PnLGroup | null, isCostItem: boolean, plan: number, fact: number, children?: BudgetNode[]): BudgetNode {
  const variance = fact - plan
  const performance = performanceOf(fact, plan, isCostItem)
  return {
    id, label, level, group, isCostItem, plan, fact, variance, variancePct: safeDiv(variance, Math.abs(plan)) * 100,
    performance, status: perfStatus(performance), profitImpact: isCostItem ? -variance : variance, children,
  }
}

/** Ierarxik byudjet: guruh → modda. Subtotallar (Yalpi foyda, EBITDA, Sof foyda) alohida qaytariladi. */
export function budgetTree(pnl: PnLRow[], budget: BudgetRow[], months: MonthKey[]): { nodes: BudgetNode[]; totals: BudgetNode[] } {
  const set = new Set(months)
  const nodes: BudgetNode[] = []
  for (const grp of PNL_GROUP_ORDER) {
    const isCost = !isIncomeGroup(grp)
    const items = Array.from(new Set([...pnl.filter((r) => r.group === grp).map((r) => r.item), ...budget.filter((b) => b.scope === 'pnl' && b.group === grp).map((b) => b.key)]))
    const children = items.map((item) => {
      const fact = pnl.filter((r) => r.group === grp && r.item === item && set.has(r.month)).reduce((a, r) => a + fin(r.amount), 0)
      const plan = budget.filter((b) => b.scope === 'pnl' && b.group === grp && b.key === item && set.has(b.month)).reduce((a, b) => a + fin(b.plan), 0)
      return mkNode(`${grp}|${item}`, item, 1, grp, isCost, plan, fact)
    })
    const fact = children.reduce((a, c) => a + c.fact, 0), plan = children.reduce((a, c) => a + c.plan, 0)
    nodes.push(mkNode(grp, PNL_GROUP_LABELS[grp], 0, grp, isCost, plan, fact, children))
  }
  const t = pnlTotals(pnl, months), p = pnlPlanTotals(budget, months)
  const totals = [
    mkNode('grossProfit', 'Yalpi foyda', 0, null, false, p.grossProfit, t.grossProfit),
    mkNode('ebitda', 'EBITDA', 0, null, false, p.ebitda, t.ebitda),
    mkNode('netProfit', 'Sof foyda', 0, null, false, p.netProfit, t.netProfit),
  ]
  return { nodes, totals }
}

export interface VarianceStep { name: string; value: number; type: 'total' | 'up' | 'down' }

/** Plan sof foyda → (eng katta og'ishlar) → Fakt sof foyda. */
export function varianceWaterfall(tree: { nodes: BudgetNode[]; totals: BudgetNode[] }, topN = 8): VarianceStep[] {
  const net = tree.totals.find((t) => t.id === 'netProfit')!
  const items = tree.nodes.flatMap((g) => g.children ?? [])
  const sorted = items.slice().sort((a, b) => Math.abs(b.profitImpact) - Math.abs(a.profitImpact))
  const top = sorted.slice(0, topN)
  const rest = sorted.slice(topN).reduce((a, i) => a + i.profitImpact, 0)
  const steps: VarianceStep[] = [{ name: 'Plan sof foyda', value: net.plan, type: 'total' }]
  for (const i of top) steps.push({ name: i.label, value: i.profitImpact, type: i.profitImpact >= 0 ? 'up' : 'down' })
  if (sorted.length > topN) steps.push({ name: 'Boshqalar', value: rest, type: rest >= 0 ? 'up' : 'down' })
  steps.push({ name: 'Fakt sof foyda', value: net.fact, type: 'total' })
  return steps
}

/** Umumiy plan bajarilishi % (Overview): tushum, EBITDA va sof foyda bo'yicha o'rtacha. */
export function planFulfillment(pnl: PnLRow[], budget: BudgetRow[], months: MonthKey[]): { revenue: number; ebitda: number; netProfit: number; overall: number } {
  const t = pnlTotals(pnl, months), p = pnlPlanTotals(budget, months)
  const revenue = performanceOf(t.revenue, p.revenue, false)
  const ebitda = performanceOf(t.ebitda, p.ebitda, false)
  const netProfit = performanceOf(t.netProfit, p.netProfit, false)
  return { revenue, ebitda, netProfit, overall: (revenue + ebitda + netProfit) / 3 }
}
