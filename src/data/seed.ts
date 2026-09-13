/**
 * Demo ma'lumot generatori — deterministik (seeded PRNG), 24 oy.
 * Izchillik kafolatlari (konstruksiya bo'yicha):
 *  1. Balans har oy tenglashadi: Aktiv = Majburiyat + Kapital.
 *  2. Cashflow yakuniy qoldig'i = Balansdagi pul mablag'i (o'sha oy).
 *  3. Sof foyda → taqsimlanmagan foyda (dividend chiqarilgan holda).
 *  4. OCF bilvosita usul bilan tekshiriladi: NP + Amort − ΔAR − ΔInv − ΔOtherCA + ΔAP + ΔOtherCL.
 *  5. Ochiq invoyslar yig'indisi = balans debitorlik; ochiq billar = kreditorlik; zaxira = balans zaxirasi.
 */
import { createRng, clamp } from '@/lib/utils'
import { addMonths, monthEnd, addDays, daysInMonth, parseMonth } from '@/lib/period'
import type {
  Dataset, Product, Customer, Supplier, Employee, SaleTx, PurchaseTx, PnLRow, BalanceMonth,
  CashflowMonth, InventoryItem, ArInvoice, ApBill, BudgetRow, KpiTarget, PnLGroup, CustomerSegment,
} from '@/types'

export const CURRENT_PERIOD = '2026-08'
export const MONTH_COUNT = 24
export const DEMO_SEED = 20260901

interface CategoryDef { name: string; price: [number, number]; costRatio: number; season: number[] }

const CATEGORIES: CategoryDef[] = [
  { name: 'Elektronika', price: [1_500_000, 15_000_000], costRatio: 0.66, season: [0.85, 0.8, 1.0, 0.95, 0.95, 0.9, 0.9, 0.95, 1.05, 1.05, 1.15, 1.35] },
  { name: 'Maishiy texnika', price: [800_000, 8_000_000], costRatio: 0.62, season: [0.8, 0.8, 1.05, 1.0, 1.05, 1.1, 1.1, 1.0, 1.0, 1.0, 1.1, 1.25] },
  { name: 'Mebel', price: [500_000, 6_000_000], costRatio: 0.55, season: [0.8, 0.85, 1.1, 1.05, 1.0, 0.95, 0.95, 1.05, 1.1, 1.1, 1.05, 1.0] },
  { name: 'Qurilish mollari', price: [50_000, 800_000], costRatio: 0.66, season: [0.6, 0.65, 0.95, 1.15, 1.25, 1.3, 1.3, 1.25, 1.15, 1.0, 0.75, 0.6] },
  { name: 'Kiyim-kechak', price: [80_000, 600_000], costRatio: 0.5, season: [0.9, 0.85, 1.15, 1.0, 0.9, 0.85, 0.8, 0.95, 1.15, 1.15, 1.1, 1.2] },
  { name: 'Oziq-ovqat', price: [15_000, 120_000], costRatio: 0.74, season: [0.95, 0.95, 1.1, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.15] },
]

const PRODUCT_NAMES: Record<string, string[]> = {
  Elektronika: ['Samsung Galaxy A55', 'iPhone 15 128GB', 'Xiaomi Redmi Note 13', 'Lenovo IdeaPad 3', 'HP LaserJet 107a', 'Samsung 55" QLED TV', 'JBL Flip 6', 'Apple Watch SE'],
  'Maishiy texnika': ['Artel muzlatgich 2K', 'Samsung kir yuvish 7kg', 'Artel gaz plita 4', 'Beko changyutgich', 'Artel konditsioner 12', 'Philips mikroto\'lqin', 'Tefal dazmol'],
  Mebel: ['Ofis stoli "Standart"', 'Ofis kreslosi ergonomik', 'Divan 3 o\'rinli', 'Yotoq to\'plami', 'Kitob javoni', 'Oshxona garnituri'],
  'Qurilish mollari': ['Sement M400 (50kg)', 'Gipsokarton 12mm', 'Laminat 8mm (m²)', 'Emulsiya bo\'yoq 10L', 'Keramik plitka (m²)', 'Armatura 12mm (m)', 'Profil truba 40x20'],
  'Kiyim-kechak': ['Erkaklar ko\'ylagi', 'Ayollar paltosi', 'Bolalar sport kostyumi', 'Jinsi shim', 'Krossovka', 'Qishki kurtka'],
  'Oziq-ovqat': ['Un oliy nav 50kg', 'Shakar 50kg', 'O\'simlik yog\'i 5L', 'Guruch lazer 25kg', 'Ko\'k choy 1kg', 'Makaron 5kg'],
}

const SUPPLIER_NAMES: Record<string, string[]> = {
  Elektronika: ['Samsung Uzbekistan', 'Apple Premium Distributor', 'Xiaomi Central Asia', 'Lenovo Partner UZ', 'TechnoImport MCHJ'],
  'Maishiy texnika': ['Artel Electronics', 'Beko Central Asia', 'Philips Distribution', 'Tefal Group UZ', 'Shivaki Trade'],
  Mebel: ['Toshkent Mebel Fabrikasi', 'IKEA Partner UZ', 'Andijon Yog\'och', 'Comfort Mebel MCHJ', 'Xorazm Mebel'],
  'Qurilish mollari': ['Qizilqum Sement AJ', 'Knauf Uzbekistan', 'Tarkett UZ', 'Bekobod Metallurgiya', 'Buxoro Keramika'],
  'Kiyim-kechak': ['Turon Tekstil', 'Namangan To\'qimachilik', 'Uztex Group', 'Farg\'ona Fashion', 'Asia Textile'],
  'Oziq-ovqat': ['Uzdon Agro', 'Xorazm Shakar', 'Oltin Don MCHJ', 'Jizzax Guruch', 'Toshkent Choy Fabrikasi'],
}

const REGIONS = ['Toshkent', 'Samarqand', 'Buxoro', 'Farg\'ona', 'Andijon', 'Namangan', 'Xorazm', 'Qashqadaryo', 'Surxondaryo', 'Navoiy', 'Jizzax', 'Sirdaryo', 'Qoraqalpog\'iston']
const CUSTOMER_STEMS = ['Savdo', 'Texno', 'Qurilish', 'Trade', 'Market', 'Invest', 'Servis', 'Logistika', 'Distribution', 'Group', 'Retail', 'Universal', 'Baraka', 'Oltin', 'Nur', 'Yulduz', 'Sharq', 'Buyuk', 'Ipak', 'Zamin']
const CUSTOMER_SUFFIX = ['MCHJ', 'XK', 'AJ', 'QK', 'Savdo uyi', 'MCHJ', 'MCHJ']

const EMPLOYEES: Omit<Employee, 'id'>[] = [
  { name: 'Aziz Karimov', role: 'Sotuv bo\'limi boshlig\'i', department: 'Korporativ sotuv' },
  { name: 'Dilnoza Rashidova', role: 'Katta sotuv menejeri', department: 'Korporativ sotuv' },
  { name: 'Bobur Toshmatov', role: 'Katta sotuv menejeri', department: 'Ulgurji sotuv' },
  { name: 'Malika Yusupova', role: 'Sotuv menejeri', department: 'Ulgurji sotuv' },
  { name: 'Sardor Alimov', role: 'Sotuv menejeri', department: 'Chakana sotuv' },
  { name: 'Nilufar Saidova', role: 'Sotuv menejeri', department: 'Chakana sotuv' },
  { name: 'Jasur Ergashev', role: 'Sotuv menejeri', department: 'Davlat buyurtmalari' },
  { name: 'Zarina Abdullayeva', role: 'Kichik sotuv menejeri', department: 'Chakana sotuv' },
]
const EMPLOYEE_WEIGHTS = [0.22, 0.18, 0.15, 0.13, 0.11, 0.09, 0.07, 0.05]

const K = 1_000, M = 1_000_000, B = 1_000_000_000

function r1000(n: number) { return Math.round(n / 1000) * 1000 }

function weightedPick<T>(rng: ReturnType<typeof createRng>, items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0)
  let x = rng.next() * total
  for (let i = 0; i < items.length; i++) {
    x -= weights[i]
    if (x <= 0) return items[i]
  }
  return items[items.length - 1]
}

function powerWeights(n: number, alpha: number): number[] {
  const w = Array.from({ length: n }, (_, i) => 1 / Math.pow(i + 1, alpha))
  const s = w.reduce((a, b) => a + b, 0)
  return w.map((x) => x / s)
}

function shuffle<T>(rng: ReturnType<typeof createRng>, arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function generateDemoData(seed = DEMO_SEED): Dataset {
  const rng = createRng(seed)
  const months: string[] = []
  const first = addMonths(CURRENT_PERIOD, -(MONTH_COUNT - 1))
  for (let i = 0; i < MONTH_COUNT; i++) months.push(addMonths(first, i))
  const openingMonth = addMonths(first, -1)
  const asOf = monthEnd(CURRENT_PERIOD)

  // ---------- Master data ----------
  const suppliers: Supplier[] = []
  let sIdx = 1
  for (const cat of CATEGORIES) {
    for (const name of SUPPLIER_NAMES[cat.name]) {
      suppliers.push({ id: `S${String(sIdx++).padStart(3, '0')}`, name, category: cat.name, paymentTermsDays: rng.pick([30, 30, 45, 45, 60]) })
    }
  }

  const products: Product[] = []
  let pIdx = 1
  for (const cat of CATEGORIES) {
    const catSuppliers = suppliers.filter((s) => s.category === cat.name)
    for (const name of PRODUCT_NAMES[cat.name]) {
      const price = r1000(Math.exp(rng.range(Math.log(cat.price[0]), Math.log(cat.price[1]))))
      const unitCost = r1000(price * cat.costRatio * rng.range(0.94, 1.06))
      products.push({ id: `P${String(pIdx++).padStart(3, '0')}`, name, category: cat.name, price, unitCost, supplierId: rng.pick(catSuppliers).id })
    }
  }

  const customers: Customer[] = []
  const segPlan: CustomerSegment[] = [
    ...Array<CustomerSegment>(20).fill('Korporativ'), ...Array<CustomerSegment>(15).fill('Ulgurji'),
    ...Array<CustomerSegment>(20).fill('Chakana'), ...Array<CustomerSegment>(5).fill('Davlat'),
  ]
  const usedNames = new Set<string>()
  for (let i = 0; i < 60; i++) {
    const segment = segPlan[i]
    const region = rng.pick(REGIONS)
    let name = ''
    do {
      name = segment === 'Davlat'
        ? `${region} ${rng.pick(['viloyat hokimligi', 'tuman hokimligi', 'shahar hokimligi', 'DUK', 'davlat muassasasi'])}`
        : `${rng.pick([region, rng.pick(CUSTOMER_STEMS)])} ${rng.pick(CUSTOMER_STEMS)} ${rng.pick(CUSTOMER_SUFFIX)}`
    } while (usedNames.has(name))
    usedNames.add(name)
    const terms = segment === 'Davlat' ? 60 : segment === 'Korporativ' ? 45 : segment === 'Ulgurji' ? 30 : rng.pick([0, 7, 14])
    customers.push({ id: `C${String(i + 1).padStart(3, '0')}`, name, segment, region, paymentTermsDays: terms })
  }

  const employees: Employee[] = EMPLOYEES.map((e, i) => ({ id: `E${String(i + 1).padStart(2, '0')}`, ...e }))

  // ---------- Product demand model ----------
  const BASE_MONTHLY_REVENUE = 2.9 * B
  const shuffledIdx = shuffle(rng, products.map((_, i) => i))
  const pw = powerWeights(products.length, 0.85)
  const productWeight = new Array<number>(products.length).fill(0)
  shuffledIdx.forEach((pi, rank) => { productWeight[pi] = pw[rank] })
  const volatility = products.map(() => rng.pick([0.03, 0.04, 0.06, 0.08, 0.12, 0.18, 0.28, 0.4]))
  const launchMonth = products.map(() => 0)
  // 2 ta yangi mahsulot 10-oyda chiqarilgan, 1 tasi so'nib bormoqda
  launchMonth[shuffledIdx[30]] = 9
  launchMonth[shuffledIdx[33]] = 11
  const decliningIdx = shuffledIdx[8]
  const baseQty = products.map((p, i) => (productWeight[i] * BASE_MONTHLY_REVENUE) / p.price)

  const customerWeights = powerWeights(customers.length, 0.9)
  const custOrder = shuffle(rng, customers.map((_, i) => i))
  const custW = new Array<number>(customers.length).fill(0)
  custOrder.forEach((ci, rank) => { custW[ci] = customerWeights[rank] })
  // Har mahsulot uchun "doimiy mijozlar" va ularning barqaror ulushi — mijoz har oy taxminan bir xil hajmda oladi (XYZ real bo'lishi uchun)
  const productCustomers: { ci: number; share: number }[][] = products.map(() => {
    const n = rng.int(4, 8)
    const set = new Set<number>()
    while (set.size < n) set.add(weightedPick(rng, customers.map((_, i) => i), custW))
    const raw = Array.from(set).map((ci) => ({ ci, w: custW[ci] * rng.range(0.7, 1.3) }))
    const tot = raw.reduce((x, r) => x + r.w, 0)
    return raw.map((r) => ({ ci: r.ci, share: r.w / tot }))
  })
  // Har mijozning account-menejeri (xodim) — xodim sotuvi barqaror bo'ladi
  const customerManager: number[] = customers.map(() => weightedPick(rng, employees.map((_, i) => i), EMPLOYEE_WEIGHTS))

  // ---------- Monthly engine ----------
  const sales: SaleTx[] = []
  const purchases: PurchaseTx[] = []
  const pnl: PnLRow[] = []
  const balance: BalanceMonth[] = []
  const cashflow: CashflowMonth[] = []
  const budget: BudgetRow[] = []

  let txId = 1, purId = 1, pnlId = 1, budId = 1
  const addPnl = (month: string, group: PnLGroup, item: string, element: string, amount: number) => {
    pnl.push({ id: `L${String(pnlId++).padStart(5, '0')}`, month, group, item, element, amount: Math.max(0, r1000(amount)) })
  }

  const addBudget = (month: string, scope: BudgetRow['scope'], group: PnLGroup | '', key: string, plan: number) => {
    budget.push({ id: `B${String(budId++).padStart(5, '0')}`, month, scope, group, key, plan: Math.max(0, r1000(plan)) })
  }

  // opening state
  let dso = 40, dio = 62, dpo = 41
  let cash = 1_100 * M
  let AR = 0, INV = 0, AP = 0, otherCA = 280 * M, otherCL = 400 * M
  let FA = 6.5 * B, INTANG = 400 * M
  let LTD = 2.5 * B, STD = 800 * M
  const shareCapital = 5 * B
  let RE = 0
  let cumCapex = 0
  let smoothRev = 0, smoothCogs = 0

  // Bootstrap AR/INV/AP from expected first-month figures
  const expectedRev0 = BASE_MONTHLY_REVENUE * 0.98
  const expectedCogs0 = expectedRev0 * 0.64
  AR = r1000((expectedRev0 * dso) / 30)
  INV = r1000((expectedCogs0 * dio) / 30)
  AP = r1000((expectedCogs0 * dpo) / 30)
  smoothRev = expectedRev0
  smoothCogs = expectedCogs0
  {
    const assets = cash + AR + INV + otherCA + FA + INTANG
    const liab = AP + STD + otherCL + LTD
    RE = assets - liab - shareCapital
    balance.push({
      month: openingMonth, cash, receivables: AR, inventory: INV, otherCurrentAssets: otherCA, fixedAssetsNet: FA, intangibles: INTANG,
      payables: AP, shortTermDebt: STD, otherCurrentLiabilities: otherCL, longTermDebt: LTD, shareCapital, retainedEarnings: RE,
    })
  }

  const specialCapex: Record<number, number> = { 4: 450 * M, 9: 800 * M, 17: 350 * M }
  const assetSaleMonth = 13
  const newLoanMonth = 9

  const productMonthlyRevenue: number[][] = products.map(() => [])
  const employeeMonthlyRevenue: number[][] = employees.map(() => [])

  for (let mi = 0; mi < MONTH_COUNT; mi++) {
    const month = months[mi]
    const { m: calMonth } = parseMonth(month)
    const growth = Math.pow(1.012, mi)
    const dim = daysInMonth(month)

    // ---- Sales transactions ----
    const revByCat: Record<string, number> = {}
    const cogsByCat: Record<string, number> = {}
    let revenue = 0, cogs = 0, qtyTotal = 0
    const empRev = new Array<number>(employees.length).fill(0)
    products.forEach((p, pi) => {
      let pRev = 0
      if (mi >= launchMonth[pi]) {
        const cat = CATEGORIES.find((c) => c.name === p.category)!
        // mavsumiylik yumshatilgan (60%) — aks holda deyarli barcha mahsulot Z-sinf bo'lib qoladi
        const season = 1 + (cat.season[calMonth - 1] - 1) * 0.6
        let factor = growth * season * Math.max(0.15, 1 + volatility[pi] * rng.normal(0, 1))
        if (pi === decliningIdx) factor *= Math.pow(0.93, mi)
        if (launchMonth[pi] > 0) factor *= Math.min(1, 0.4 + 0.15 * (mi - launchMonth[pi]))
        const qty = Math.max(0, Math.round(baseQty[pi] * factor))
        if (qty > 0) {
          for (const { ci: cIdx, share } of productCustomers[pi]) {
            const q = Math.round(qty * share * rng.range(0.85, 1.15))
            if (q <= 0) continue
            const eIdx = customerManager[cIdx]
            const price = r1000(p.price * (1 + mi * 0.0035) * (1 + rng.normal(0, 0.02)))
            const rev = q * price
            const cg = r1000(q * p.unitCost * (1 + mi * 0.004 + rng.normal(0, 0.01)))
            const day = rng.int(1, dim)
            sales.push({
              id: `T${String(txId++).padStart(5, '0')}`, date: `${month}-${String(day).padStart(2, '0')}`, month,
              productId: p.id, customerId: customers[cIdx].id, employeeId: employees[eIdx].id, qty: q, price, revenue: rev, cogs: cg,
            })
            revByCat[p.category] = (revByCat[p.category] || 0) + rev
            cogsByCat[p.category] = (cogsByCat[p.category] || 0) + cg
            revenue += rev; cogs += cg; qtyTotal += q; pRev += rev
            empRev[eIdx] += rev
          }
        }
      }
      productMonthlyRevenue[pi].push(pRev)
    })
    employees.forEach((_, ei) => employeeMonthlyRevenue[ei].push(empRev[ei]))

    // ---- P&L rows ----
    for (const cat of CATEGORIES) addPnl(month, 'revenue', 'Mahsulot sotuvi', cat.name, revByCat[cat.name] || 0)
    const svcDelivery = revenue * 0.014, svcInstall = revenue * 0.007
    addPnl(month, 'revenue', 'Xizmatlar', 'Yetkazib berish', svcDelivery)
    addPnl(month, 'revenue', 'Xizmatlar', 'O\'rnatish va sozlash', svcInstall)
    const totalRevenue = revenue + svcDelivery + svcInstall

    for (const cat of CATEGORIES) addPnl(month, 'cogs', 'Tovar tannarxi', cat.name, cogsByCat[cat.name] || 0)
    const inbound1 = revenue * 0.012, inbound2 = revenue * 0.005
    addPnl(month, 'cogs', 'Kirish logistikasi', 'Transport', inbound1)
    addPnl(month, 'cogs', 'Kirish logistikasi', 'Bojxona va sertifikat', inbound2)
    const totalCogs = cogs + inbound1 + inbound2

    const wageGrowth = Math.pow(1.008, mi)
    const salesTeam = (120 * M + totalRevenue * 0.022) * wageGrowth
    const admin = 125 * M * wageGrowth * (1 + rng.normal(0, 0.015))
    const warehouse = 95 * M * wageGrowth * (1 + rng.normal(0, 0.02))
    const salaries = salesTeam + admin + warehouse
    addPnl(month, 'opex', 'Ish haqi', 'Sotuv bo\'limi', salesTeam)
    addPnl(month, 'opex', 'Ish haqi', 'Ma\'muriyat', admin)
    addPnl(month, 'opex', 'Ish haqi', 'Ombor va logistika', warehouse)
    const rentStep = mi >= 12 ? 1.08 : 1
    const rentOffice = 45 * M * rentStep, rentWh = 72 * M * rentStep
    addPnl(month, 'opex', 'Ijara', 'Ofis', rentOffice)
    addPnl(month, 'opex', 'Ijara', 'Ombor', rentWh)
    const catSeasonAvg = CATEGORIES.reduce((a, c) => a + c.season[calMonth - 1], 0) / CATEGORIES.length
    const mktDigital = 55 * M * catSeasonAvg * growth * (1 + rng.normal(0, 0.08))
    const mktOffline = 30 * M * catSeasonAvg * (1 + rng.normal(0, 0.15))
    addPnl(month, 'opex', 'Marketing', 'Digital reklama', mktDigital)
    addPnl(month, 'opex', 'Marketing', 'Offline va tadbirlar', mktOffline)
    const logOut = totalRevenue * 0.016, packaging = totalRevenue * 0.004
    addPnl(month, 'opex', 'Logistika', 'Yetkazib berish transporti', logOut)
    addPnl(month, 'opex', 'Logistika', 'Qadoqlash', packaging)
    const winter = calMonth <= 2 || calMonth === 12 ? 1.35 : calMonth >= 6 && calMonth <= 8 ? 1.2 : 1
    const elec = 11 * M * winter * (1 + rng.normal(0, 0.05)), telecom = 6 * M, water = 5 * M * (winter > 1.3 ? 1.5 : 1)
    addPnl(month, 'opex', 'Kommunal', 'Elektr energiya', elec)
    addPnl(month, 'opex', 'Kommunal', 'Aloqa va internet', telecom)
    addPnl(month, 'opex', 'Kommunal', 'Suv va isitish', water)
    const bank = totalRevenue * 0.0025, repair = 9 * M * (1 + rng.normal(0, 0.2)), insurance = 6 * M, office = 7 * M * (1 + rng.normal(0, 0.1))
    const consulting = mi % 3 === 2 ? 24 * M : 6 * M
    addPnl(month, 'opex', 'Boshqa', 'Bank xizmatlari', bank)
    addPnl(month, 'opex', 'Boshqa', 'Ta\'mirlash va texnik xizmat', repair)
    addPnl(month, 'opex', 'Boshqa', 'Sug\'urta', insurance)
    addPnl(month, 'opex', 'Boshqa', 'Ofis xarajatlari', office)
    addPnl(month, 'opex', 'Boshqa', 'Konsalting va audit', consulting)
    const opex = salaries + rentOffice + rentWh + mktDigital + mktOffline + logOut + packaging + elec + telecom + water + bank + repair + insurance + office + consulting

    const capex = r1000((specialCapex[mi] ?? 0) + rng.range(20 * M, 60 * M))
    const depFA = r1000(42 * M + 0.012 * cumCapex)
    const depInt = 4 * M
    addPnl(month, 'depreciation', 'Amortizatsiya', 'Asosiy vositalar', depFA)
    addPnl(month, 'depreciation', 'Amortizatsiya', 'Nomoddiy aktivlar', depInt)
    const dep = depFA + depInt

    const otherRent = 8 * M, fxGain = Math.abs(rng.normal(6 * M, 5 * M)) + 500 * K
    addPnl(month, 'otherIncome', 'Boshqa daromad', 'Ijaraga berishdan', otherRent)
    addPnl(month, 'otherIncome', 'Boshqa daromad', 'Valyuta kursi farqi', fxGain)
    const otherIncome = otherRent + fxGain

    const bankInterest = r1000(((LTD + STD) * 0.22) / 12)
    const overdraft = r1000(rng.range(1 * M, 3 * M))
    addPnl(month, 'interest', 'Foiz xarajatlari', 'Bank krediti foizi', bankInterest)
    addPnl(month, 'interest', 'Foiz xarajatlari', 'Overdraft', overdraft)
    const interest = bankInterest + overdraft

    const ebt = totalRevenue + otherIncome - totalCogs - opex - dep - interest
    const tax = r1000(Math.max(0, ebt) * 0.15)
    addPnl(month, 'tax', 'Foyda solig\'i', 'Foyda solig\'i 15%', tax)
    const netProfit = ebt - tax

    // ---- Working capital evolution ----
    dso = clamp(dso + rng.normal(0, 0.8) + (mi > 14 ? 0.2 : 0), 34, 48)
    dio = clamp(dio + rng.normal(0, 1.0), 52, 76)
    dpo = clamp(dpo + rng.normal(0, 0.8), 33, 50)
    smoothRev = 0.6 * smoothRev + 0.4 * totalRevenue
    smoothCogs = 0.6 * smoothCogs + 0.4 * totalCogs
    const avgRev = smoothRev
    const avgCogs = smoothCogs
    const newAR = r1000((avgRev * dso) / 30)
    const newINV = r1000((avgCogs * dio) / 30)
    const newAP = r1000((avgCogs * dpo) / 30)
    const newOtherCA = r1000(280 * M + rng.normal(0, 25 * M))
    const newOtherCL = r1000(tax + 380 * M + rng.normal(0, 20 * M))
    const dAR = newAR - AR, dINV = newINV - INV, dAP = newAP - AP, dOCA = newOtherCA - otherCA, dOCL = newOtherCL - otherCL

    // ---- Investing ----
    const assetSales = mi === assetSaleMonth ? 60 * M : 0
    FA = FA + capex - depFA - assetSales
    INTANG = INTANG - depInt
    cumCapex += capex

    // ---- Financing ----
    const newLoan = mi === newLoanMonth ? 1.0 * B : 0
    const ltdRepay = Math.min(LTD, mi >= newLoanMonth ? 60 * M : 45 * M)
    LTD = LTD + newLoan - ltdRepay
    const dividends = (mi + 1) % 3 === 0 && netProfit > 0 ? 150 * M : 0

    // Cash before credit-line adjustment
    const ocf = netProfit + dep - dAR - dINV - dOCA + dAP + dOCL
    const icf = -capex + assetSales
    let fcf = newLoan - ltdRepay - dividends
    let stdDraw = 0, stdRepay = 0
    const cashPre = cash + ocf + icf + fcf
    if (cashPre < 600 * M) {
      stdDraw = Math.ceil((600 * M - cashPre) / (50 * M)) * 50 * M
    } else if (cashPre > 2.4 * B && STD > 0) {
      stdRepay = Math.max(0, Math.min(STD, Math.floor((cashPre - 1.9 * B) / (50 * M)) * 50 * M))
    }
    STD = STD + stdDraw - stdRepay
    fcf += stdDraw - stdRepay
    const opening = cash
    cash = Math.round(opening + ocf + icf + fcf)

    // Update balances (butun sonlar; yaxlitlash qoldig'i → boshqa joriy aktivlar, tenglik aniq saqlanadi)
    RE = Math.round(RE + netProfit - dividends)
    AR = newAR; INV = newINV; AP = newAP; otherCL = newOtherCL
    otherCA = newOtherCA + ((AP + STD + otherCL + LTD + shareCapital + RE) - (cash + AR + INV + newOtherCA + FA + INTANG))

    balance.push({
      month, cash, receivables: AR, inventory: INV, otherCurrentAssets: otherCA, fixedAssetsNet: FA, intangibles: INTANG,
      payables: AP, shortTermDebt: STD, otherCurrentLiabilities: otherCL, longTermDebt: LTD, shareCapital, retainedEarnings: RE,
    })
    {
      const assets = cash + AR + INV + otherCA + FA + INTANG
      const le = AP + STD + otherCL + LTD + shareCapital + RE
      if (Math.abs(assets - le) > 1) console.error('[seed] Balans tenglashmadi', month, assets - le)
    }

    // Direct-method cashflow (sums exactly to ocf/icf/fcf)
    const receipts = totalRevenue - dAR
    const paidSuppliers = -(totalCogs + dINV - dAP)
    const salariesPaid = -salaries
    const opexPaid = -(opex - salaries) - dOCA
    const taxesPaid = -tax + dOCL
    const interestPaid = -interest
    const cf: CashflowMonth = {
      month, openingCash: opening,
      receiptsFromCustomers: r1000(receipts), otherOperatingReceipts: r1000(otherIncome),
      paidToSuppliers: r1000(paidSuppliers), salariesPaid: r1000(salariesPaid), opexPaid: r1000(opexPaid),
      taxesPaid: r1000(taxesPaid), interestPaid: r1000(interestPaid),
      capex: -capex, assetSales,
      loansReceived: newLoan + stdDraw, loansRepaid: -(ltdRepay + stdRepay), dividendsPaid: -dividends,
      closingCash: cash,
    }
    // Rounding residue → opexPaid so closing matches balance cash exactly
    const sumFlows = cf.receiptsFromCustomers + cf.otherOperatingReceipts + cf.paidToSuppliers + cf.salariesPaid + cf.opexPaid + cf.taxesPaid + cf.interestPaid + cf.capex + cf.assetSales + cf.loansReceived + cf.loansRepaid + cf.dividendsPaid
    cf.opexPaid += cf.closingCash - cf.openingCash - sumFlows
    cashflow.push(cf)

    // ---- Purchases (supplier ABC/XYZ) ----
    for (const s of suppliers) {
      const sProducts = products.map((p, i) => ({ p, i })).filter(({ p }) => p.supplierId === s.id)
      const catCogs = cogsByCat[s.category] || 0
      const catProducts = products.filter((p) => p.category === s.category)
      const catWeight = catProducts.reduce((a, p) => a + productWeight[products.indexOf(p)], 0) || 1
      const share = sProducts.reduce((a, { i }) => a + productWeight[i], 0) / catWeight
      const amount = r1000(catCogs * share * (1 + rng.normal(0, 0.12)) * (1 + dINV / Math.max(1, totalCogs) * 0.5))
      if (amount > 0) {
        purchases.push({ id: `X${String(purId++).padStart(5, '0')}`, date: `${month}-${String(rng.int(1, dim)).padStart(2, '0')}`, month, supplierId: s.id, category: s.category, amount })
      }
    }

    // ---- Budget (plan) rows ----
    const itemTotals: Record<string, { group: PnLGroup; amount: number }> = {}
    for (const r of pnl) {
      if (r.month !== month) continue
      const k = `${r.group}|${r.item}`
      ;(itemTotals[k] ||= { group: r.group, amount: 0 }).amount += r.amount
    }
    for (const [k, v] of Object.entries(itemTotals)) {
      const item = k.split('|')[1]
      const isIncome = v.group === 'revenue' || v.group === 'otherIncome'
      const bias = isIncome ? 0.005 : v.group === 'tax' ? 0 : rng.range(-0.02, 0.02)
      const noise = v.group === 'tax' ? 0 : rng.normal(0, isIncome ? 0.035 : 0.025)
      addBudget(month, 'pnl', v.group, item, v.amount * (1 + bias + noise))
    }
    addBudget(month, 'cash', '', 'closingCash', cash * (1 + rng.normal(0.03, 0.07)))
    addBudget(month, 'cash', '', 'ocf', Math.max(0, ocf) * (1 + rng.normal(0.02, 0.1)) + (ocf < 0 ? 80 * M : 0))
    products.forEach((p, pi) => {
      const rev = productMonthlyRevenue[pi][mi]
      if (mi >= launchMonth[pi]) addBudget(month, 'product', '', p.id, rev * (1 + rng.normal(0.02, 0.08)))
    })
    employees.forEach((e, ei) => addBudget(month, 'employee', '', e.id, empRev[ei] * (1 + rng.normal(0.03, 0.06))))

    void qtyTotal
  }

  // ---------- Inventory (sum = balans zaxirasi) ----------
  const lastBal = balance[balance.length - 1]
  const idleSet = new Set<number>([decliningIdx, shuffledIdx[35], shuffledIdx[37], shuffledIdx[38], shuffledIdx[39], shuffledIdx[27]])
  const invRaw = products.map((p, pi) => {
    const recent = productMonthlyRevenue[pi].slice(-6)
    const avgRev = recent.reduce((a, b) => a + b, 0) / Math.max(1, recent.length)
    const monthlyQty = avgRev / p.price
    const idle = idleSet.has(pi)
    const qty = Math.max(idle ? 8 : 2, Math.round(monthlyQty * (idle ? rng.range(2.5, 4) : rng.range(1.2, 2.6))))
    const unitCost = r1000(p.unitCost * (1 + rng.range(0.04, 0.1)))
    const lastMovementDate = addDays(asOf, -(idle ? rng.int(95, 210) : rng.int(0, 28)))
    return { productId: p.id, qty, unitCost, lastMovementDate }
  })
  const invValue = invRaw.reduce((a, r) => a + r.qty * r.unitCost, 0)
  const invScale = lastBal.inventory / Math.max(1, invValue)
  const inventory: InventoryItem[] = invRaw.map((r) => ({ ...r, unitCost: r1000(r.unitCost * invScale) }))
  // residue → largest item
  {
    const total = inventory.reduce((a, r) => a + r.qty * r.unitCost, 0)
    const diff = lastBal.inventory - total
    const big = inventory.reduce((a, b) => (a.qty * a.unitCost > b.qty * b.unitCost ? a : b))
    if (big.qty > 0) big.unitCost = Math.round(big.unitCost + diff / big.qty)
  }

  // ---------- Receivables (open sum = balans debitorlik) ----------
  const invoices: ArInvoice[] = []
  let invId = 1
  const arBuckets = [
    { share: 0.52, days: () => -rng.int(1, 45) }, // kelmagan (dueDate kelajakda)
    { share: 0.22, days: () => rng.int(1, 30) },
    { share: 0.12, days: () => rng.int(31, 60) },
    { share: 0.08, days: () => rng.int(61, 90) },
    { share: 0.06, days: () => rng.int(91, 180) },
  ]
  const problemCustomers = new Set<number>([custOrder[4], custOrder[9], custOrder[15]])
  const openRaw: ArInvoice[] = []
  customers.forEach((c, ci) => {
    const w = custW[ci]
    const n = w > 0.05 ? 5 : w > 0.025 ? 4 : w > 0.012 ? 3 : w > 0.006 ? 2 : rng.next() < 0.6 ? 1 : 0
    for (let i = 0; i < n; i++) {
      let bucket = weightedPick(rng, arBuckets, arBuckets.map((b) => b.share))
      if (problemCustomers.has(ci) && rng.next() < 0.55) bucket = arBuckets[rng.int(3, 4)]
      if (c.segment === 'Davlat' && rng.next() < 0.4) bucket = arBuckets[rng.int(2, 4)]
      const terms = Math.max(7, c.paymentTermsDays)
      // muddati kelmagan: muddat = asOf + (1..terms) → chiqarilgan sana asOf dan oldin
      const past = bucket === arBuckets[0] ? -rng.int(1, terms) : bucket.days()
      const dueDate = addDays(asOf, -past)
      const issueDate = addDays(dueDate, -terms)
      const amount = r1000(Math.exp(rng.normal(Math.log(w * 60 * B), 0.5)))
      openRaw.push({ id: '', customerId: c.id, issueDate, dueDate, amount: Math.max(2 * M, amount), paid: 0, paidDate: null })
    }
  })
  {
    // muddati o'tgan ulushini ~28% ga keltirish (demo uchun realistik)
    const isOver = (r: ArInvoice) => r.dueDate < asOf
    const over = openRaw.filter(isOver).reduce((a, r) => a + r.amount, 0)
    const notDue = openRaw.filter((r) => !isOver(r)).reduce((a, r) => a + r.amount, 0)
    if (over > 0 && notDue > 0) { const f = (over * 0.72) / 0.28 / notDue; for (const r of openRaw) if (!isOver(r)) r.amount = r1000(r.amount * f) }
    const total = openRaw.reduce((a, r) => a + r.amount, 0)
    const scale = lastBal.receivables / Math.max(1, total)
    for (const r of openRaw) r.amount = r1000(r.amount * scale)
    const diff = lastBal.receivables - openRaw.reduce((a, r) => a + r.amount, 0)
    openRaw.sort((a, b) => b.amount - a.amount)[0].amount += diff
    // qisman to'langanlar
    for (const r of openRaw) if (rng.next() < 0.15) { const p = r1000(r.amount * rng.range(0.2, 0.5)); r.paid = p; r.amount += p }
  }
  // to'langan invoyslar (tarix)
  const paidRaw: ArInvoice[] = []
  for (let i = 0; i < 260; i++) {
    const ci = weightedPick(rng, customers.map((_, idx) => idx), custW)
    const c = customers[ci]
    const issueDate = addDays(asOf, -rng.int(40, 365))
    const dueDate = addDays(issueDate, Math.max(7, c.paymentTermsDays))
    const delay = Math.round(Math.max(-5, rng.normal(problemCustomers.has(ci) ? 22 : 5, 12)))
    const paidDate = addDays(dueDate, delay)
    if (paidDate > asOf) continue
    const amount = r1000(Math.exp(rng.normal(Math.log(custW[ci] * 2.3 * B), 0.5)))
    paidRaw.push({ id: '', customerId: c.id, issueDate, dueDate, amount: Math.max(2 * M, amount), paid: Math.max(2 * M, amount), paidDate })
  }
  for (const r of [...paidRaw, ...openRaw].sort((a, b) => a.issueDate.localeCompare(b.issueDate))) {
    invoices.push({ ...r, id: `INV-${String(invId++).padStart(4, '0')}` })
  }

  // ---------- Payables (open sum = balans kreditorlik) ----------
  const bills: ApBill[] = []
  let billId = 1
  const apBuckets = [
    { share: 0.6, days: () => -rng.int(1, 45) },
    { share: 0.25, days: () => rng.int(1, 30) },
    { share: 0.09, days: () => rng.int(31, 60) },
    { share: 0.04, days: () => rng.int(61, 90) },
    { share: 0.02, days: () => rng.int(91, 150) },
  ]
  const supplierTotals = suppliers.map((s) => purchases.filter((p) => p.supplierId === s.id).reduce((a, p) => a + p.amount, 0))
  const supTotalAll = supplierTotals.reduce((a, b) => a + b, 0) || 1
  const openBills: ApBill[] = []
  suppliers.forEach((s, si) => {
    const w = supplierTotals[si] / supTotalAll
    const n = w > 0.08 ? 5 : w > 0.04 ? 4 : w > 0.02 ? 3 : 2
    for (let i = 0; i < n; i++) {
      const bucket = weightedPick(rng, apBuckets, apBuckets.map((b) => b.share))
      const past = bucket === apBuckets[0] ? -rng.int(1, s.paymentTermsDays) : bucket.days()
      const dueDate = addDays(asOf, -past)
      const issueDate = addDays(dueDate, -s.paymentTermsDays)
      const amount = r1000(Math.exp(rng.normal(Math.log(Math.max(0.005, w) * 30 * B), 0.45)))
      openBills.push({ id: '', supplierId: s.id, issueDate, dueDate, amount: Math.max(5 * M, amount), paid: 0, paidDate: null })
    }
  })
  {
    const isOver = (r: ApBill) => r.dueDate < asOf
    const over = openBills.filter(isOver).reduce((a, r) => a + r.amount, 0)
    const notDue = openBills.filter((r) => !isOver(r)).reduce((a, r) => a + r.amount, 0)
    if (over > 0 && notDue > 0) { const f = (over * 0.88) / 0.12 / notDue; for (const r of openBills) if (!isOver(r)) r.amount = r1000(r.amount * f) }
    const total = openBills.reduce((a, r) => a + r.amount, 0)
    const scale = lastBal.payables / Math.max(1, total)
    for (const r of openBills) r.amount = r1000(r.amount * scale)
    const diff = lastBal.payables - openBills.reduce((a, r) => a + r.amount, 0)
    openBills.sort((a, b) => b.amount - a.amount)[0].amount += diff
  }
  const paidBills: ApBill[] = []
  for (let i = 0; i < 200; i++) {
    const si = weightedPick(rng, suppliers.map((_, idx) => idx), supplierTotals.map((t) => t / supTotalAll))
    const s = suppliers[si]
    const issueDate = addDays(asOf, -rng.int(40, 365))
    const dueDate = addDays(issueDate, s.paymentTermsDays)
    const delay = Math.round(Math.max(-10, rng.normal(3, 9)))
    const paidDate = addDays(dueDate, delay)
    if (paidDate > asOf) continue
    const amount = r1000(Math.exp(rng.normal(Math.log(Math.max(0.005, supplierTotals[si] / supTotalAll) * 1.9 * B), 0.45)))
    paidBills.push({ id: '', supplierId: s.id, issueDate, dueDate, amount: Math.max(5 * M, amount), paid: Math.max(5 * M, amount), paidDate })
  }
  for (const r of [...paidBills, ...openBills].sort((a, b) => a.issueDate.localeCompare(b.issueDate))) {
    bills.push({ ...r, id: `BILL-${String(billId++).padStart(4, '0')}` })
  }

  // ---------- KPI targets ----------
  const kpiTargets: KpiTarget[] = [
    { key: 'dso', label: 'DSO (debitorlik kunlari)', unit: 'days', target: 38, normMin: 30, normMax: 45, lowerIsBetter: true },
    { key: 'dpo', label: 'DPO (kreditorlik kunlari)', unit: 'days', target: 42, normMin: 35, normMax: 55, lowerIsBetter: false },
    { key: 'dio', label: 'DIO (zaxira kunlari)', unit: 'days', target: 60, normMin: 45, normMax: 70, lowerIsBetter: true },
    { key: 'ccc', label: 'Pul aylanish sikli (CCC)', unit: 'days', target: 55, normMin: 30, normMax: 65, lowerIsBetter: true },
    { key: 'currentRatio', label: 'Joriy likvidlik', unit: 'ratio', target: 1.8, normMin: 1.5, normMax: 2.5, lowerIsBetter: false },
    { key: 'quickRatio', label: 'Tezkor likvidlik', unit: 'ratio', target: 1.0, normMin: 0.8, normMax: 1.5, lowerIsBetter: false },
    { key: 'cashRatio', label: 'Mutlaq likvidlik', unit: 'ratio', target: 0.3, normMin: 0.2, normMax: 0.6, lowerIsBetter: false },
    { key: 'gearing', label: 'Gearing (Qarz/Kapital)', unit: 'ratio', target: 0.4, normMin: 0, normMax: 0.7, lowerIsBetter: true },
    { key: 'roe', label: 'ROE (yillik)', unit: 'pct', target: 28, normMin: 20, normMax: 40, lowerIsBetter: false },
    { key: 'roa', label: 'ROA (yillik)', unit: 'pct', target: 15, normMin: 10, normMax: 25, lowerIsBetter: false },
    { key: 'grossMargin', label: 'Yalpi marja', unit: 'pct', target: 34, normMin: 30, normMax: 40, lowerIsBetter: false },
    { key: 'opMargin', label: 'Operatsion marja', unit: 'pct', target: 10, normMin: 8, normMax: 15, lowerIsBetter: false },
    { key: 'netMargin', label: 'Sof marja', unit: 'pct', target: 7.5, normMin: 5, normMax: 12, lowerIsBetter: false },
    { key: 'altmanZ', label: 'Altman Z-score', unit: 'score', target: 3.0, normMin: 2.9, normMax: 10, lowerIsBetter: false },
    { key: 'interestCoverage', label: 'Foiz qoplash', unit: 'ratio', target: 8, normMin: 5, normMax: 30, lowerIsBetter: false },
    { key: 'arOverdueShare', label: 'Muddati o\'tgan debitorlik ulushi', unit: 'pct', target: 15, normMin: 0, normMax: 20, lowerIsBetter: true },
    { key: 'apOverdueShare', label: 'Muddati o\'tgan kreditorlik ulushi', unit: 'pct', target: 10, normMin: 0, normMax: 15, lowerIsBetter: true },
    { key: 'planFulfillment', label: 'Plan bajarilishi', unit: 'pct', target: 100, normMin: 95, normMax: 110, lowerIsBetter: false },
  ]

  return {
    settings: { companyName: 'OSMAN Trade MCHJ', currentPeriod: CURRENT_PERIOD, minCashBalance: 500 * M, taxRate: 0.15, usdRate: 12_800 },
    products, customers, suppliers, employees, sales, purchases, pnl, balance, cashflow, inventory, invoices, bills, budget, kpiTargets,
  }
}

export { K, M, B }
