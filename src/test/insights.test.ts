import { describe, expect, it } from 'vitest'
import { CURRENT_PERIOD, generateDemoData } from '@/data/seed'
import {
  cashForecast13w, cfTotals, coverageBalance, marginBridge, opexByCfu, pnlTotals, productCoverage, profitByChannel, profitToCashBridge, purchasePriceVariance,
  revenueYoY, runway, salesStats, stockAgeByCategory, supplierScores, inventoryRows, topOverdueDebtors, yearEndForecast,
  type WaterfallStep,
} from '@/lib/finance'
import { addDays, monthEnd } from '@/lib/period'
import { allMonthsOf } from '@/store/useDataStore'
import type { CashflowMonth, InventoryItem, Product, SaleTx } from '@/types'

const d = generateDemoData()
const upTo = allMonthsOf(d).filter((m) => m <= CURRENT_PERIOD)
const last12 = upTo.slice(-12)
const prev12 = upTo.slice(-24, -12)
const steps = (s: WaterfallStep[]) => s.filter((x) => x.type !== 'total').reduce((a, x) => a + x.value, 0)
const byName = (s: WaterfallStep[]) => Object.fromEntries(s.map((x) => [x.name, x.value]))

const product = (id: string, category: string): Product => ({ id, name: id, category, price: 10, unitCost: 5, supplierId: 'S1' })
const sale = (i: number, productId: string, month: string, qty: number, cogs: number): SaleTx =>
  ({ id: `T${productId}${month}${i}`, date: `${month}-15`, month, productId, customerId: 'C1', employeeId: 'E1', qty, price: 10, revenue: qty * 10, cogs })

describe("Foyda → pul ko'prigi", () => {
  it("qadamlar zanjiri: sof foyda → operatsion oqim → pul o'zgarishi (cashflow bilan aniq mos)", () => {
    const b = byName(profitToCashBridge(d, last12))
    expect(b['Sof foyda']).toBeCloseTo(pnlTotals(d.pnl, last12).netProfit, 0)
    expect(b['Sof foyda'] + b.Amortizatsiya + b.Debitorlik + b.Zaxira + b.Kreditorlik + b['Boshqa aylanma']).toBeCloseTo(b['Operatsion oqim'], 0)
    expect(b['Operatsion oqim'] + b.Investitsiyalar + b['Kreditlar (sof)'] + b.Dividendlar).toBeCloseTo(b["Pul o'zgarishi"], 0)
    expect(b["Pul o'zgarishi"]).toBeCloseTo(cfTotals(d.cashflow, last12).netChange, 0)
  })
  it("bo'sh davr → bo'sh ko'prik", () => expect(profitToCashBridge(d, [])).toEqual([]))
})

describe("Marja ko'prigi (hajm / narx / tannarx)", () => {
  it("o'tgan yalpi foyda + effektlar = joriy yalpi foyda", () => {
    const mb = marginBridge(d.sales, last12, prev12)
    expect(mb[0].value + steps(mb)).toBeCloseTo(mb[mb.length - 1].value, 0)
    expect(mb[mb.length - 1].value).toBeCloseTo(salesStats(d.sales, last12).grossProfit, 0)
  })
  it("oldingi davr yo'q → bo'sh", () => expect(marginBridge(d.sales, last12, [])).toEqual([]))
})

describe('Pul: prognoz va runway', () => {
  it('13 hafta, koridor qoldiqni o‘rab turadi, qiymatlar chekli', () => {
    const fc = cashForecast13w(d.cashflow, upTo, 1_000_000_000)
    expect(fc.weeks).toHaveLength(13)
    for (const w of fc.weeks) {
      expect(Number.isFinite(w.balance)).toBe(true)
      expect(w.low).toBeLessThanOrEqual(w.balance)
      expect(w.high).toBeGreaterThanOrEqual(w.balance)
    }
    expect(cashForecast13w(d.cashflow, [], 5).weeks).toEqual([])
  })
  it("runway: oyiga 100 chiqim, qoldiq 500 → 5 oy; musbat oqimda — cheklanmagan", () => {
    const burn: CashflowMonth = {
      month: '2026-01', openingCash: 0, receiptsFromCustomers: 0, otherOperatingReceipts: 0, paidToSuppliers: -100, salariesPaid: 0, opexPaid: 0, taxesPaid: 0, interestPaid: 0,
      capex: 0, assetSales: 0, loansReceived: 0, loansRepaid: 0, dividendsPaid: 0, closingCash: 0,
    }
    const r = runway([burn], ['2026-01'], 500)
    expect(r.months).toBeCloseTo(5)
    expect(r.coverDays).toBeCloseTo(155)
    expect(runway([{ ...burn, receiptsFromCustomers: 300 }], ['2026-01'], 500).months).toBeNull()
  })
})

describe('Xarajat va savdo kesimlari', () => {
  it("OPEX markazlari (CFU): ulushlar 100%, jami = P&L OPEX", () => {
    const cfu = opexByCfu(d.pnl, last12)
    expect(cfu.reduce((a, c) => a + c.share, 0)).toBeCloseTo(100, 5)
    expect(cfu.reduce((a, c) => a + c.value, 0)).toBeCloseTo(pnlTotals(d.pnl, last12).opex, 0)
    expect(cfu.map((c) => c.cfu)).not.toContain('Boshqa')
  })
  it('savdo kanallari: jami tushum = sotuv tranzaksiyalari', () => {
    expect(profitByChannel(d, last12).reduce((a, c) => a + c.revenue, 0)).toBeCloseTo(salesStats(d.sales, last12).revenue, 0)
  })
  it('PPV: tannarx 5 → 6 (20%), ta’sir = 1 × joriy hajm', () => {
    const r = purchasePriceVariance([sale(1, 'P1', '2026-01', 10, 50), sale(2, 'P1', '2026-02', 4, 24)], [product('P1', 'K')], ['2026-02'], ['2026-01'])
    expect(r.rows[0].changePct).toBeCloseTo(20)
    expect(r.total).toBeCloseTo(4)
    expect(r.pct).toBeCloseTo(20)
  })
  it("yetkazib beruvchi reytingi 0–100 oralig'ida", () => {
    for (const s of supplierScores(d, last12, prev12)) expect(s.score).toBeGreaterThanOrEqual(0), expect(s.score).toBeLessThanOrEqual(100)
  })
})

describe('Zaxira', () => {
  it("ta'minlanganlik: kuniga 1 dona, qoldiq 10 → 10 kun; sotuvsiz SKU — to'liq ortiqcha", () => {
    const asOf = '2026-08-31'
    const inv: InventoryItem[] = [{ productId: 'P1', qty: 10, unitCost: 5, lastMovementDate: '2026-08-01' }, { productId: 'P2', qty: 4, unitCost: 2, lastMovementDate: '2026-01-01' }]
    const sales = Array.from({ length: 90 }, (_, i) => { const date = addDays(asOf, -i); return { ...sale(i, 'P1', date.slice(0, 7), 1, 5), date } })
    const cov = productCoverage(inv, [product('P1', 'K1'), product('P2', 'K1')], sales, asOf)
    expect(cov.find((r) => r.productId === 'P1')?.coverageDays).toBeCloseTo(10)
    expect(cov.find((r) => r.productId === 'P2')?.coverageDays).toBeNull()
    expect(coverageBalance(cov, 30, 60)).toEqual([{ category: 'K1', deficit: 100, excess: 8, deficitCount: 1, excessCount: 1 }])
  })
  it("zaxira yoshi: oraliqlar yig'indisi = kategoriya jami", () => {
    const rows = stockAgeByCategory(inventoryRows(d.inventory, d.products, d.pnl, last12, monthEnd(CURRENT_PERIOD)))
    for (const r of rows) expect(Object.values(r.buckets).reduce((a, v) => a + v, 0)).toBeCloseTo(r.total, 0)
  })
})

describe("O'sish va yil prognozi", () => {
  it('yil oxiri = YTD fakt + qolgan oylar prognozi; 12 nuqta', () => {
    const y = yearEndForecast(d.pnl, d.budget, upTo, CURRENT_PERIOD)
    expect(y.points).toHaveLength(12)
    expect(y.points.reduce((a, p) => a + (p.actual ?? 0), 0)).toBeCloseTo(y.ytdActual, 0)
    expect(y.yearEnd).toBeCloseTo(y.ytdActual + y.points.reduce((a, p) => a + (p.forecast ?? 0), 0), 0)
  })
  it("YoY: o'sish = (joriy − o'tgan yil) / o'tgan yil", () => {
    for (const r of revenueYoY(d.pnl, upTo)) if (r.revenueLy) expect(r.growth).toBeCloseTo(((r.revenue - r.revenueLy) / r.revenueLy) * 100, 6)
  })
  it("muddati o'tgan debitorlar: ko'pi bilan 20, kamayish tartibida, mas'ul bilan", () => {
    const rows = topOverdueDebtors(d, monthEnd(CURRENT_PERIOD))
    expect(rows.length).toBeLessThanOrEqual(20)
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].overdue).toBeGreaterThanOrEqual(rows[i].overdue)
    for (const r of rows) expect(r.owner).not.toBe('')
  })
})
