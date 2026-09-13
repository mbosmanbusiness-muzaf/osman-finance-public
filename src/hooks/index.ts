import { useLocation, useNavigate } from 'react-router-dom'
import { readSlice, writeSlice, type SliceFilters } from '@/lib/period'
import { pnlPlanTotals, pnlTotals } from '@/lib/finance/pnl'
import { ROUTES } from '@/lib/routes'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useDataStore, allMonthsOf } from '@/store/useDataStore'
import { useUiStore } from '@/store/useUiStore'
import { PALETTES, type Palette } from '@/lib/palette'
import { fmtMoney, fmtMonth, type Currency, type MoneyOptions } from '@/lib/format'
import { monthsInRange, previousWindow, lastYearWindow, ytdWindow, monthEnd, periodLabel, type Period, type RangeKey } from '@/lib/period'
import type { Dataset } from '@/types'
import { useLanguageStore } from '@/i18n'

/** Ma'lumot + oylar. */
export function useDataset(): { data: Dataset; allMonths: string[]; isEmpty: boolean; version: number } {
  const raw = useDataStore((s) => s.data)
  const section = useUiStore((s) => s.activeSection)
  const sectionFilters = useUiStore((s) => s.sectionFilters)
  const data = useMemo(() => filterDataset(raw, sectionFilters[section] ?? {}), [raw, section, sectionFilters])
  const version = useDataStore((s) => s.version)
  const allMonths = useMemo(() => allMonthsOf(raw), [raw])
  return { data, allMonths, isEmpty: allMonths.length === 0, version }
}

export interface PeriodContext {
  period: Period
  months: string[]
  prevMonths: string[]
  prevYearMonths: string[]
  ytdMonths: string[]
  allMonths: string[]
  /** tanlangan davrning oxirgi oyi */
  asOf: string
  /** ISO sana — davr oxiri (aging va zaxira uchun) */
  asOfDate: string
  label: string
  prevLabel: string
  /** delta yorlig'i — tanlangan taqqoslash rejimiga mos: "o'tgan davrga" yoki "o'tgan yilga" */
  compareLabel: string
  /** taqqoslama yo'q bo'lganda izoh (rejim o'chirilgan yoki oldingi davr ma'lumoti yo'q) */
  noCompareText: string
  hasComparisonPlan: boolean
  planTotals: ReturnType<typeof pnlPlanTotals> | null
  comparisonTotals: ReturnType<typeof pnlTotals> | null
  setRange: (r: RangeKey) => void
  setAsOf: (m: string) => void
}

/** Global davr filtri konteksti (barcha sahifalar shu orqali ishlaydi). */
export function usePeriod(): PeriodContext {
  const language = useLanguageStore((state) => state.language)
  const period = useUiStore((s) => s.period)
  const setRange = useUiStore((s) => s.setRange)
  const setAsOf = useUiStore((s) => s.setAsOf)
  const { allMonths, data } = useDataset()
  return useMemo(() => {
    const months = monthsInRange(allMonths, period)
    const prevMonths = period.comparison === 'none' || period.comparison === 'plan' ? [] : period.comparison === 'year' ? lastYearWindow(allMonths, months) : previousWindow(allMonths, months)
    const planTotals = months.length && months.every((month) => data.budget.some((b) => b.scope === 'pnl' && b.month === month)) ? pnlPlanTotals(data.budget, months) : null
    const hasComparisonPlan = months.length > 0 && months.every((month) => data.budget.some((b) => b.month === month))
    const comparisonTotals = period.comparison === 'plan' ? planTotals : prevMonths.length ? pnlTotals(data.pnl, prevMonths) : null
    const prevYearMonths = lastYearWindow(allMonths, months)
    const ytdMonths = ytdWindow(allMonths, months)
    const asOf = months[months.length - 1] ?? period.asOf
    return {
      hasComparisonPlan, planTotals, comparisonTotals, period, months, prevMonths, prevYearMonths, ytdMonths, allMonths, asOf, asOfDate: monthEnd(asOf),
      label: periodLabel(months, (m) => fmtMonth(m)), prevLabel: period.comparison === 'plan' && planTotals ? 'Reja (byudjet)' : periodLabel(prevMonths, (m) => fmtMonth(m)), setRange, setAsOf,
      compareLabel: period.comparison === 'plan' ? 'Rejaga nisbatan' : period.comparison === 'year' ? "o'tgan yilga" : "o'tgan davrga",
      noCompareText: period.comparison === 'plan' ? 'Bu kesim uchun reja yo‘q' : period.comparison === 'none' ? "Taqqoslash o'chirilgan" : period.comparison === 'year' ? "O'tgan yil ma'lumoti yo'q" : "Oldingi davr ma'lumoti yo'q",
    }
  }, [period, allMonths, data, setRange, setAsOf, language])
}

/** Valyuta va pul formatlash (global valyuta tanloviga bog'liq). */
export function useCurrency(): { currency: Currency; money: (n: number, o?: MoneyOptions) => string; moneyFull: (n: number) => string } {
  const currency = useUiStore((s) => s.currency)
  const language = useLanguageStore((state) => state.language)
  const usdRate = useDataStore((state) => state.data.settings.usdRate)
  return useMemo(() => ({
    currency,
    money: (n: number, o: MoneyOptions = {}) => fmtMoney(n, { currency, ...o }),
    moneyFull: (n: number) => fmtMoney(n, { currency, compact: false }),
  }), [currency, language, usdRate])
}

export function useTheme() {
  const theme = useUiStore((s) => s.theme)
  const toggleTheme = useUiStore((s) => s.toggleTheme)
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add(theme)
  }, [theme])
  return { theme, toggleTheme }
}

export function useChartPalette(): Palette {
  const theme = useUiStore((s) => s.theme)
  return PALETTES[theme]
}

/** Sahifa o'tishida 300ms skeleton. */
export function useSkeleton(key: string, ms = 300): boolean {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), ms)
    return () => clearTimeout(t)
  }, [key, ms])
  return loading
}

/** Only dimensions supported by the demo model are exposed. No warehouse field exists yet. */
export function filterDataset(data: Dataset, filters: SliceFilters): Dataset {
  const has = (key: string) => !!filters[key]?.length
  if (!['segment', 'category', 'supplier'].some(has)) return data
  const match = (key: string, value: string) => !has(key) || filters[key].includes(value)
  const products = data.products.filter((p) => match('category', p.category) && match('supplier', p.supplierId))
  const customers = data.customers.filter((c) => match('segment', c.segment))
  const productIds = new Set(products.map((p) => p.id)), customerIds = new Set(customers.map((c) => c.id))
  return {
    ...data, products, customers,
    suppliers: data.suppliers.filter((s) => match('supplier', s.id) && match('category', s.category)),
    sales: data.sales.filter((r) => productIds.has(r.productId) && customerIds.has(r.customerId)),
    purchases: data.purchases.filter((r) => match('category', r.category) && match('supplier', r.supplierId)),
    inventory: data.inventory.filter((r) => productIds.has(r.productId)),
    invoices: data.invoices.filter((r) => customerIds.has(r.customerId)),
    bills: data.bills.filter((r) => match('supplier', r.supplierId)),
    // P&L has category on revenue/COGS only; no segment/supplier allocation is fabricated.
    pnl: has('category') ? data.pnl.filter((r) => match('category', r.element)) : data.pnl,
    budget: has('category') || has('segment') || has('supplier') ? data.budget.filter((r) => r.scope === 'product' && productIds.has(r.key) && !has('segment')) : data.budget,
  }
}

export const sliceSection = (pathname: string) => pathname.split('/')[1] ?? ''
export function useSectionFilters() {
  const section = useUiStore((s) => s.activeSection)
  const all = useUiStore((s) => s.sectionFilters)
  const set = useUiStore((s) => s.setFilters)
  return { filters: all[section] ?? {}, setFilters: (filters: SliceFilters) => set(section, filters), reset: () => set(section, {}) }
}
/** 3A contract: chart onClick -> select(String(payload.category)); table data uses useDataset(). */
export function useChartFilter(key: 'category' | 'segment' | 'supplier') {
  const { filters, setFilters } = useSectionFilters()
  return (value: string | null) => setFilters({ ...filters, [key]: value ? [value] : [] })
}
/** One owner of URL synchronization; URL wins on initial load and browser Back. */
export function useSliceSync() {
  const location = useLocation()
  const navigate = useNavigate()
  useLayoutEffect(() => {
    const section = sliceSection(location.pathname)
    const state = useUiStore.getState()
    const slice = readSlice(location.search, { period: state.period, currency: state.currency, filters: state.sectionFilters[section] ?? {} })
    useUiStore.setState({ period: slice.period, currency: slice.currency, activeSection: section, sectionFilters: { ...state.sectionFilters, [section]: slice.filters } })
    const sync = () => {
      const next = useUiStore.getState()
      const search = writeSlice(location.search, { period: next.period, currency: next.currency, filters: next.sectionFilters[section] ?? {} })
      if (search !== location.search) navigate({ pathname: location.pathname, search, hash: location.hash }, { replace: true, state: location.state })
    }
    sync()
    return useUiStore.subscribe((next, prev) => {
      if (next.period !== prev.period || next.currency !== prev.currency || next.sectionFilters !== prev.sectionFilters) sync()
    })
  }, [location.pathname, location.search, location.hash, location.state, navigate])
}
export function useSliceNavigate() {
  const location = useLocation()
  const navigate = useNavigate()
  return (to: string) => {
    const state = useUiStore.getState()
    const q = new URLSearchParams(to.split('?')[1] ?? '')
    q.set('back', location.pathname + location.search.replace(/([?&])back=[^&]*/g, '$1').replace(/[?&]$/, ''))
    const search = writeSlice(q.toString(), { period: state.period, currency: state.currency, filters: state.sectionFilters[state.activeSection] ?? {} })
    navigate(to.split('?')[0] + search)
  }
}
export function safeBackTarget(search: string): string | null {
  const back = new URLSearchParams(search).get('back')
  return back && Object.values(ROUTES).some((p) => back.split('?')[0] === p) ? back : null
}
