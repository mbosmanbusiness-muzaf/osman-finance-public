import type { CashflowMonth, BudgetRow, MonthKey } from '@/types'
import { fin, createRng } from '@/lib/utils'
import { daysInMonth, addDays, monthStart, parseMonth } from '@/lib/period'

export interface CfTotals {
  opening: number
  receipts: number
  otherReceipts: number
  suppliers: number
  salaries: number
  opex: number
  taxes: number
  interest: number
  ocf: number
  capex: number
  assetSales: number
  icf: number
  loansReceived: number
  loansRepaid: number
  dividends: number
  fcf: number
  /** Free cash flow = OCF − CapEx (capex musbat qiymat sifatida ayiriladi) */
  freeCashFlow: number
  netChange: number
  closing: number
}

export function ocfOf(c: CashflowMonth) {
  return fin(c.receiptsFromCustomers) + fin(c.otherOperatingReceipts) + fin(c.paidToSuppliers) + fin(c.salariesPaid) + fin(c.opexPaid) + fin(c.taxesPaid) + fin(c.interestPaid)
}
export function icfOf(c: CashflowMonth) { return fin(c.capex) + fin(c.assetSales) }
export function fcfOf(c: CashflowMonth) { return fin(c.loansReceived) + fin(c.loansRepaid) + fin(c.dividendsPaid) }

export function cfTotals(cf: CashflowMonth[], months: MonthKey[]): CfTotals {
  const sorted = months.slice().sort()
  const rows = sorted.map((m) => cf.find((c) => c.month === m)).filter(Boolean) as CashflowMonth[]
  const z: CfTotals = {
    opening: 0, receipts: 0, otherReceipts: 0, suppliers: 0, salaries: 0, opex: 0, taxes: 0, interest: 0, ocf: 0,
    capex: 0, assetSales: 0, icf: 0, loansReceived: 0, loansRepaid: 0, dividends: 0, fcf: 0, freeCashFlow: 0, netChange: 0, closing: 0,
  }
  if (!rows.length) return z
  z.opening = fin(rows[0].openingCash)
  for (const c of rows) {
    z.receipts += fin(c.receiptsFromCustomers); z.otherReceipts += fin(c.otherOperatingReceipts)
    z.suppliers += fin(c.paidToSuppliers); z.salaries += fin(c.salariesPaid); z.opex += fin(c.opexPaid)
    z.taxes += fin(c.taxesPaid); z.interest += fin(c.interestPaid)
    z.capex += fin(c.capex); z.assetSales += fin(c.assetSales)
    z.loansReceived += fin(c.loansReceived); z.loansRepaid += fin(c.loansRepaid); z.dividends += fin(c.dividendsPaid)
  }
  z.ocf = z.receipts + z.otherReceipts + z.suppliers + z.salaries + z.opex + z.taxes + z.interest
  z.icf = z.capex + z.assetSales
  z.fcf = z.loansReceived + z.loansRepaid + z.dividends
  z.freeCashFlow = z.ocf + z.capex // capex manfiy saqlanadi
  z.netChange = z.ocf + z.icf + z.fcf
  z.closing = fin(rows[rows.length - 1].closingCash)
  return z
}

export interface CfMonthPoint {
  month: MonthKey
  opening: number
  ocf: number
  icf: number
  fcf: number
  freeCashFlow: number
  netChange: number
  closing: number
  planClosing: number
  planOcf: number
}

export function cfMonthlySeries(cf: CashflowMonth[], budget: BudgetRow[], months: MonthKey[]): CfMonthPoint[] {
  return months.slice().sort().map((m) => {
    const c = cf.find((x) => x.month === m)
    const planClosing = budget.find((b) => b.scope === 'cash' && b.key === 'closingCash' && b.month === m)?.plan ?? 0
    const planOcf = budget.find((b) => b.scope === 'cash' && b.key === 'ocf' && b.month === m)?.plan ?? 0
    if (!c) return { month: m, opening: 0, ocf: 0, icf: 0, fcf: 0, freeCashFlow: 0, netChange: 0, closing: 0, planClosing, planOcf }
    const ocf = ocfOf(c), icf = icfOf(c), fcf = fcfOf(c)
    return { month: m, opening: fin(c.openingCash), ocf, icf, fcf, freeCashFlow: ocf + fin(c.capex), netChange: ocf + icf + fcf, closing: fin(c.closingCash), planClosing, planOcf }
  })
}

export interface CfWaterfallStep { name: string; value: number; type: 'total' | 'up' | 'down' }

export function cfWaterfall(t: CfTotals): CfWaterfallStep[] {
  return [
    { name: "Boshlang'ich qoldiq", value: t.opening, type: 'total' },
    { name: 'Operatsion CF', value: t.ocf, type: t.ocf >= 0 ? 'up' : 'down' },
    { name: 'Investitsion CF', value: t.icf, type: t.icf >= 0 ? 'up' : 'down' },
    { name: 'Moliyaviy CF', value: t.fcf, type: t.fcf >= 0 ? 'up' : 'down' },
    { name: 'Yakuniy qoldiq', value: t.closing, type: 'total' },
  ]
}

export type Granularity = 'day' | 'week' | 'month'

export interface CashPoint {
  key: string // '2026-08-14' | '2026-W33' | '2026-08'
  label: string
  inflow: number
  outflow: number
  net: number
  balance: number
  planBalance: number
}

/**
 * Oylik cashflow'ni kunlik oqimlarga deterministik taqsimlaydi (kunlar yig'indisi = oylik).
 * Haftalik/oylik — kunlik seriyani agregatlash.
 */
export function cashSeries(cf: CashflowMonth[], budget: BudgetRow[], months: MonthKey[], granularity: Granularity): CashPoint[] {
  const sorted = months.slice().sort()
  const daily: CashPoint[] = []
  for (const m of sorted) {
    const c = cf.find((x) => x.month === m)
    if (!c) continue
    const dim = daysInMonth(m)
    const inflowTotal = fin(c.receiptsFromCustomers) + fin(c.otherOperatingReceipts) + fin(c.assetSales) + fin(c.loansReceived)
    const outflowTotal = fin(c.paidToSuppliers) + fin(c.salariesPaid) + fin(c.opexPaid) + fin(c.taxesPaid) + fin(c.interestPaid) + fin(c.capex) + fin(c.loansRepaid) + fin(c.dividendsPaid)
    const { y, mo } = { y: parseMonth(m).y, mo: parseMonth(m).m }
    const rng = createRng(y * 100 + mo)
    // og'irliklar: ish kunlari ko'proq, dam olish kam; ish haqi 5 va 20-sanada, ijara 1-sanada
    const wIn: number[] = [], wOut: number[] = []
    for (let d = 1; d <= dim; d++) {
      const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay()
      const weekend = dow === 0 || dow === 6
      wIn.push((weekend ? 0.25 : 1) * rng.range(0.6, 1.4))
      wOut.push((weekend ? 0.2 : 1) * rng.range(0.6, 1.4) + (d === 5 || d === 20 ? 4 : 0) + (d === 1 ? 2.5 : 0))
    }
    const sIn = wIn.reduce((a, b) => a + b, 0), sOut = wOut.reduce((a, b) => a + b, 0)
    let bal = fin(c.openingCash)
    let accIn = 0, accOut = 0
    const planClosing = budget.find((b) => b.scope === 'cash' && b.key === 'closingCash' && b.month === m)?.plan ?? fin(c.closingCash)
    for (let d = 1; d <= dim; d++) {
      const last = d === dim
      const inflow = last ? inflowTotal - accIn : Math.round((inflowTotal * wIn[d - 1]) / sIn)
      const outflow = last ? outflowTotal - accOut : Math.round((outflowTotal * wOut[d - 1]) / sOut)
      accIn += inflow; accOut += outflow
      bal += inflow + outflow
      const key = `${m}-${String(d).padStart(2, '0')}`
      // plan balance: chiziqli interpolyatsiya opening → planClosing
      const planBalance = fin(c.openingCash) + ((planClosing - fin(c.openingCash)) * d) / dim
      daily.push({ key, label: `${String(d).padStart(2, '0')}.${String(mo).padStart(2, '0')}`, inflow, outflow, net: inflow + outflow, balance: bal, planBalance })
    }
  }
  if (granularity === 'day') return daily
  if (granularity === 'month') {
    return sorted.map((m) => {
      const pts = daily.filter((p) => p.key.startsWith(m))
      const inflow = pts.reduce((a, p) => a + p.inflow, 0), outflow = pts.reduce((a, p) => a + p.outflow, 0)
      const last = pts[pts.length - 1]
      return { key: m, label: m, inflow, outflow, net: inflow + outflow, balance: last?.balance ?? 0, planBalance: last?.planBalance ?? 0 }
    })
  }
  // week: ISO-ish weeks starting Monday
  const weeks: CashPoint[] = []
  let cur: CashPoint | null = null
  for (const p of daily) {
    const d = new Date(p.key + 'T00:00:00Z')
    const dow = (d.getUTCDay() + 6) % 7 // Monday=0
    if (!cur || dow === 0) {
      const monday = addDays(p.key, -dow)
      cur = { key: `W:${monday}`, label: `${monday.slice(8, 10)}.${monday.slice(5, 7)}`, inflow: 0, outflow: 0, net: 0, balance: 0, planBalance: 0 }
      weeks.push(cur)
    }
    cur.inflow += p.inflow; cur.outflow += p.outflow; cur.net += p.net; cur.balance = p.balance; cur.planBalance = p.planBalance
  }
  return weeks
}

export const monthStartOf = monthStart
