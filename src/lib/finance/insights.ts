import type { BalanceMonth, BudgetRow, CashflowMonth, Dataset, ISODate, InventoryItem, MonthKey, PnLRow, Product, PurchaseTx, SaleTx } from '@/types'
import { clamp, cv, fin, mean, safeDiv, stdDev, sum } from '@/lib/utils'
import { addDays, addMonths, daysInMonth, diffDays, monthEnd, monthKey, parseMonth } from '@/lib/period'
import { agingSummary, daysOverdue, docsAsOf, fromInvoice, isOpen } from './aging'
import { balanceAt } from './balance'
import { cfTotals, icfOf, ocfOf } from './cashflow'
import { pnlPlanTotals, pnlTotals, type WaterfallStep } from './pnl'
import { salesStats } from './sales'

const step = (name: string, value: number): WaterfallStep => ({ name, value: fin(value), type: fin(value) >= 0 ? 'up' : 'down' })
const rowsOf = (cashflow: CashflowMonth[], months: MonthKey[]) =>
  months.map((m) => cashflow.find((c) => c.month === m)).filter((c): c is CashflowMonth => !!c)

// ---------- Pul: runway va 13 haftalik prognoz ----------

/** Operatsion + investitsion oqim va dividendlar (kredit harakatlarisiz) — prognoz asosi. */
const baseFlow = (c: CashflowMonth) => ocfOf(c) + icfOf(c) + fin(c.dividendsPaid)

export interface Runway {
  /** oxirgi 3 oy o'rtacha sof oqimi (kreditlarsiz) */
  netMonthly: number
  /** sof oqim manfiy bo'lsa — qoldiq necha oyga yetadi; aks holda null (cheklanmagan) */
  months: number | null
  /** qoldiq necha kunlik operatsion chiqimga teng */
  coverDays: number
}

export function runway(cashflow: CashflowMonth[], monthsUpTo: MonthKey[], cash: number): Runway {
  const last = monthsUpTo.slice(-3)
  const rows = rowsOf(cashflow, last)
  const netMonthly = rows.length ? mean(rows.map(baseFlow)) : 0
  const outflow = rows.reduce((a, c) => a - (fin(c.paidToSuppliers) + fin(c.salariesPaid) + fin(c.opexPaid) + fin(c.taxesPaid) + fin(c.interestPaid)), 0)
  const days = last.reduce((a, m) => a + daysInMonth(m), 0)
  return { netMonthly, months: netMonthly < 0 ? safeDiv(fin(cash), -netMonthly) : null, coverDays: safeDiv(fin(cash), safeDiv(outflow, days)) }
}

export interface ForecastWeek { week: number; label: string; start: ISODate; net: number; balance: number; low: number; high: number }
export interface CashForecast { opening: number; weeks: ForecastWeek[]; min: ForecastWeek | null; minLow: ForecastWeek | null }

/**
 * 13 haftalik pul prognozi: kunlik sof oqim = o'tgan yilning shu oyidagi oqim × o'sish koeffitsiyenti (mavsumiylik saqlanadi),
 * o'tgan yil bo'lmasa — oxirgi 3 oy o'rtachasi. Koridor — oylik oqim tebranishidan (±1.28σ√n, ~80%).
 */
export function cashForecast13w(cashflow: CashflowMonth[], monthsUpTo: MonthKey[], opening: number, weeks = 13): CashForecast {
  const asOf = monthsUpTo[monthsUpTo.length - 1]
  if (!asOf) return { opening: fin(opening), weeks: [], min: null, minLow: null }
  const byMonth = new Map(cashflow.map((c) => [c.month, c]))
  const recent = rowsOf(cashflow, monthsUpTo.slice(-3))
  const recentAvg = recent.length ? mean(recent.map(baseFlow)) : 0
  const lyRecent = monthsUpTo.slice(-3).map((m) => byMonth.get(addMonths(m, -12))).filter((c): c is CashflowMonth => !!c)
  const receipts = (rs: CashflowMonth[]) => sum(rs.map((c) => fin(c.receiptsFromCustomers)))
  const growth = recent.length && lyRecent.length === recent.length ? clamp(safeDiv(receipts(recent), receipts(lyRecent), 1), 0.7, 1.4) : 1
  const monthly = (m: MonthKey) => { const ly = byMonth.get(addMonths(m, -12)); return ly ? baseFlow(ly) * growth : recentAvg }
  const vol = stdDev(rowsOf(cashflow, monthsUpTo.slice(-12)).map(baseFlow)) / Math.sqrt(4.33)
  const start = monthEnd(asOf)
  const out: ForecastWeek[] = []
  let bal = fin(opening)
  for (let i = 0; i < weeks; i++) {
    let net = 0
    for (let d = 1; d <= 7; d++) { const m = addDays(start, i * 7 + d).slice(0, 7); net += monthly(m) / daysInMonth(m) }
    bal += net
    const band = 1.28 * vol * Math.sqrt(i + 1)
    const wStart = addDays(start, i * 7 + 1)
    out.push({ week: i + 1, label: `${wStart.slice(8, 10)}.${wStart.slice(5, 7)}`, start: wStart, net, balance: bal, low: bal - band, high: bal + band })
  }
  const min = out.reduce<ForecastWeek | null>((a, w) => (!a || w.balance < a.balance ? w : a), null)
  const minLow = out.reduce<ForecastWeek | null>((a, w) => (!a || w.low < a.low ? w : a), null)
  return { opening: fin(opening), weeks: out, min, minLow }
}

// ---------- Foyda → pul, qarz yuki, marja ko'prigi ----------

/** Foyda → pul ko'prigi: sof foydadan pul qoldig'i o'zgarishigacha (bilvosita usul; cashflow bilan aniq mos). */
export function profitToCashBridge(d: Dataset, months: MonthKey[]): WaterfallStep[] {
  const sorted = months.slice().sort()
  if (!sorted.length) return []
  const t = pnlTotals(d.pnl, sorted)
  const b0 = balanceAt(d.balance, addMonths(sorted[0], -1)), b1 = balanceAt(d.balance, sorted[sorted.length - 1])
  const cf = cfTotals(d.cashflow, sorted)
  const dAR = fin(b1.receivables) - fin(b0.receivables), dInv = fin(b1.inventory) - fin(b0.inventory), dAP = fin(b1.payables) - fin(b0.payables)
  return [
    { name: 'Sof foyda', value: t.netProfit, type: 'total' },
    step('Amortizatsiya', t.depreciation),
    step('Debitorlik', -dAR),
    step('Zaxira', -dInv),
    step('Kreditorlik', dAP),
    step('Boshqa aylanma', cf.ocf - (t.netProfit + t.depreciation - dAR - dInv + dAP)),
    { name: 'Operatsion oqim', value: cf.ocf, type: 'total' },
    step('Investitsiyalar', cf.icf),
    step('Kreditlar (sof)', cf.loansReceived + cf.loansRepaid),
    step('Dividendlar', cf.dividends),
    { name: "Pul o'zgarishi", value: cf.netChange, type: 'total' },
  ]
}

export interface NetDebtPoint { month: MonthKey; netDebt: number; ebitda: number; ratio: number }

/** Net debt / EBITDA: EBITDA — oxirgi 12 oy (kam oy bo'lsa yillashtirilgan). */
export function netDebtEbitdaSeries(balance: BalanceMonth[], pnl: PnLRow[], monthsUpTo: MonthKey[], n = 12): NetDebtPoint[] {
  return monthsUpTo.slice(-n).map((m) => {
    const b = balanceAt(balance, m)
    const trail = monthsUpTo.filter((x) => x <= m).slice(-12)
    const ebitda = pnlTotals(pnl, trail).ebitda * safeDiv(12, trail.length)
    const netDebt = fin(b.shortTermDebt) + fin(b.longTermDebt) - fin(b.cash)
    return { month: m, netDebt, ebitda, ratio: ebitda > 0 ? netDebt / ebitda : 0 }
  })
}

/** Yalpi foyda ko'prigi (o'tgan davr → joriy): hajm, narx (tarkib bilan) va tannarx effektlari; yig'indi aniq. */
export function marginBridge(sales: SaleTx[], cur: MonthKey[], prev: MonthKey[]): WaterfallStep[] {
  if (!prev.length) return []
  const a = salesStats(sales, prev), b = salesStats(sales, cur)
  if (a.units <= 0 || b.units <= 0) return []
  const p0 = a.revenue / a.units, c0 = a.cogs / a.units, p1 = b.revenue / b.units, c1 = b.cogs / b.units
  return [
    { name: "O'tgan davr", value: a.grossProfit, type: 'total' },
    step('Hajm', (b.units - a.units) * (p0 - c0)),
    step('Narx', (p1 - p0) * b.units),
    step('Tannarx', -(c1 - c0) * b.units),
    { name: 'Joriy davr', value: b.grossProfit, type: 'total' },
  ]
}

export interface DebtPoint { month: MonthKey; shortTerm: number; longTerm: number; dscr: number | null }

/** Qarz grafigi: oy oxiri kreditlar va DSCR = EBITDA / (foizlar + asosiy qarz to'lovi). */
export function debtDscrSeries(balance: BalanceMonth[], pnl: PnLRow[], cashflow: CashflowMonth[], monthsUpTo: MonthKey[], n = 12): DebtPoint[] {
  return monthsUpTo.slice(-n).map((m) => {
    const b = balanceAt(balance, m)
    const t = pnlTotals(pnl, [m])
    const service = t.interest + Math.max(0, -fin(cashflow.find((c) => c.month === m)?.loansRepaid))
    return { month: m, shortTerm: fin(b.shortTermDebt), longTerm: fin(b.longTermDebt), dscr: service > 0 ? t.ebitda / service : null }
  })
}

// ---------- Xarajatlar: OPEX javobgarlik markazlari (CFU) bo'yicha ----------

const CFU_BY_KEY: Record<string, string> = {
  "Ish haqi|Sotuv bo'limi": 'Sotuv', "Ish haqi|Ma'muriyat": "Ma'muriyat", 'Ish haqi|Ombor va logistika': 'Ombor va logistika',
  'Ijara|Ofis': "Ma'muriyat", 'Ijara|Ombor': 'Ombor va logistika',
}
const CFU_BY_ITEM: Record<string, string> = { Marketing: 'Sotuv', Logistika: 'Ombor va logistika', Kommunal: "Ma'muriyat", Boshqa: "Ma'muriyat" }
export const cfuOf = (item: string, element: string) => CFU_BY_KEY[`${item}|${element}`] ?? CFU_BY_ITEM[item] ?? 'Boshqa'

export interface CfuRow { cfu: string; value: number; share: number; items: { name: string; value: number }[] }

export function opexByCfu(pnl: PnLRow[], months: MonthKey[]): CfuRow[] {
  const set = new Set(months)
  const map = new Map<string, Map<string, number>>()
  for (const r of pnl) {
    if (r.group !== 'opex' || !set.has(r.month)) continue
    const cfu = cfuOf(r.item, r.element)
    const items = map.get(cfu) ?? new Map<string, number>()
    items.set(r.item, (items.get(r.item) ?? 0) + fin(r.amount))
    map.set(cfu, items)
  }
  const total = sum(Array.from(map.values()).flatMap((m) => Array.from(m.values())))
  return Array.from(map, ([cfu, items]) => {
    const value = sum(Array.from(items.values()))
    return { cfu, value, share: safeDiv(value, total) * 100, items: Array.from(items, ([name, v]) => ({ name, value: v })).sort((a, b) => b.value - a.value) }
  }).sort((a, b) => b.value - a.value)
}

// ---------- Zaxira: ta'minlanganlik ----------

export interface CoverageRow {
  productId: string; name: string; category: string; supplierId: string
  qty: number; unitCost: number; value: number; dailyUnits: number
  /** zaxira necha kunlik sotuvga yetadi; sotuv bo'lmasa null */
  coverageDays: number | null
  idleDays: number
}

/** Ta'minlanganlik: zaxira necha kunga yetadi (oxirgi `lookback` kun o'rtacha kunlik sotuvi bo'yicha). */
export function productCoverage(inventory: InventoryItem[], products: Product[], sales: SaleTx[], asOfDate: ISODate, lookback = 90): CoverageRow[] {
  const from = addDays(asOfDate, -lookback)
  const units = new Map<string, number>()
  for (const s of sales) if (s.date > from && s.date <= asOfDate) units.set(s.productId, (units.get(s.productId) ?? 0) + fin(s.qty))
  const byId = new Map(products.map((p) => [p.id, p]))
  return inventory.map((it) => {
    const p = byId.get(it.productId)
    const daily = (units.get(it.productId) ?? 0) / lookback
    const qty = fin(it.qty)
    return {
      productId: it.productId, name: p?.name ?? it.productId, category: p?.category ?? 'Boshqa', supplierId: p?.supplierId ?? '',
      qty, unitCost: fin(it.unitCost), value: qty * fin(it.unitCost), dailyUnits: daily, coverageDays: daily > 0 ? qty / daily : null, idleDays: Math.max(0, diffDays(asOfDate, it.lastMovementDate)),
    }
  }).sort((a, b) => b.value - a.value)
}

// ---------- Ta'minot: narx og'ishi, narx dinamikasi, yetkazib beruvchilar ----------

export interface PpvRow { productId: string; name: string; category: string; supplierId: string; cost0: number; cost1: number; changePct: number; qty1: number; impact: number }

/** PPV (narx og'ishi): joriy birlik tannarxi o'tgan davrga nisbatan × joriy hajm (sotuv tannarxi bo'yicha). */
export function purchasePriceVariance(sales: SaleTx[], products: Product[], cur: MonthKey[], prev: MonthKey[]): { total: number; pct: number; rows: PpvRow[] } {
  const agg = (months: MonthKey[]) => {
    const set = new Set(months)
    const m = new Map<string, { q: number; c: number }>()
    for (const s of sales) {
      if (!set.has(s.month)) continue
      const x = m.get(s.productId) ?? { q: 0, c: 0 }
      x.q += fin(s.qty); x.c += fin(s.cogs); m.set(s.productId, x)
    }
    return m
  }
  const a = agg(prev), b = agg(cur)
  const rows: PpvRow[] = []
  let total = 0, base = 0
  for (const p of products) {
    const x = a.get(p.id), y = b.get(p.id)
    if (!x || !y || x.q <= 0 || y.q <= 0) continue
    const c0 = x.c / x.q, c1 = y.c / y.q
    const impact = (c1 - c0) * y.q
    total += impact; base += c0 * y.q
    rows.push({ productId: p.id, name: p.name, category: p.category, supplierId: p.supplierId, cost0: c0, cost1: c1, changePct: safeDiv(c1 - c0, c0) * 100, qty1: y.q, impact })
  }
  return { total, pct: safeDiv(total, base) * 100, rows: rows.sort((r1, r2) => r2.changePct - r1.changePct) }
}

/** Birlik tannarxi indeksi (davrning birinchi sotuv oyi = 100) — narx dinamikasi grafigi. */
export function unitCostIndex(sales: SaleTx[], productIds: string[], months: MonthKey[]): Record<string, number | string | null>[] {
  const idx = new Map(months.map((m, i) => [m, i]))
  const pos = new Map(productIds.map((id, i) => [id, i]))
  const q = productIds.map(() => new Array<number>(months.length).fill(0))
  const c = productIds.map(() => new Array<number>(months.length).fill(0))
  for (const s of sales) {
    const i = idx.get(s.month), j = pos.get(s.productId)
    if (i === undefined || j === undefined) continue
    q[j][i] += fin(s.qty); c[j][i] += fin(s.cogs)
  }
  const base = productIds.map((_, j) => { const i = q[j].findIndex((v) => v > 0); return i >= 0 ? c[j][i] / q[j][i] : 0 })
  return months.map((m, i) => Object.fromEntries([['month', m], ...productIds.map((id, j) => [id, q[j][i] > 0 && base[j] > 0 ? (c[j][i] / q[j][i] / base[j]) * 100 : null])]))
}

export interface SupplierScore { supplierId: string; name: string; category: string; spend: number; share: number; cv: number; priceChangePct: number; termsDays: number; score: number }

/** Yetkazib beruvchi reytingi (0–100): narx barqarorligi 45%, xarid barqarorligi (CV) 30%, to'lov muddati 25%. */
export function supplierScores(d: Dataset, cur: MonthKey[], prev: MonthKey[]): SupplierScore[] {
  const idx = new Map(cur.map((m, i) => [m, i]))
  const spend = new Map<string, number[]>()
  for (const p of d.purchases) {
    const i = idx.get(p.month)
    if (i === undefined) continue
    const arr = spend.get(p.supplierId) ?? new Array<number>(cur.length).fill(0)
    arr[i] += fin(p.amount); spend.set(p.supplierId, arr)
  }
  const total = sum(Array.from(spend.values()).map((a) => sum(a)))
  const ppv = purchasePriceVariance(d.sales, d.products, cur, prev)
  return d.suppliers.map((s) => {
    const monthly = spend.get(s.id) ?? []
    const sp = sum(monthly)
    const rows = ppv.rows.filter((r) => r.supplierId === s.id)
    const priceChangePct = safeDiv(sum(rows.map((r) => r.impact)), sum(rows.map((r) => r.cost0 * r.qty1))) * 100
    const variability = cv(monthly)
    const score = 0.45 * clamp(100 - Math.max(0, priceChangePct) * 8, 0, 100) + 0.3 * clamp(100 - variability * 2, 0, 100) + 0.25 * clamp((s.paymentTermsDays / 60) * 100, 0, 100)
    return { supplierId: s.id, name: s.name, category: s.category, spend: sp, share: safeDiv(sp, total) * 100, cv: variability, priceChangePct, termsDays: s.paymentTermsDays, score: Math.round(score) }
  }).filter((r) => r.spend > 0).sort((a, b) => b.score - a.score)
}

export function purchasesVsInventory(purchases: PurchaseTx[], balance: BalanceMonth[], months: MonthKey[]): { month: MonthKey; purchases: number; inventory: number }[] {
  const byMonth = new Map<string, number>()
  for (const p of purchases) byMonth.set(p.month, (byMonth.get(p.month) ?? 0) + fin(p.amount))
  return months.map((m) => ({ month: m, purchases: byMonth.get(m) ?? 0, inventory: fin(balanceAt(balance, m).inventory) }))
}

// ---------- O'sish va yil oxiri prognozi ----------

export function revenueYoY(pnl: PnLRow[], monthsUpTo: MonthKey[], n = 12): { month: MonthKey; revenue: number; revenueLy: number | null; growth: number | null }[] {
  const have = new Set(monthsUpTo)
  return monthsUpTo.slice(-n).map((m) => {
    const ly = addMonths(m, -12)
    const revenue = pnlTotals(pnl, [m]).revenue
    const revenueLy = have.has(ly) ? pnlTotals(pnl, [ly]).revenue : null
    return { month: m, revenue, revenueLy, growth: revenueLy ? safeDiv(revenue - revenueLy, revenueLy) * 100 : null }
  })
}

export interface YearMonthPoint { month: MonthKey; actual: number | null; plan: number | null; forecast: number | null }

/** Joriy yil: fakt (asOf gacha), plan va qolgan oylar prognozi (o'tgan yil shu oy × YTD o'sish). */
export function yearEndForecast(pnl: PnLRow[], budget: BudgetRow[], allMonths: MonthKey[], asOf: MonthKey) {
  const { y } = parseMonth(asOf)
  const have = new Set(allMonths)
  const rev = (m: MonthKey) => pnlTotals(pnl, [m]).revenue
  const ytd = allMonths.filter((m) => m.startsWith(`${y}-`) && m <= asOf)
  const lyYtd = ytd.map((m) => addMonths(m, -12)).filter((m) => have.has(m))
  const growth = ytd.length && lyYtd.length === ytd.length ? clamp(safeDiv(sum(ytd.map(rev)), sum(lyYtd.map(rev)), 1), 0.7, 1.5) : 1
  const avgRecent = mean(ytd.slice(-3).map(rev))
  const points: YearMonthPoint[] = Array.from({ length: 12 }, (_, i) => {
    const m = monthKey(y, i + 1)
    const plan = pnlPlanTotals(budget, [m]).revenue || null
    if (m <= asOf && have.has(m)) return { month: m, actual: rev(m), plan, forecast: null }
    const ly = addMonths(m, -12)
    return { month: m, actual: null, plan, forecast: have.has(ly) ? rev(ly) * growth : avgRecent }
  })
  const ytdActual = sum(ytd.map(rev))
  const ytdPlan = pnlPlanTotals(budget, ytd).revenue
  const lyMonths = Array.from({ length: 12 }, (_, i) => monthKey(y - 1, i + 1))
  return {
    points, growth, ytdActual, ytdPlan, ytdPct: ytdPlan > 0 ? safeDiv(ytdActual, ytdPlan) * 100 : null,
    yearEnd: ytdActual + sum(points.map((p) => fin(p.forecast))),
    lastYear: lyMonths.every((m) => have.has(m)) ? sum(lyMonths.map(rev)) : null,
  }
}

// ---------- Undirish: muddati o'tgan debitorlar ----------

export interface DebtorRow { customerId: string; name: string; segment: string; overdue: number; total: number; over90: number; maxDays: number; owner: string }

/** Muddati o'tgan debitorlar (top-N) va mas'ul — mijozga eng ko'p sotgan xodim. */
export function topOverdueDebtors(d: Dataset, asOfDate: ISODate, n = 20): DebtorRow[] {
  const cust = new Map(d.customers.map((c) => [c.id, c]))
  const emp = new Map(d.employees.map((e) => [e.id, e.name]))
  const byCustomer = new Map<string, Map<string, number>>()
  for (const s of d.sales) {
    const m = byCustomer.get(s.customerId) ?? new Map<string, number>()
    m.set(s.employeeId, (m.get(s.employeeId) ?? 0) + fin(s.revenue))
    byCustomer.set(s.customerId, m)
  }
  const ownerOf = (cid: string) => { const best = Array.from(byCustomer.get(cid) ?? []).sort((a, b) => b[1] - a[1])[0]; return best ? emp.get(best[0]) ?? best[0] : '—' }
  const s = agingSummary(docsAsOf(d.invoices.map(fromInvoice), asOfDate), asOfDate, (id) => ({ name: cust.get(id)?.name ?? id, meta: cust.get(id)?.segment }))
  return s.parties.filter((p) => p.overdue > 0).sort((a, b) => b.overdue - a.overdue).slice(0, n).map((p) => ({
    customerId: p.partyId, name: p.name, segment: p.meta ?? '', overdue: p.overdue, total: p.total, over90: p.buckets['90+'],
    maxDays: Math.max(0, ...p.docs.filter(isOpen).map((doc) => daysOverdue(doc, asOfDate))), owner: ownerOf(p.partyId),
  }))
}

// ---------- Savdo kanallari (mijoz segmenti) ----------

export interface ChannelProfit { category: string; revenue: number; cogs: number; grossProfit: number; margin: number }

/** Savdo kanali = mijoz segmenti: tushum, tannarx, yalpi foyda va marja (sotuv tranzaksiyalari bo'yicha). */
export function profitByChannel(d: Dataset, months: MonthKey[]): ChannelProfit[] {
  const seg = new Map(d.customers.map((c) => [c.id, c.segment as string]))
  const set = new Set(months)
  const map = new Map<string, { revenue: number; cogs: number }>()
  for (const s of d.sales) {
    if (!set.has(s.month)) continue
    const k = seg.get(s.customerId) ?? 'Boshqa'
    const x = map.get(k) ?? { revenue: 0, cogs: 0 }
    x.revenue += fin(s.revenue); x.cogs += fin(s.cogs)
    map.set(k, x)
  }
  return Array.from(map, ([category, v]) => ({ category, ...v, grossProfit: v.revenue - v.cogs, margin: safeDiv(v.revenue - v.cogs, v.revenue) * 100 }))
    .sort((a, b) => b.grossProfit - a.grossProfit)
}
