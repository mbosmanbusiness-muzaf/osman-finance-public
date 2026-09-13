import type { ArInvoice, ApBill, ISODate } from '@/types'
import { safeDiv, fin } from '@/lib/utils'
import { diffDays, addDays } from '@/lib/period'

export const AGING_BUCKETS = ['Kelmagan', '0–30', '31–60', '61–90', '90+'] as const
export type AgingBucket = (typeof AGING_BUCKETS)[number]

export type AgingDoc = { id: string; partyId: string; issueDate: ISODate; dueDate: ISODate; amount: number; paid: number; paidDate: ISODate | null }

export const fromInvoice = (i: ArInvoice): AgingDoc => ({ id: i.id, partyId: i.customerId, issueDate: i.issueDate, dueDate: i.dueDate, amount: fin(i.amount), paid: fin(i.paid), paidDate: i.paidDate })
export const fromBill = (b: ApBill): AgingDoc => ({ id: b.id, partyId: b.supplierId, issueDate: b.issueDate, dueDate: b.dueDate, amount: fin(b.amount), paid: fin(b.paid), paidDate: b.paidDate })

/** Hujjatlar holatini berilgan sanaga keltiradi: keyin chiqarilganlar olib tashlanadi, keyin to'langanlar o'sha paytda ochiq hisoblanadi. */
export function docsAsOf(docs: AgingDoc[], iso: ISODate): AgingDoc[] {
  const out: AgingDoc[] = []
  for (const d of docs) {
    if (d.issueDate > iso) continue
    out.push(d.paidDate && d.paidDate > iso ? { ...d, paid: 0, paidDate: null } : d)
  }
  return out
}

export const outstanding = (d: AgingDoc) => Math.max(0, fin(d.amount) - fin(d.paid))
export const isOpen = (d: AgingDoc) => outstanding(d) > 0

export function daysOverdue(d: AgingDoc, asOf: ISODate): number {
  return diffDays(asOf, d.dueDate)
}

export function bucketOf(d: AgingDoc, asOf: ISODate): AgingBucket {
  const days = daysOverdue(d, asOf)
  if (days <= 0) return 'Kelmagan'
  if (days <= 30) return '0–30'
  if (days <= 60) return '31–60'
  if (days <= 90) return '61–90'
  return '90+'
}

export interface PartyAgingRow {
  partyId: string
  name: string
  meta?: string
  buckets: Record<AgingBucket, number>
  total: number
  share: number
  overdue: number
  overduePct: number
  docs: AgingDoc[]
}

export interface AgingSummary {
  total: number
  overdue: number
  overduePct: number
  notDue: number
  buckets: Record<AgingBucket, number>
  bucketRows: { bucket: AgingBucket; value: number; share: number; count: number }[]
  avgDelayDays: number // ochiq muddati o'tganlar bo'yicha (summaga og'irlangan)
  avgPaidDelayDays: number // to'langanlar tarixi bo'yicha
  parties: PartyAgingRow[]
  top3Share: number
  openCount: number
  overdueCount: number
}

export function agingSummary(docs: AgingDoc[], asOf: ISODate, partyName: (id: string) => { name: string; meta?: string }): AgingSummary {
  const open = docs.filter(isOpen)
  const buckets: Record<AgingBucket, number> = { Kelmagan: 0, '0–30': 0, '31–60': 0, '61–90': 0, '90+': 0 }
  const counts: Record<AgingBucket, number> = { Kelmagan: 0, '0–30': 0, '31–60': 0, '61–90': 0, '90+': 0 }
  const byParty = new Map<string, PartyAgingRow>()
  let total = 0, overdue = 0, delayWeighted = 0, overdueCount = 0
  for (const d of open) {
    const amt = outstanding(d)
    const b = bucketOf(d, asOf)
    buckets[b] += amt; counts[b] += 1; total += amt
    if (b !== 'Kelmagan') { overdue += amt; delayWeighted += amt * daysOverdue(d, asOf); overdueCount++ }
    let row = byParty.get(d.partyId)
    if (!row) {
      const pn = partyName(d.partyId)
      row = { partyId: d.partyId, name: pn.name, meta: pn.meta, buckets: { Kelmagan: 0, '0–30': 0, '31–60': 0, '61–90': 0, '90+': 0 }, total: 0, share: 0, overdue: 0, overduePct: 0, docs: [] }
      byParty.set(d.partyId, row)
    }
    row.buckets[b] += amt; row.total += amt; if (b !== 'Kelmagan') row.overdue += amt
    row.docs.push(d)
  }
  const parties = Array.from(byParty.values()).map((r) => ({ ...r, share: safeDiv(r.total, total) * 100, overduePct: safeDiv(r.overdue, r.total) * 100 })).sort((a, b) => b.total - a.total)
  const paidHist = docs.filter((d) => d.paidDate && !isOpen(d))
  const paidDelays = paidHist.map((d) => ({ amt: fin(d.amount), delay: Math.max(0, diffDays(d.paidDate as string, d.dueDate)) }))
  const paidAmt = paidDelays.reduce((a, x) => a + x.amt, 0)
  const avgPaidDelayDays = safeDiv(paidDelays.reduce((a, x) => a + x.amt * x.delay, 0), paidAmt)
  const top3 = parties.slice(0, 3).reduce((a, r) => a + r.total, 0)
  return {
    total, overdue, overduePct: safeDiv(overdue, total) * 100, notDue: buckets.Kelmagan, buckets,
    bucketRows: AGING_BUCKETS.map((b) => ({ bucket: b, value: buckets[b], share: safeDiv(buckets[b], total) * 100, count: counts[b] })),
    avgDelayDays: safeDiv(delayWeighted, overdue), avgPaidDelayDays, parties, top3Share: safeDiv(top3, total) * 100,
    openCount: open.length, overdueCount,
  }
}

/** DSO = AR / Tushum × kunlar. DPO = AP / COGS × kunlar. */
export function dsoOf(receivables: number, revenue: number, days: number) { return safeDiv(receivables, revenue) * days }
export function dpoOf(payables: number, cogs: number, days: number) { return safeDiv(payables, cogs) * days }

export interface CalendarDay { date: ISODate; label: string; due: number; cumulative: number; projectedCash: number; count: number; belowMin: boolean }

/** Keyingi N kun to'lov taqvimi: har kuni qancha to'lash kerak, pul qoldig'i bilan solishtirilgan. */
export function paymentCalendar(bills: AgingDoc[], asOf: ISODate, cashStart: number, minCash: number, days = 30, dailyInflow = 0): CalendarDay[] {
  const out: CalendarDay[] = []
  let cum = 0, cash = cashStart
  const open = bills.filter(isOpen)
  // muddati o'tganlar birinchi kunga tushadi
  const overdue = open.filter((b) => diffDays(asOf, b.dueDate) > 0).reduce((a, b) => a + outstanding(b), 0)
  const overdueCount = open.filter((b) => diffDays(asOf, b.dueDate) > 0).length
  for (let i = 1; i <= days; i++) {
    const date = addDays(asOf, i)
    const todays = open.filter((b) => b.dueDate === date)
    let due = todays.reduce((a, b) => a + outstanding(b), 0)
    let count = todays.length
    if (i === 1) { due += overdue; count += overdueCount }
    cum += due
    cash = cash - due + dailyInflow
    out.push({ date, label: `${date.slice(8, 10)}.${date.slice(5, 7)}`, due, cumulative: cum, projectedCash: cash, count, belowMin: cash < minCash })
  }
  return out
}
