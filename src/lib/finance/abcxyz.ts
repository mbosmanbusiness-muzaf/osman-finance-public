import { safeDiv, fin, cv as coeffVar } from '@/lib/utils'
import type { SaleTx, PurchaseTx, Product, Customer, Supplier, Employee, BudgetRow, MonthKey } from '@/types'

export type Abc = 'A' | 'B' | 'C'
export type Xyz = 'X' | 'Y' | 'Z'

export interface AbcXyzEntity { id: string; name: string; meta?: string; monthly: number[]; plan?: number }

export interface AbcXyzRow {
  id: string
  name: string
  meta?: string
  total: number
  share: number
  cumShare: number
  cv: number
  abc: Abc
  xyz: Xyz
  cls: string
  plan: number
  planPct: number
}

export const ABC_THRESHOLDS = { A: 80, B: 95 }
export const XYZ_THRESHOLDS = { X: 10, Y: 25 }

export function abcOf(cumShare: number, prevCum: number): Abc {
  // element A-sinfga kiradi, agar uning boshlanishi 80% dan oldin bo'lsa
  if (prevCum < ABC_THRESHOLDS.A) return 'A'
  if (prevCum < ABC_THRESHOLDS.B) return 'B'
  void cumShare
  return 'C'
}

export function xyzOf(cvPct: number): Xyz {
  if (cvPct < XYZ_THRESHOLDS.X) return 'X'
  if (cvPct <= XYZ_THRESHOLDS.Y) return 'Y'
  return 'Z'
}

export function classifyAbcXyz(entities: AbcXyzEntity[]): AbcXyzRow[] {
  const withTotal = entities.map((e) => ({ ...e, total: e.monthly.reduce((a, b) => a + fin(b), 0) }))
  const grand = withTotal.reduce((a, e) => a + Math.max(0, e.total), 0)
  const sorted = withTotal.sort((a, b) => b.total - a.total)
  let cum = 0
  return sorted.map((e) => {
    const share = safeDiv(Math.max(0, e.total), grand) * 100
    const prevCum = cum
    cum += share
    // XYZ: faqat "faol" oylar bo'yicha emas — barcha oylar (nol oylar Z ga olib keladi, bu standart)
    const cvv = e.monthly.length >= 2 ? coeffVar(e.monthly) : 0
    const abc = abcOf(cum, prevCum)
    const xyz = xyzOf(cvv)
    const plan = fin(e.plan)
    return { id: e.id, name: e.name, meta: e.meta, total: e.total, share, cumShare: Math.min(100, cum), cv: cvv, abc, xyz, cls: `${abc}${xyz}`, plan, planPct: safeDiv(e.total, plan) * 100 }
  })
}

export const MATRIX_CELLS: { cls: string; title: string; advice: string }[] = [
  { cls: 'AX', title: 'Yulduzlar', advice: 'Doimiy zaxira, avtomatik buyurtma, eng yaxshi narx shartlari.' },
  { cls: 'AY', title: 'Muhim, o\'zgaruvchan', advice: 'Xavfsizlik zaxirasi + haftalik prognoz.' },
  { cls: 'AZ', title: 'Muhim, notekis', advice: 'Buyurtma asosida ishlash, katta zaxira qilmang.' },
  { cls: 'BX', title: 'Barqaror o\'rta', advice: 'Standart zaxira normasi, oylik tekshiruv.' },
  { cls: 'BY', title: 'O\'rta, o\'zgaruvchan', advice: 'Zaxira normasini mavsumga qarab sozlang.' },
  { cls: 'BZ', title: 'O\'rta, notekis', advice: 'Minimal zaxira, talab bo\'lsa buyurtma.' },
  { cls: 'CX', title: 'Kichik, barqaror', advice: 'Kam, lekin muntazam — kichik partiyalar.' },
  { cls: 'CY', title: 'Kichik, o\'zgaruvchan', advice: 'Assortimentni qayta ko\'rib chiqing.' },
  { cls: 'CZ', title: 'Nomzod chiqarishga', advice: 'Chiqarish yoki faqat buyurtma asosida.' },
]

export function matrixSummary(rows: AbcXyzRow[]) {
  return MATRIX_CELLS.map((c) => {
    const items = rows.filter((r) => r.cls === c.cls)
    return { ...c, count: items.length, total: items.reduce((a, r) => a + r.total, 0), share: items.reduce((a, r) => a + r.share, 0), items }
  })
}

export interface ParetoPoint { name: string; value: number; cumShare: number; abc: Abc }
export function paretoData(rows: AbcXyzRow[], limit = 25): ParetoPoint[] {
  return rows.slice(0, limit).map((r) => ({ name: r.name, value: r.total, cumShare: r.cumShare, abc: r.abc }))
}

// ---------- Entity builders ----------
const monthIndex = (months: MonthKey[]) => { const m = new Map<string, number>(); months.forEach((k, i) => m.set(k, i)); return m }

function planSum(budget: BudgetRow[], scope: BudgetRow['scope'], key: string, months: MonthKey[]) {
  const set = new Set(months)
  return budget.filter((b) => b.scope === scope && b.key === key && set.has(b.month)).reduce((a, b) => a + fin(b.plan), 0)
}

export function productSalesEntities(sales: SaleTx[], products: Product[], budget: BudgetRow[], months: MonthKey[], metric: 'revenue' | 'grossProfit'): AbcXyzEntity[] {
  const idx = monthIndex(months)
  const map = new Map<string, number[]>()
  for (const p of products) map.set(p.id, new Array(months.length).fill(0))
  for (const s of sales) {
    const i = idx.get(s.month)
    if (i === undefined) continue
    const arr = map.get(s.productId) ?? (map.set(s.productId, new Array(months.length).fill(0)).get(s.productId) as number[])
    arr[i] += metric === 'revenue' ? fin(s.revenue) : fin(s.revenue) - fin(s.cogs)
  }
  return products.map((p) => ({ id: p.id, name: p.name, meta: p.category, monthly: map.get(p.id) ?? [], plan: metric === 'revenue' ? planSum(budget, 'product', p.id, months) : undefined }))
}

export function customerEntities(sales: SaleTx[], customers: Customer[], months: MonthKey[]): AbcXyzEntity[] {
  const idx = monthIndex(months)
  const map = new Map<string, number[]>()
  for (const c of customers) map.set(c.id, new Array(months.length).fill(0))
  for (const s of sales) { const i = idx.get(s.month); if (i === undefined) continue; const arr = map.get(s.customerId); if (arr) arr[i] += fin(s.revenue) }
  return customers.map((c) => ({ id: c.id, name: c.name, meta: c.segment, monthly: map.get(c.id) ?? [] }))
}

export function supplierEntities(purchases: PurchaseTx[], suppliers: Supplier[], months: MonthKey[]): AbcXyzEntity[] {
  const idx = monthIndex(months)
  const map = new Map<string, number[]>()
  for (const s of suppliers) map.set(s.id, new Array(months.length).fill(0))
  for (const p of purchases) { const i = idx.get(p.month); if (i === undefined) continue; const arr = map.get(p.supplierId); if (arr) arr[i] += fin(p.amount) }
  return suppliers.map((s) => ({ id: s.id, name: s.name, meta: s.category, monthly: map.get(s.id) ?? [] }))
}

export function employeeEntities(sales: SaleTx[], employees: Employee[], budget: BudgetRow[], months: MonthKey[]): AbcXyzEntity[] {
  const idx = monthIndex(months)
  const map = new Map<string, number[]>()
  for (const e of employees) map.set(e.id, new Array(months.length).fill(0))
  for (const s of sales) { const i = idx.get(s.month); if (i === undefined) continue; const arr = map.get(s.employeeId); if (arr) arr[i] += fin(s.revenue) }
  return employees.map((e) => ({ id: e.id, name: e.name, meta: e.department, monthly: map.get(e.id) ?? [], plan: planSum(budget, 'employee', e.id, months) }))
}
