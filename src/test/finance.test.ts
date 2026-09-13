/**
 * Formulalar va demo ma'lumot izchilligi testlari (Vitest).
 */
import { describe, it, expect } from 'vitest'
import { generateDemoData } from '@/data/seed'
import { balanceTotals, ratioSnapshot, computeRatioCards } from '@/lib/finance/balance'
import { pnlTotals, pnlPlanTotals, pnlWaterfall, buildPnLTree } from '@/lib/finance/pnl'
import { cfTotals, ocfOf, icfOf, fcfOf, cashSeries } from '@/lib/finance/cashflow'
import { classifyAbcXyz, xyzOf } from '@/lib/finance/abcxyz'
import { agingSummary, fromInvoice, fromBill, bucketOf, paymentCalendar } from '@/lib/finance/aging'
import { performanceOf, budgetTree, varianceWaterfall } from '@/lib/finance/budget'
import { bepBase, bepCompute, applySensitivity, tornado } from '@/lib/finance/bep'
import { safeDiv, fin, cv } from '@/lib/utils'
import { fmtCompactNum, fmtMoney, fmtNum, fmtPct, fmtRatio } from '@/lib/format'
import { useLanguageStore, type Language } from '@/i18n'
import { monthsInRange, previousWindow, monthEnd } from '@/lib/period'

const d = generateDemoData()
const months = Array.from(new Set(d.pnl.map((r) => r.month))).sort()
const last12 = months.slice(-12)

describe('Demo ma\'lumot izchilligi', () => {
  it('24 oy, barcha jadvallar to\'la', () => {
    expect(months).toHaveLength(24)
    expect(d.products).toHaveLength(40)
    expect(d.customers).toHaveLength(60)
    expect(d.suppliers).toHaveLength(30)
    expect(d.employees).toHaveLength(8)
    expect(d.sales.length).toBeGreaterThan(1000)
  })
  it('Balans har oy tenglashadi (Aktiv = Majburiyat + Kapital)', () => {
    for (const b of d.balance) expect(Math.abs(balanceTotals(b).check)).toBeLessThan(1)
  })
  it('Cashflow yakuniy qoldig\'i = balans puli; opening + oqimlar = closing', () => {
    for (const c of d.cashflow) {
      const b = d.balance.find((x) => x.month === c.month)!
      expect(c.closingCash).toBe(b.cash)
      expect(Math.abs(c.openingCash + ocfOf(c) + icfOf(c) + fcfOf(c) - c.closingCash)).toBeLessThan(1)
    }
  })
  it('Cashflow zanjiri: har oy opening = oldingi closing', () => {
    for (let i = 1; i < d.cashflow.length; i++) expect(d.cashflow[i].openingCash).toBe(d.cashflow[i - 1].closingCash)
  })
  it('OCF bilvosita usul bilan mos: NP + Amort − ΔAR − ΔInv − ΔOtherCA + ΔAP + ΔOtherCL', () => {
    for (let i = 0; i < d.cashflow.length; i++) {
      const c = d.cashflow[i]
      const t = pnlTotals(d.pnl, [c.month])
      const b = d.balance.find((x) => x.month === c.month)!
      const pb = d.balance[d.balance.findIndex((x) => x.month === c.month) - 1]
      const indirect = t.netProfit + t.depreciation - (b.receivables - pb.receivables) - (b.inventory - pb.inventory) - (b.otherCurrentAssets - pb.otherCurrentAssets) + (b.payables - pb.payables) + (b.otherCurrentLiabilities - pb.otherCurrentLiabilities)
      // P&L qatorlari 1000 ga yaxlitlangan → kichik farq ruxsat
      expect(Math.abs(ocfOf(c) - indirect)).toBeLessThan(200_000)
    }
  })
  it('Taqsimlanmagan foyda sof foyda va dividendga mos o\'zgaradi', () => {
    for (let i = 1; i < d.balance.length; i++) {
      const b = d.balance[i], pb = d.balance[i - 1]
      const c = d.cashflow.find((x) => x.month === b.month)!
      const np = pnlTotals(d.pnl, [b.month]).netProfit
      expect(Math.abs(b.retainedEarnings - pb.retainedEarnings - np - c.dividendsPaid)).toBeLessThan(200_000)
    }
  })
  it('Ochiq invoyslar = balans debitorlik; ochiq billar = kreditorlik; zaxira ≈ balans zaxirasi', () => {
    const lb = d.balance[d.balance.length - 1]
    const ar = d.invoices.filter((i) => i.paid < i.amount).reduce((a, i) => a + i.amount - i.paid, 0)
    const ap = d.bills.filter((i) => i.paid < i.amount).reduce((a, i) => a + i.amount - i.paid, 0)
    const inv = d.inventory.reduce((a, i) => a + i.qty * i.unitCost, 0)
    expect(ar).toBe(lb.receivables)
    expect(ap).toBe(lb.payables)
    expect(Math.abs(inv - lb.inventory) / lb.inventory).toBeLessThan(0.0001)
  })
  it('Iqtisodiy mantiq: yalpi marja 25–45%, sof marja > 0 (12 oy)', () => {
    const t = pnlTotals(d.pnl, last12)
    expect(t.grossMargin).toBeGreaterThan(25)
    expect(t.grossMargin).toBeLessThan(45)
    expect(t.netProfit).toBeGreaterThan(0)
  })
  it('Har oy uchun plan mavjud (pnl scope) va nol emas', () => {
    for (const m of months) expect(pnlPlanTotals(d.budget, [m]).revenue).toBeGreaterThan(0)
  })
})

describe('P&L formulalari', () => {
  it('Yalpi = Tushum − COGS; EBITDA = Yalpi − OPEX + boshqa; NP = EBITDA − Amort − Foiz − Soliq', () => {
    const t = pnlTotals(d.pnl, last12)
    expect(t.grossProfit).toBeCloseTo(t.revenue - t.cogs, 3)
    expect(t.ebitda).toBeCloseTo(t.grossProfit - t.opex + t.otherIncome, 3)
    expect(t.netProfit).toBeCloseTo(t.ebitda - t.depreciation - t.interest - t.tax, 3)
    expect(t.netMargin).toBeCloseTo((t.netProfit / t.revenue) * 100, 6)
  })
  it('Waterfall: oxirgi qadam = sof foyda, oraliq yig\'indi mos', () => {
    const t = pnlTotals(d.pnl, last12)
    const steps = pnlWaterfall(t)
    let run = 0
    for (const s of steps) {
      if (s.type === 'total') { expect(Math.abs(run - s.value) < 1 || s.name === 'Tushum').toBe(true); run = s.value } else run += s.value
    }
    expect(steps[steps.length - 1].value).toBeCloseTo(t.netProfit, 3)
  })
  it('Ierarxik daraxt: guruh = moddalar yig\'indisi; modda = elementlar yig\'indisi; subtotal mos', () => {
    const tree = buildPnLTree({ rows: d.pnl, budget: d.budget, months: last12, prevMonths: months.slice(0, 12), prevYearMonths: months.slice(0, 12), ytdMonths: last12.slice(-8), allMonths: months })
    for (const g of tree) {
      if (!g.children) continue
      expect(g.fact).toBeCloseTo(g.children.reduce((a, c) => a + c.fact, 0), 3)
      for (const item of g.children) if (item.children) expect(item.fact).toBeCloseTo(item.children.reduce((a, c) => a + c.fact, 0), 3)
    }
    const np = tree.find((n) => n.id === 'netProfit')!
    expect(np.fact).toBeCloseTo(pnlTotals(d.pnl, last12).netProfit, 3)
    expect(np.pctOfRevenue).toBeCloseTo(pnlTotals(d.pnl, last12).netMargin, 6)
  })
})

describe('Cashflow', () => {
  it('Free CF = OCF − CapEx; sof o\'zgarish = OCF + ICF + FCF; closing = boshlang\'ich + o\'zgarish', () => {
    const t = cfTotals(d.cashflow, last12)
    expect(t.freeCashFlow).toBeCloseTo(t.ocf + t.capex, 3) // capex manfiy saqlanadi
    expect(t.freeCashFlow).toBeLessThan(t.ocf)
    expect(t.netChange).toBeCloseTo(t.ocf + t.icf + t.fcf, 3)
    expect(t.opening + t.netChange).toBeCloseTo(t.closing, 0)
  })
  it('Kunlik seriya oylikka teng; haftalik/oylik agregatlar mos', () => {
    const daily = cashSeries(d.cashflow, d.budget, last12.slice(-2), 'day')
    const monthly = cashSeries(d.cashflow, d.budget, last12.slice(-2), 'month')
    expect(daily[daily.length - 1].balance).toBe(d.cashflow[d.cashflow.length - 1].closingCash)
    expect(monthly[monthly.length - 1].balance).toBe(d.cashflow[d.cashflow.length - 1].closingCash)
    const weekly = cashSeries(d.cashflow, d.budget, last12.slice(-2), 'week')
    expect(weekly.reduce((a, w) => a + w.net, 0)).toBeCloseTo(daily.reduce((a, p) => a + p.net, 0), 3)
  })
})

describe('Koeffitsiyentlar', () => {
  it('CCC = DIO + DSO − DPO; likvidlik ta\'riflari', () => {
    const s = ratioSnapshot(d.balance, d.pnl, last12)
    expect(s.ccc).toBeCloseTo(s.dio + s.dso - s.dpo, 6)
    const b = d.balance[d.balance.length - 1]
    const t = balanceTotals(b)
    expect(s.currentRatio).toBeCloseTo(t.currentAssets / t.currentLiabilities, 6)
    expect(s.quickRatio).toBeCloseTo((t.currentAssets - b.inventory) / t.currentLiabilities, 6)
    expect(s.cashRatio).toBeCloseTo(b.cash / t.currentLiabilities, 6)
    expect(s.gearing).toBeCloseTo((b.shortTermDebt + b.longTermDebt) / t.equity, 6)
    expect(s.dso).toBeGreaterThan(20); expect(s.dso).toBeLessThan(70)
  })
  it('12 ta karta, hech biri NaN emas, norma/target mavjud', () => {
    const cards = computeRatioCards({ balance: d.balance, pnl: d.pnl, months: last12, allMonths: months, targets: d.kpiTargets })
    expect(cards).toHaveLength(12)
    for (const c of cards) {
      expect(Number.isFinite(c.value)).toBe(true)
      expect(Number.isFinite(c.prev)).toBe(true)
      expect(c.series.every(Number.isFinite)).toBe(true)
      expect(c.normMax).toBeGreaterThan(c.normMin)
      expect(c.explain.length).toBeGreaterThan(10)
    }
  })
  it('1 oylik davrda ham hisoblanadi (annualizatsiya)', () => {
    const s = ratioSnapshot(d.balance, d.pnl, [months[months.length - 1]])
    expect(Number.isFinite(s.roe)).toBe(true)
    expect(Math.abs(s.roe)).toBeLessThan(200)
  })
})

describe('ABC/XYZ', () => {
  it('Chegaralar: A ≤ 80% kumulyativ, XYZ CV 10/25', () => {
    expect(xyzOf(9.9)).toBe('X'); expect(xyzOf(10)).toBe('Y'); expect(xyzOf(25)).toBe('Y'); expect(xyzOf(25.1)).toBe('Z')
    const rows = classifyAbcXyz([
      { id: 'a', name: 'a', monthly: [50, 50, 50] }, { id: 'b', name: 'b', monthly: [30, 30, 30] },
      { id: 'c', name: 'c', monthly: [15, 15, 15] }, { id: 'd', name: 'd', monthly: [5, 5, 5] },
    ])
    expect(rows.map((r) => r.abc)).toEqual(['A', 'A', 'B', 'C'])
    expect(rows[3].cumShare).toBeCloseTo(100, 6)
    expect(rows.every((r) => r.xyz === 'X')).toBe(true)
  })
  it('Bo\'sh va nol qiymatlarda NaN yo\'q', () => {
    const rows = classifyAbcXyz([{ id: 'z', name: 'z', monthly: [0, 0, 0] }])
    expect(rows[0].share).toBe(0); expect(rows[0].cv).toBe(0)
    expect(cv([])).toBe(0); expect(cv([0, 0])).toBe(0)
  })
})

describe('Aging / DSO / to\'lov taqvimi', () => {
  it('Bucketlar va yig\'indilar', () => {
    const asOf = '2026-08-31'
    expect(bucketOf({ id: '1', partyId: 'c', issueDate: '2026-08-01', dueDate: '2026-09-05', amount: 10, paid: 0, paidDate: null }, asOf)).toBe('Kelmagan')
    expect(bucketOf({ id: '1', partyId: 'c', issueDate: '2026-07-01', dueDate: '2026-08-10', amount: 10, paid: 0, paidDate: null }, asOf)).toBe('0–30')
    expect(bucketOf({ id: '1', partyId: 'c', issueDate: '2026-05-01', dueDate: '2026-05-01', amount: 10, paid: 0, paidDate: null }, asOf)).toBe('90+')
    const s = agingSummary(d.invoices.map(fromInvoice), monthEnd('2026-08'), (id) => ({ name: id }))
    expect(s.total).toBe(d.balance[d.balance.length - 1].receivables)
    expect(s.overdue + s.notDue).toBeCloseTo(s.total, 3)
    expect(s.bucketRows.reduce((a, b) => a + b.share, 0)).toBeCloseTo(100, 6)
    expect(Number.isFinite(s.avgDelayDays)).toBe(true)
    expect(s.top3Share).toBeGreaterThan(0)
  })
  it('To\'lov taqvimi 30 kun, kumulyativ o\'sadi', () => {
    const cal = paymentCalendar(d.bills.map(fromBill), monthEnd('2026-08'), 1_000_000_000, 500_000_000, 30, 100_000_000)
    expect(cal).toHaveLength(30)
    for (let i = 1; i < cal.length; i++) expect(cal[i].cumulative).toBeGreaterThanOrEqual(cal[i - 1].cumulative)
    expect(cal.reduce((a, c) => a + c.due, 0)).toBeGreaterThan(0)
  })
})

describe('Byudjet', () => {
  it('Performance: daromad fakt/plan; xarajat plan/fakt; nolga bo\'lish himoyasi', () => {
    expect(performanceOf(110, 100, false)).toBeCloseTo(110)
    expect(performanceOf(110, 100, true)).toBeCloseTo(90.909, 2)
    expect(performanceOf(0, 0, false)).toBe(100)
    expect(performanceOf(50, 0, false)).toBe(0)
    expect(performanceOf(0, 50, true)).toBe(100)
  })
  it('Variance waterfall: plan → fakt sof foyda', () => {
    const tree = budgetTree(d.pnl, d.budget, last12)
    const steps = varianceWaterfall(tree, 8)
    const plan = steps[0].value, fact = steps[steps.length - 1].value
    const mid = steps.slice(1, -1).reduce((a, s) => a + s.value, 0)
    expect(plan + mid).toBeCloseTo(fact, 0)
    expect(fact).toBeCloseTo(pnlTotals(d.pnl, last12).netProfit, 0)
  })
})

describe('BEP / Sensitivity', () => {
  it('BEP formulalari standart ta\'rifga mos', () => {
    const base = bepBase(d.pnl, d.sales, last12)
    const r = bepCompute(base)
    expect(r.bepUnits).toBeCloseTo(base.fixedCosts / (base.price - base.varCostPerUnit), 6)
    expect(r.bepRevenue).toBeCloseTo(base.fixedCosts / r.contributionMarginRatio, 3)
    expect(r.marginOfSafetyPct).toBeCloseTo(((base.revenue - r.bepRevenue) / base.revenue) * 100, 6)
    expect(r.marginOfSafetyPct).toBeGreaterThan(0)
    const t = pnlTotals(d.pnl, last12)
    expect(r.profit).toBeCloseTo(t.ebt - t.otherIncome, -3) // BEP boshqa daromad va soliqni hisobga olmaydi
  })
  it('Sensitivity: narx +10% foydani oshiradi; tornado 4 omil', () => {
    const base = bepBase(d.pnl, d.sales, last12)
    const r0 = bepCompute(base)
    const r1 = applySensitivity(base, { price: 10, volume: 0, varCost: 0, fixedCost: 0 })
    expect(r1.profit).toBeGreaterThan(r0.profit)
    const t = tornado(base, 20)
    expect(t).toHaveLength(4)
    expect(t[0].swing).toBeGreaterThanOrEqual(t[3].swing)
  })
  it('Nol hajmda cheksizlik yo\'q', () => {
    const r = bepCompute({ units: 0, revenue: 0, price: 0, variableCosts: 0, varCostPerUnit: 0, fixedCosts: 100 })
    expect(Number.isFinite(r.bepUnits)).toBe(true)
    expect(Number.isFinite(r.marginOfSafetyPct)).toBe(true)
  })
})

describe('Yordamchilar', () => {
  it('safeDiv/fin/format', () => {
    expect(safeDiv(1, 0)).toBe(0); expect(fin(NaN)).toBe(0); expect(fin(Infinity, 5)).toBe(5)
    // standart til — o'zbekcha: mlrd / mln / ming, o'nlik ajratgich — vergul
    expect(fmtMoney(1_234_567_890)).toBe('1,23 mlrd'); expect(fmtMoney(450_300_000)).toBe('450,3 mln'); expect(fmtMoney(12_500)).toBe('12,5 ming')
    expect(fmtMoney(-1_000_000)).toBe('−1 mln'); expect(fmtMoney(1_000_000, { currency: 'USD' })).toBe('$78')
    expect(fmtMoney(999_960_000)).toBe('1 mlrd'); expect(fmtMoney(2_500_000_000_000)).toBe('2,5 trln')
    expect(fmtPct(12.345)).toBe('12,3%'); expect(fmtPct(NaN)).toBe('0,0%')
  })
  it('birliklar va ajratgichlar tilga mos (uz / ru / en)', () => {
    const at = (language: Language, fn: () => string) => { useLanguageStore.setState({ language }); try { return fn() } finally { useLanguageStore.setState({ language: 'uz' }) } }
    expect(at('ru', () => fmtMoney(1_234_567_890))).toBe('1,23 млрд')
    expect(at('ru', () => fmtMoney(12_500))).toBe('12,5 тыс.')
    expect(at('en', () => fmtMoney(1_234_567_890))).toBe('1.23B')
    expect(at('en', () => fmtMoney(-450_300_000))).toBe('−450.3M')
    expect(at('en', () => fmtNum(1234567.5, 1))).toBe('1,234,567.5')
    expect(at('ru', () => fmtNum(1234567.5, 1))).toBe('1 234 567,5')
    expect(fmtNum(1234567.5, 1)).toBe('1 234 567,5')
    expect(at('en', () => fmtPct(-12.345))).toBe('−12.3%')
    expect(fmtRatio(1.854)).toBe('1,85×')
    expect(fmtCompactNum(478_000)).toBe('478 ming')
    expect(at('en', () => fmtCompactNum(1_234_000))).toBe('1.2M')
  })
  it('Davr oynalari', () => {
    const m = monthsInRange(months, { asOf: '2026-08', range: '3m' })
    expect(m).toEqual(['2026-06', '2026-07', '2026-08'])
    expect(previousWindow(months, m)).toEqual(['2026-03', '2026-04', '2026-05'])
    expect(monthsInRange(months, { asOf: '2026-08', range: 'ytd' })).toHaveLength(8)
  })
})
