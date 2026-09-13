/** ===== OSMAN Finance Dashboard — data model (all money in UZS, integers) ===== */

export type MonthKey = string // 'YYYY-MM'
export type ISODate = string // 'YYYY-MM-DD'

export type CustomerSegment = 'Chakana' | 'Ulgurji' | 'Korporativ' | 'Davlat'

export interface Product {
  id: string
  name: string
  category: string
  price: number // sotuv narxi (UZS, dona)
  unitCost: number // tannarx (UZS, dona)
  supplierId: string
}

export interface Customer {
  id: string
  name: string
  segment: CustomerSegment
  region: string
  paymentTermsDays: number
}

export interface Supplier {
  id: string
  name: string
  category: string
  paymentTermsDays: number
}

export interface Employee {
  id: string
  name: string
  role: string
  department: string
}

/** Sotuv tranzaksiyasi (oylik ABC/XYZ va segment kesimlari uchun manba). */
export interface SaleTx {
  id: string
  date: ISODate
  month: MonthKey
  productId: string
  customerId: string
  employeeId: string
  qty: number
  price: number // amaldagi o'rtacha narx
  revenue: number
  cogs: number
}

/** Xarid tranzaksiyasi (yetkazib beruvchilar ABC/XYZ). */
export interface PurchaseTx {
  id: string
  date: ISODate
  month: MonthKey
  supplierId: string
  category: string
  amount: number
}

/**
 * P&L guruhlari. Ishora: barcha summalar MUSBAT saqlanadi; ishora guruh turidan kelib chiqadi
 * (revenue/otherIncome = +, qolganlari = −). Bu admin jadvalda xatolikni kamaytiradi.
 */
export type PnLGroup = 'revenue' | 'cogs' | 'opex' | 'depreciation' | 'interest' | 'otherIncome' | 'tax'

export interface PnLRow {
  id: string
  month: MonthKey
  group: PnLGroup
  item: string // 2-daraja: "Ish haqi"
  element: string // 3-daraja: "Sotuv bo'limi"
  amount: number // musbat
}

/** Balans — har oy uchun bitta qator (oy oxiri holati). */
export interface BalanceMonth {
  month: MonthKey
  // Aktivlar
  cash: number
  receivables: number
  inventory: number
  otherCurrentAssets: number
  fixedAssetsNet: number
  intangibles: number
  // Passivlar
  payables: number
  shortTermDebt: number
  otherCurrentLiabilities: number
  longTermDebt: number
  // Kapital
  shareCapital: number
  retainedEarnings: number
}

/**
 * Cashflow — oylik, to'g'ri (direct) usul. Ishora: kirim +, chiqim −.
 * closingCash = openingCash + OCF + ICF + FCF (seed shu tenglikni ta'minlaydi).
 */
export interface CashflowMonth {
  month: MonthKey
  openingCash: number
  // Operatsion
  receiptsFromCustomers: number
  otherOperatingReceipts: number
  paidToSuppliers: number
  salariesPaid: number
  opexPaid: number
  taxesPaid: number
  interestPaid: number
  // Investitsion
  capex: number
  assetSales: number
  // Moliyaviy
  loansReceived: number
  loansRepaid: number
  dividendsPaid: number
  closingCash: number
}

export interface InventoryItem {
  productId: string
  qty: number
  unitCost: number
  lastMovementDate: ISODate
}

/** Debitorlik (invoice) yoki kreditorlik (bill) hujjati. */
export interface ArInvoice {
  id: string
  customerId: string
  issueDate: ISODate
  dueDate: ISODate
  amount: number
  paid: number
  paidDate: ISODate | null
}

export interface ApBill {
  id: string
  supplierId: string
  issueDate: ISODate
  dueDate: ISODate
  amount: number
  paid: number
  paidDate: ISODate | null
}

export type BudgetScope = 'pnl' | 'cash' | 'product' | 'employee'

/**
 * Byudjet (plan) qatorlari. scope:
 *  - pnl:      group + key(item)  → oylik plan summa (musbat)
 *  - cash:     key ∈ 'closingCash' | 'ocf'
 *  - product:  key = productId → oylik sotuv plani (tushum)
 *  - employee: key = employeeId → oylik sotuv plani (tushum)
 */
export interface BudgetRow {
  id: string
  month: MonthKey
  scope: BudgetScope
  group: PnLGroup | ''
  key: string
  plan: number
}

export type KpiUnit = 'pct' | 'days' | 'ratio' | 'score' | 'money'

/** Koeffitsiyent maqsadlari va norma diapazoni (admin → Byudjet → KPI maqsadlari). */
export interface KpiTarget {
  key: string
  label: string
  unit: KpiUnit
  target: number
  normMin: number
  normMax: number
  /** true bo'lsa — kichik qiymat yaxshi (DSO, DIO, CCC, gearing) */
  lowerIsBetter: boolean
}

export interface Settings {
  companyName: string
  currentPeriod: MonthKey
  minCashBalance: number
  taxRate: number // 0.15
  usdRate: number
}

export interface Dataset {
  settings: Settings
  products: Product[]
  customers: Customer[]
  suppliers: Supplier[]
  employees: Employee[]
  sales: SaleTx[]
  purchases: PurchaseTx[]
  pnl: PnLRow[]
  balance: BalanceMonth[]
  cashflow: CashflowMonth[]
  inventory: InventoryItem[]
  invoices: ArInvoice[]
  bills: ApBill[]
  budget: BudgetRow[]
  kpiTargets: KpiTarget[]
}

export type TableName = Exclude<keyof Dataset, 'settings'>

export const TABLE_LABELS: Record<TableName, string> = {
  pnl: 'P&L',
  balance: 'Balans',
  cashflow: 'Cashflow',
  products: 'Mahsulotlar',
  customers: 'Mijozlar',
  suppliers: 'Yetkazib beruvchilar',
  invoices: 'Debitorlik',
  bills: 'Kreditorlik',
  budget: 'Byudjet',
  inventory: 'Zaxira',
  employees: 'Xodimlar',
  sales: 'Sotuvlar',
  purchases: 'Xaridlar',
  kpiTargets: 'KPI maqsadlari',
}

/** Admin gridda ko'rsatiladigan jadvallar tartibi. */
export const ADMIN_TABLE_ORDER: TableName[] = [
  'pnl', 'balance', 'cashflow', 'products', 'customers', 'suppliers',
  'invoices', 'bills', 'budget', 'kpiTargets', 'inventory', 'employees', 'sales', 'purchases',
]

export const PNL_GROUP_LABELS: Record<PnLGroup, string> = {
  revenue: 'Tushum',
  cogs: 'Sotilgan mahsulot tannarxi',
  opex: 'Operatsion xarajatlar',
  depreciation: 'Amortizatsiya',
  interest: 'Foiz xarajatlari',
  otherIncome: 'Boshqa daromadlar',
  tax: 'Foyda solig\'i',
}

export const PNL_GROUP_ORDER: PnLGroup[] = ['revenue', 'cogs', 'opex', 'depreciation', 'otherIncome', 'interest', 'tax']

export const isIncomeGroup = (g: PnLGroup) => g === 'revenue' || g === 'otherIncome'
