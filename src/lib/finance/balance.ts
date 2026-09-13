import type { BalanceMonth, PnLRow, MonthKey, KpiTarget, InventoryItem, Product, KpiUnit } from '@/types'
import { safeDiv, fin, mean } from '@/lib/utils'
import { addMonths, diffDays, daysInMonth } from '@/lib/period'
import { pnlTotals } from './pnl'

export interface BalanceTotals {
  currentAssets: number
  nonCurrentAssets: number
  totalAssets: number
  currentLiabilities: number
  nonCurrentLiabilities: number
  totalLiabilities: number
  equity: number
  totalLiabEquity: number
  totalDebt: number
  workingCapital: number
  /** Aktiv − (Majburiyat + Kapital); 0 bo'lishi kerak */
  check: number
}

export const EMPTY_BALANCE: BalanceMonth = {
  month: '', cash: 0, receivables: 0, inventory: 0, otherCurrentAssets: 0, fixedAssetsNet: 0, intangibles: 0,
  payables: 0, shortTermDebt: 0, otherCurrentLiabilities: 0, longTermDebt: 0, shareCapital: 0, retainedEarnings: 0,
}

export function balanceAt(balance: BalanceMonth[], month: MonthKey): BalanceMonth {
  const exact = balance.find((b) => b.month === month)
  if (exact) return exact
  // eng yaqin oldingi oy
  const before = balance.filter((b) => b.month <= month).sort((a, b) => b.month.localeCompare(a.month))[0]
  return before ?? balance.slice().sort((a, b) => a.month.localeCompare(b.month))[0] ?? EMPTY_BALANCE
}

export function balanceTotals(b: BalanceMonth): BalanceTotals {
  const currentAssets = fin(b.cash) + fin(b.receivables) + fin(b.inventory) + fin(b.otherCurrentAssets)
  const nonCurrentAssets = fin(b.fixedAssetsNet) + fin(b.intangibles)
  const totalAssets = currentAssets + nonCurrentAssets
  const currentLiabilities = fin(b.payables) + fin(b.shortTermDebt) + fin(b.otherCurrentLiabilities)
  const nonCurrentLiabilities = fin(b.longTermDebt)
  const totalLiabilities = currentLiabilities + nonCurrentLiabilities
  const equity = fin(b.shareCapital) + fin(b.retainedEarnings)
  return {
    currentAssets, nonCurrentAssets, totalAssets, currentLiabilities, nonCurrentLiabilities, totalLiabilities, equity,
    totalLiabEquity: totalLiabilities + equity, totalDebt: fin(b.shortTermDebt) + fin(b.longTermDebt),
    workingCapital: currentAssets - currentLiabilities, check: totalAssets - totalLiabilities - equity,
  }
}

export type RatioStatus = 'good' | 'warn' | 'bad'

export interface RatioSub { label: string; value: number; unit: KpiUnit }

export interface RatioCard {
  key: string
  label: string
  unit: KpiUnit
  value: number
  prev: number
  /** taqqoslama davri bor-yo'qligi (yo'q bo'lsa ▲/▼ ko'rsatilmaydi) */
  hasPrev: boolean
  series: number[]
  target: number
  normMin: number
  normMax: number
  lowerIsBetter: boolean
  status: RatioStatus
  explain: string
  /** izoh shabloni ({v}) va qiymatlari — sahifada t(explainKey, explainValues) bilan tarjima qilinadi */
  explainKey: string
  explainValues: Record<string, string>
  formula: string
  sub?: RatioSub[]
}

export function ratioStatus(value: number, t: { normMin: number; normMax: number; lowerIsBetter: boolean }): RatioStatus {
  const v = fin(value)
  if (v >= t.normMin && v <= t.normMax) return 'good'
  const span = Math.max(1e-9, t.normMax - t.normMin)
  const dist = v < t.normMin ? t.normMin - v : v - t.normMax
  // norma tashqarisida, lekin "to'g'ri" tomonda (pastroq yaxshi bo'lsa, past qiymat) → sariq
  if ((t.lowerIsBetter && v < t.normMin) || (!t.lowerIsBetter && v > t.normMax)) return 'warn'
  return dist / span <= 0.25 ? 'warn' : 'bad'
}

export interface RatioInputs {
  balance: BalanceMonth[]
  pnl: PnLRow[]
  months: MonthKey[] // tanlangan davr (oylar)
  allMonths: MonthKey[]
  targets: KpiTarget[]
  /** taqqoslama oynasi (global filtr: oldingi davr / o'tgan yil / yo'q); berilmasa — oldingi teng oyna */
  prevMonths?: MonthKey[]
}

interface Snapshot {
  roe: number; roa: number; dio: number; dpo: number; dso: number; ccc: number
  currentRatio: number; quickRatio: number; cashRatio: number; gearing: number
  grossMargin: number; opMargin: number; netMargin: number; altmanZ: number; interestCoverage: number
}

/** Bir davr uchun barcha koeffitsiyentlar (annualizatsiya: davr × 12/n). */
export function ratioSnapshot(balance: BalanceMonth[], pnl: PnLRow[], months: MonthKey[]): Snapshot {
  const sorted = months.slice().sort()
  const n = Math.max(1, sorted.length)
  const last = sorted[sorted.length - 1] ?? ''
  const first = sorted[0] ?? ''
  const bEnd = balanceAt(balance, last)
  const bStart = balanceAt(balance, addMonths(first, -1))
  const tEnd = balanceTotals(bEnd), tStart = balanceTotals(bStart)
  const t = pnlTotals(pnl, sorted)
  const days = sorted.reduce((a, m) => a + daysInMonth(m), 0) || 30
  const ann = 12 / n
  const avgEquity = mean([tStart.equity, tEnd.equity])
  const avgAssets = mean([tStart.totalAssets, tEnd.totalAssets])
  const avgInv = mean([fin(bStart.inventory), fin(bEnd.inventory)])
  const avgAR = mean([fin(bStart.receivables), fin(bEnd.receivables)])
  const avgAP = mean([fin(bStart.payables), fin(bEnd.payables)])
  const dio = safeDiv(avgInv, t.cogs) * days
  const dso = safeDiv(avgAR, t.revenue) * days
  const dpo = safeDiv(avgAP, t.cogs) * days
  const ebitAnn = t.ebit * ann, salesAnn = t.revenue * ann
  const altmanZ = tEnd.totalAssets > 0
    ? 0.717 * safeDiv(tEnd.workingCapital, tEnd.totalAssets) + 0.847 * safeDiv(fin(bEnd.retainedEarnings), tEnd.totalAssets)
      + 3.107 * safeDiv(ebitAnn, tEnd.totalAssets) + 0.42 * safeDiv(tEnd.equity, tEnd.totalLiabilities) + 0.998 * safeDiv(salesAnn, tEnd.totalAssets)
    : 0
  return {
    roe: safeDiv(t.netProfit * ann, avgEquity) * 100,
    roa: safeDiv(t.netProfit * ann, avgAssets) * 100,
    dio, dpo, dso, ccc: dio + dso - dpo,
    currentRatio: safeDiv(tEnd.currentAssets, tEnd.currentLiabilities),
    quickRatio: safeDiv(tEnd.currentAssets - fin(bEnd.inventory), tEnd.currentLiabilities),
    cashRatio: safeDiv(fin(bEnd.cash), tEnd.currentLiabilities),
    gearing: safeDiv(tEnd.totalDebt, tEnd.equity),
    grossMargin: t.grossMargin, opMargin: t.opMargin, netMargin: t.netMargin,
    altmanZ, interestCoverage: safeDiv(t.ebit, t.interest, t.ebit > 0 ? 99 : 0),
  }
}

/** Izoh — o'zbekcha shablon ({v}) va qiymatlar: sahifada t(shablon, qiymatlar) orqali tanlangan tilga o'giriladi. */
const EXPLAIN: Record<string, { explain: (v: number, s: RatioStatus) => [string, Record<string, string>]; formula: string }> = {
  roe: { formula: 'Sof foyda (yillik) / O\'rtacha kapital', explain: (v) => ["Har 100 so'm kapital yiliga {v} so'm foyda keltiryapti.", { v: v.toFixed(0) }] },
  roa: { formula: 'Sof foyda (yillik) / O\'rtacha aktivlar', explain: (v) => ["Aktivlarning har 100 so'mi yiliga {v} so'm foyda beradi.", { v: v.toFixed(0) }] },
  dio: { formula: 'O\'rtacha zaxira / COGS × kunlar', explain: (v) => ["Tovar omborda o'rtacha {v} kun turadi — qancha kam, shuncha pul tez aylanadi.", { v: v.toFixed(0) }] },
  dpo: { formula: 'O\'rtacha kreditorlik / COGS × kunlar', explain: (v) => ["Yetkazib beruvchilarga o'rtacha {v} kunda to'laymiz.", { v: v.toFixed(0) }] },
  dso: { formula: 'O\'rtacha debitorlik / Tushum × kunlar', explain: (v) => ["Mijozlar o'rtacha {v} kunda to'laydi.", { v: v.toFixed(0) }] },
  ccc: { formula: 'DIO + DSO − DPO', explain: (v) => ['Pul tovar → sotuv → tushumga {v} kunda qaytadi.', { v: v.toFixed(0) }] },
  currentRatio: { formula: 'Joriy aktivlar / Joriy majburiyatlar', explain: (v) => ["Har 1 so'm qisqa qarzga {v} so'm joriy aktiv to'g'ri keladi.", { v: v.toFixed(2) }] },
  quickRatio: { formula: '(Joriy aktivlar − Zaxira) / Joriy majburiyatlar', explain: (v) => ['Zaxirasiz ham qarzning {v}% ini yopa olamiz.', { v: (v * 100).toFixed(0) }] },
  gearing: { formula: 'Jami qarz / Kapital', explain: (v) => ["Har 1 so'm o'z kapitaliga {v} so'm qarz to'g'ri keladi.", { v: v.toFixed(2) }] },
  profitability: { formula: 'Yalpi / Operatsion / Sof foyda ÷ Tushum', explain: (v) => ['Tushumning {v}% i sof foyda sifatida qoladi.', { v: v.toFixed(1) }] },
  liquidity: { formula: 'Joriy / Tezkor / Mutlaq likvidlik', explain: (v) => ['Mutlaq likvidlik {v}: naqd pul qisqa qarzning {p}% ini yopadi.', { v: v.toFixed(2), p: (v * 100).toFixed(0) }] },
  risk: { formula: 'Altman Z\' (xususiy) va EBIT / Foizlar', explain: (v) => [v >= 2.9 ? 'Z-score xavfsiz zonada — bankrotlik xavfi past.' : v >= 1.23 ? 'Z-score kulrang zonada — kuzatib borish kerak.' : 'Z-score xavfli zonada — moliyaviy barqarorlik xavf ostida.', {}] },
}

function explainOf(key: string, value: number, status: RatioStatus) {
  const [explainKey, explainValues] = EXPLAIN[key].explain(value, status)
  return { explain: explainKey.replace(/\{(\w+)\}/g, (match, name: string) => explainValues[name] ?? match), explainKey, explainValues }
}

/** 12 ta koeffitsiyent kartasi (3 tasi kompozit). */
export function computeRatioCards(inp: RatioInputs): RatioCard[] {
  const { balance, pnl, months, allMonths, targets } = inp
  const sorted = months.slice().sort()
  const n = sorted.length || 1
  const prevMonths = inp.prevMonths ?? allMonths.filter((m) => m < (sorted[0] ?? '')).slice(-n)
  const cur = ratioSnapshot(balance, pnl, sorted)
  const prev = prevMonths.length ? ratioSnapshot(balance, pnl, prevMonths) : null
  const all = allMonths.slice().sort()
  const last = sorted[sorted.length - 1] ?? all[all.length - 1] ?? ''
  const upTo = all.filter((m) => m <= last).slice(-12)
  const seriesFor = (k: keyof Snapshot) => upTo.map((m) => fin(ratioSnapshot(balance, pnl, [m])[k]))
  const tgt = (key: string, fallback: KpiTarget): KpiTarget => targets.find((t) => t.key === key) ?? fallback
  const fb = (key: string, label: string, unit: KpiUnit, target: number, normMin: number, normMax: number, lowerIsBetter: boolean): KpiTarget =>
    ({ key, label, unit, target, normMin, normMax, lowerIsBetter })

  const card = (key: keyof Snapshot | 'profitability' | 'liquidity' | 'risk', label: string, unit: KpiUnit, tk: KpiTarget, valueKey: keyof Snapshot, sub?: RatioSub[]): RatioCard => {
    const value = fin(cur[valueKey])
    const status = ratioStatus(value, tk)
    return {
      key, label, unit, value, prev: prev ? fin(prev[valueKey]) : value, hasPrev: prev !== null, series: seriesFor(valueKey),
      target: tk.target, normMin: tk.normMin, normMax: tk.normMax, lowerIsBetter: tk.lowerIsBetter, status,
      ...explainOf(key, value, status), formula: EXPLAIN[key].formula, sub,
    }
  }

  return [
    card('roe', 'ROE', 'pct', tgt('roe', fb('roe', 'ROE', 'pct', 28, 20, 40, false)), 'roe'),
    card('roa', 'ROA', 'pct', tgt('roa', fb('roa', 'ROA', 'pct', 15, 10, 25, false)), 'roa'),
    card('dio', 'Zaxira kunlari (DIO)', 'days', tgt('dio', fb('dio', 'DIO', 'days', 60, 45, 70, true)), 'dio'),
    card('dpo', 'Kreditorlik kunlari (DPO)', 'days', tgt('dpo', fb('dpo', 'DPO', 'days', 42, 35, 55, false)), 'dpo'),
    card('dso', 'Debitorlik kunlari (DSO)', 'days', tgt('dso', fb('dso', 'DSO', 'days', 38, 30, 45, true)), 'dso'),
    card('ccc', 'Pul aylanish sikli (CCC)', 'days', tgt('ccc', fb('ccc', 'CCC', 'days', 55, 30, 65, true)), 'ccc'),
    card('currentRatio', 'Joriy likvidlik', 'ratio', tgt('currentRatio', fb('currentRatio', 'Current', 'ratio', 1.8, 1.5, 2.5, false)), 'currentRatio'),
    card('quickRatio', 'Tezkor likvidlik', 'ratio', tgt('quickRatio', fb('quickRatio', 'Quick', 'ratio', 1.0, 0.8, 1.5, false)), 'quickRatio'),
    card('gearing', 'Gearing (Qarz/Kapital)', 'ratio', tgt('gearing', fb('gearing', 'Gearing', 'ratio', 0.4, 0, 0.7, true)), 'gearing'),
    card('profitability', 'Rentabellik', 'pct', tgt('netMargin', fb('netMargin', 'Sof marja', 'pct', 7.5, 5, 12, false)), 'netMargin', [
      { label: 'Yalpi', value: cur.grossMargin, unit: 'pct' }, { label: 'Operatsion', value: cur.opMargin, unit: 'pct' }, { label: 'Sof', value: cur.netMargin, unit: 'pct' },
    ]),
    card('liquidity', 'Likvidlik', 'ratio', tgt('cashRatio', fb('cashRatio', 'Cash ratio', 'ratio', 0.3, 0.2, 0.6, false)), 'cashRatio', [
      { label: 'Joriy', value: cur.currentRatio, unit: 'ratio' }, { label: 'Tezkor', value: cur.quickRatio, unit: 'ratio' }, { label: 'Mutlaq', value: cur.cashRatio, unit: 'ratio' },
    ]),
    card('risk', 'Risk', 'score', tgt('altmanZ', fb('altmanZ', 'Altman Z', 'score', 3, 2.9, 10, false)), 'altmanZ', [
      { label: 'Altman Z', value: cur.altmanZ, unit: 'score' }, { label: 'Foiz qoplash', value: cur.interestCoverage, unit: 'ratio' },
    ]),
  ]
}

export interface InventoryCategoryRow {
  category: string
  value: number
  qty: number
  items: number
  turnoverDays: number
  idleValue: number // 90+ kun harakatsiz
  idleItems: number
  share: number
}

export function inventoryByCategory(inventory: InventoryItem[], products: Product[], pnl: PnLRow[], months: MonthKey[], asOf: string): InventoryCategoryRow[] {
  const byCat: Record<string, InventoryCategoryRow> = {}
  const sorted = months.slice().sort()
  const days = sorted.reduce((a, m) => a + daysInMonth(m), 0) || 30
  for (const it of inventory) {
    const p = products.find((x) => x.id === it.productId)
    const cat = p?.category ?? 'Boshqa'
    const row = (byCat[cat] ||= { category: cat, value: 0, qty: 0, items: 0, turnoverDays: 0, idleValue: 0, idleItems: 0, share: 0 })
    const value = fin(it.qty) * fin(it.unitCost)
    row.value += value; row.qty += fin(it.qty); row.items += 1
    if (diffDays(asOf, it.lastMovementDate) > 90) { row.idleValue += value; row.idleItems += 1 }
  }
  const total = Object.values(byCat).reduce((a, r) => a + r.value, 0)
  for (const row of Object.values(byCat)) {
    const cogs = pnl.filter((r) => r.group === 'cogs' && r.item === 'Tovar tannarxi' && r.element === row.category && sorted.includes(r.month)).reduce((a, r) => a + fin(r.amount), 0)
    row.turnoverDays = safeDiv(row.value, cogs) * days
    row.share = safeDiv(row.value, total) * 100
  }
  return Object.values(byCat).sort((a, b) => b.value - a.value)
}

export interface InventoryProductRow { productId: string; name: string; category: string; qty: number; unitCost: number; value: number; idleDays: number; turnoverDays: number }

export function inventoryRows(inventory: InventoryItem[], products: Product[], pnl: PnLRow[], months: MonthKey[], asOf: string): InventoryProductRow[] {
  const sorted = months.slice().sort()
  const days = sorted.reduce((a, m) => a + daysInMonth(m), 0) || 30
  const catCogs: Record<string, number> = {}
  const catValue: Record<string, number> = {}
  for (const r of pnl) if (r.group === 'cogs' && r.item === 'Tovar tannarxi' && sorted.includes(r.month)) catCogs[r.element] = (catCogs[r.element] || 0) + fin(r.amount)
  for (const it of inventory) { const p = products.find((x) => x.id === it.productId); const c = p?.category ?? 'Boshqa'; catValue[c] = (catValue[c] || 0) + fin(it.qty) * fin(it.unitCost) }
  return inventory.map((it) => {
    const p = products.find((x) => x.id === it.productId)
    const category = p?.category ?? 'Boshqa'
    const value = fin(it.qty) * fin(it.unitCost)
    // mahsulot aylanishi: kategoriya COGS ni qiymat ulushiga qarab taqsimlash
    const share = safeDiv(value, catValue[category] || 0)
    const cogs = (catCogs[category] || 0) * share
    return { productId: it.productId, name: p?.name ?? it.productId, category, qty: fin(it.qty), unitCost: fin(it.unitCost), value, idleDays: Math.max(0, diffDays(asOf, it.lastMovementDate)), turnoverDays: safeDiv(value, cogs) * days }
  }).sort((a, b) => b.value - a.value)
}
