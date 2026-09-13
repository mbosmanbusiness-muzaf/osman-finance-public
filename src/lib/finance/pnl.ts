import type { PnLRow, BudgetRow, MonthKey, PnLGroup } from '@/types'
import { PNL_GROUP_LABELS, PNL_GROUP_ORDER, isIncomeGroup } from '@/types'
import { safeDiv, fin } from '@/lib/utils'

export interface PnLTotals {
  revenue: number
  cogs: number
  grossProfit: number
  grossMargin: number // %
  opex: number
  ebitda: number
  ebitdaMargin: number
  depreciation: number
  ebit: number
  opMargin: number
  otherIncome: number
  interest: number
  ebt: number
  tax: number
  netProfit: number
  netMargin: number
}

const inMonths = (months: MonthKey[]) => {
  const set = new Set(months)
  return (m: MonthKey) => set.has(m)
}

export function groupSum(rows: PnLRow[], months: MonthKey[], group: PnLGroup, item?: string): number {
  const ok = inMonths(months)
  let s = 0
  for (const r of rows) if (r.group === group && ok(r.month) && (item === undefined || r.item === item)) s += fin(r.amount)
  return s
}

export function totalsFromGroups(g: Record<PnLGroup, number>): PnLTotals {
  const revenue = g.revenue, cogs = g.cogs, opex = g.opex, depreciation = g.depreciation
  const otherIncome = g.otherIncome, interest = g.interest, tax = g.tax
  const grossProfit = revenue - cogs
  const ebitda = grossProfit - opex + otherIncome
  const ebit = ebitda - depreciation
  const ebt = ebit - interest
  const netProfit = ebt - tax
  return {
    revenue, cogs, grossProfit, grossMargin: safeDiv(grossProfit, revenue) * 100,
    opex, ebitda, ebitdaMargin: safeDiv(ebitda, revenue) * 100,
    depreciation, ebit, opMargin: safeDiv(ebit, revenue) * 100,
    otherIncome, interest, ebt, tax, netProfit, netMargin: safeDiv(netProfit, revenue) * 100,
  }
}

/** Fakt jami — tanlangan oylar bo'yicha. */
export function pnlTotals(rows: PnLRow[], months: MonthKey[]): PnLTotals {
  const g = {} as Record<PnLGroup, number>
  for (const grp of PNL_GROUP_ORDER) g[grp] = groupSum(rows, months, grp)
  return totalsFromGroups(g)
}

/** Plan jami — byudjet (scope='pnl') qatorlaridan. */
export function pnlPlanTotals(budget: BudgetRow[], months: MonthKey[]): PnLTotals {
  const ok = inMonths(months)
  const g = {} as Record<PnLGroup, number>
  for (const grp of PNL_GROUP_ORDER) g[grp] = 0
  for (const b of budget) if (b.scope === 'pnl' && b.group && ok(b.month)) g[b.group as PnLGroup] += fin(b.plan)
  return totalsFromGroups(g)
}

export interface PnLMonthPoint extends PnLTotals { month: MonthKey; planRevenue: number; planNetProfit: number }

/** Oylik seriya (grafiklar uchun). */
export function pnlMonthlySeries(rows: PnLRow[], budget: BudgetRow[], months: MonthKey[]): PnLMonthPoint[] {
  return months.map((m) => {
    const t = pnlTotals(rows, [m])
    const p = pnlPlanTotals(budget, [m])
    return { month: m, ...t, planRevenue: p.revenue, planNetProfit: p.netProfit }
  })
}

export interface CategoryProfit { category: string; revenue: number; cogs: number; grossProfit: number; margin: number }

/** Kategoriya kesimi — 'Mahsulot sotuvi' va 'Tovar tannarxi' elementlaridan. */
export function pnlByCategory(rows: PnLRow[], months: MonthKey[]): CategoryProfit[] {
  const ok = inMonths(months)
  const map: Record<string, { revenue: number; cogs: number }> = {}
  for (const r of rows) {
    if (!ok(r.month)) continue
    if (r.group === 'revenue' && r.item === 'Mahsulot sotuvi') (map[r.element] ||= { revenue: 0, cogs: 0 }).revenue += fin(r.amount)
    if (r.group === 'cogs' && r.item === 'Tovar tannarxi') (map[r.element] ||= { revenue: 0, cogs: 0 }).cogs += fin(r.amount)
  }
  return Object.entries(map)
    .map(([category, v]) => ({ category, ...v, grossProfit: v.revenue - v.cogs, margin: safeDiv(v.revenue - v.cogs, v.revenue) * 100 }))
    .sort((a, b) => b.grossProfit - a.grossProfit)
}

export interface WaterfallStep { name: string; value: number; type: 'total' | 'up' | 'down' }

/** Tushum → COGS → Yalpi foyda → OPEX → EBITDA → ... → Sof foyda */
export function pnlWaterfall(t: PnLTotals): WaterfallStep[] {
  return [
    { name: 'Tushum', value: t.revenue, type: 'total' },
    { name: 'COGS', value: -t.cogs, type: 'down' },
    { name: 'Yalpi foyda', value: t.grossProfit, type: 'total' },
    { name: 'OPEX', value: -t.opex, type: 'down' },
    { name: 'Boshqa daromad', value: t.otherIncome, type: 'up' },
    { name: 'EBITDA', value: t.ebitda, type: 'total' },
    { name: 'Amortizatsiya', value: -t.depreciation, type: 'down' },
    { name: 'Foizlar', value: -t.interest, type: 'down' },
    { name: 'Soliq', value: -t.tax, type: 'down' },
    { name: 'Sof foyda', value: t.netProfit, type: 'total' },
  ]
}

/** Recharts uchun "floating bar" ma'lumoti: [base, base+value]. */
export function waterfallBars(steps: WaterfallStep[]) {
  let running = 0
  return steps.map((s) => {
    if (s.type === 'total') {
      running = s.value
      const lo = Math.min(0, s.value), hi = Math.max(0, s.value)
      return { name: s.name, range: [lo, hi] as [number, number], value: s.value, type: s.type }
    }
    const start = running
    running += s.value
    const lo = Math.min(start, running), hi = Math.max(start, running)
    return { name: s.name, range: [lo, hi] as [number, number], value: s.value, type: s.type }
  })
}

// ---------------- Detailed hierarchical P&L ----------------

export type PnLNodeKind = 'group' | 'item' | 'element' | 'subtotal'

export interface PnLNode {
  id: string
  label: string
  kind: PnLNodeKind
  level: 0 | 1 | 2
  group: PnLGroup | null
  isCost: boolean
  fact: number
  plan: number
  variance: number // fact − plan (ishora: foyda ta'siriga qarab emas, xom)
  variancePct: number
  /** foyda nuqtai nazaridan: daromadda fact>plan yaxshi, xarajatda fact<plan yaxshi */
  favorable: boolean
  prev: number
  prevYear: number
  ytd: number
  pctOfRevenue: number
  monthly: { month: MonthKey; fact: number; plan: number }[]
  children?: PnLNode[]
}

export interface PnLTreeInput {
  rows: PnLRow[]
  budget: BudgetRow[]
  months: MonthKey[]
  prevMonths: MonthKey[]
  prevYearMonths: MonthKey[]
  ytdMonths: MonthKey[]
  /** oylik trend uchun barcha oylar */
  allMonths: MonthKey[]
}

function sumRows(rows: PnLRow[], months: MonthKey[], pred: (r: PnLRow) => boolean) {
  const ok = inMonths(months)
  let s = 0
  for (const r of rows) if (ok(r.month) && pred(r)) s += fin(r.amount)
  return s
}
function sumPlan(budget: BudgetRow[], months: MonthKey[], pred: (b: BudgetRow) => boolean) {
  const ok = inMonths(months)
  let s = 0
  for (const b of budget) if (b.scope === 'pnl' && ok(b.month) && pred(b)) s += fin(b.plan)
  return s
}

export function buildPnLTree(inp: PnLTreeInput): PnLNode[] {
  const { rows, budget, months, prevMonths, prevYearMonths, ytdMonths, allMonths } = inp
  const revenueFact = groupSum(rows, months, 'revenue')
  const mk = (partial: Omit<PnLNode, 'variance' | 'variancePct' | 'favorable' | 'pctOfRevenue'>): PnLNode => {
    const variance = partial.fact - partial.plan
    const variancePct = safeDiv(variance, Math.abs(partial.plan)) * 100
    const favorable = partial.isCost ? variance <= 0 : variance >= 0
    return { ...partial, variance, variancePct, favorable, pctOfRevenue: safeDiv(partial.fact, revenueFact) * 100 }
  }

  const nodes: PnLNode[] = []
  const groupNodes: Partial<Record<PnLGroup, PnLNode>> = {}

  for (const grp of PNL_GROUP_ORDER) {
    const isCost = !isIncomeGroup(grp)
    const items = Array.from(new Set([...rows.filter((r) => r.group === grp).map((r) => r.item), ...budget.filter((b) => b.scope === 'pnl' && b.group === grp).map((b) => b.key)]))
    const itemNodes: PnLNode[] = items.map((item) => {
      const elements = Array.from(new Set(rows.filter((r) => r.group === grp && r.item === item).map((r) => r.element)))
      const itemFact = sumRows(rows, months, (r) => r.group === grp && r.item === item)
      const itemPlan = sumPlan(budget, months, (b) => b.group === grp && b.key === item)
      const elementNodes: PnLNode[] = elements.map((el) => {
        const pred = (r: PnLRow) => r.group === grp && r.item === item && r.element === el
        const fact = sumRows(rows, months, pred)
        const share = safeDiv(fact, itemFact, safeDiv(1, elements.length))
        return mk({
          id: `${grp}|${item}|${el}`, label: el, kind: 'element', level: 2, group: grp, isCost,
          fact, plan: itemPlan * share,
          prev: sumRows(rows, prevMonths, pred), prevYear: sumRows(rows, prevYearMonths, pred), ytd: sumRows(rows, ytdMonths, pred),
          monthly: allMonths.map((m) => {
            const f = sumRows(rows, [m], pred)
            const itemF = sumRows(rows, [m], (r) => r.group === grp && r.item === item)
            const itemP = sumPlan(budget, [m], (b) => b.group === grp && b.key === item)
            return { month: m, fact: f, plan: itemP * safeDiv(f, itemF, safeDiv(1, elements.length)) }
          }),
        })
      })
      const pred = (r: PnLRow) => r.group === grp && r.item === item
      return mk({
        id: `${grp}|${item}`, label: item, kind: 'item', level: 1, group: grp, isCost,
        fact: itemFact, plan: itemPlan,
        prev: sumRows(rows, prevMonths, pred), prevYear: sumRows(rows, prevYearMonths, pred), ytd: sumRows(rows, ytdMonths, pred),
        monthly: allMonths.map((m) => ({ month: m, fact: sumRows(rows, [m], pred), plan: sumPlan(budget, [m], (b) => b.group === grp && b.key === item) })),
        children: elementNodes,
      })
    })
    const pred = (r: PnLRow) => r.group === grp
    const node = mk({
      id: grp, label: PNL_GROUP_LABELS[grp], kind: 'group', level: 0, group: grp, isCost,
      fact: groupSum(rows, months, grp), plan: sumPlan(budget, months, (b) => b.group === grp),
      prev: sumRows(rows, prevMonths, pred), prevYear: sumRows(rows, prevYearMonths, pred), ytd: sumRows(rows, ytdMonths, pred),
      monthly: allMonths.map((m) => ({ month: m, fact: sumRows(rows, [m], pred), plan: sumPlan(budget, [m], (b) => b.group === grp) })),
      children: itemNodes,
    })
    groupNodes[grp] = node
  }

  // Subtotals
  const T = (ms: MonthKey[]) => pnlTotals(rows, ms)
  const P = (ms: MonthKey[]) => pnlPlanTotals(budget, ms)
  const subtotal = (id: string, label: string, pick: (t: PnLTotals) => number): PnLNode =>
    mk({
      id, label, kind: 'subtotal', level: 0, group: null, isCost: false,
      fact: pick(T(months)), plan: pick(P(months)),
      prev: pick(T(prevMonths)), prevYear: pick(T(prevYearMonths)), ytd: pick(T(ytdMonths)),
      monthly: allMonths.map((m) => ({ month: m, fact: pick(T([m])), plan: pick(P([m])) })),
    })

  nodes.push(groupNodes.revenue!)
  nodes.push(groupNodes.cogs!)
  nodes.push(subtotal('grossProfit', 'Yalpi foyda', (t) => t.grossProfit))
  nodes.push(groupNodes.opex!)
  nodes.push(groupNodes.otherIncome!)
  nodes.push(subtotal('ebitda', 'EBITDA', (t) => t.ebitda))
  nodes.push(groupNodes.depreciation!)
  nodes.push(subtotal('ebit', 'EBIT (operatsion foyda)', (t) => t.ebit))
  nodes.push(groupNodes.interest!)
  nodes.push(subtotal('ebt', 'Soliqqacha foyda', (t) => t.ebt))
  nodes.push(groupNodes.tax!)
  nodes.push(subtotal('netProfit', 'Sof foyda', (t) => t.netProfit))
  return nodes
}

/** Tekis ro'yxat (expand holatiga qarab) — jadval uchun. */
export function flattenPnLTree(nodes: PnLNode[], expanded: Set<string>): PnLNode[] {
  const out: PnLNode[] = []
  const walk = (n: PnLNode) => {
    out.push(n)
    if (n.children && expanded.has(n.id)) n.children.forEach(walk)
  }
  nodes.forEach(walk)
  return out
}
