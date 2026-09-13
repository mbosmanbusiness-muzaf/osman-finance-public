import type { MonthKey, ISODate } from '@/types'

export type RangeKey = '1m' | '3m' | '6m' | '12m' | 'qtd' | 'ytd' | '24m' | 'all' | 'custom' | 'last-month' | 'last-quarter' | 'last-year'
export type ComparisonKey = 'previous' | 'year' | 'plan' | 'none'

export interface Period {
  asOf: MonthKey
  range: RangeKey
  from?: MonthKey
  comparison?: ComparisonKey
}

export const RANGE_LABELS: Record<RangeKey, string> = {
  '1m': 'Oy boshidan (MTD)',
  'last-month': 'Yopilgan oy',
  'last-quarter': 'Yopilgan chorak',
  'last-year': 'Yopilgan yil',
  '3m': 'Oxirgi 3 oy',
  '6m': 'Oxirgi 6 oy',
  '12m': 'Oxirgi 12 oy',
  ytd: 'Yil boshidan (YTD)',
  qtd: 'Chorak boshidan (QTD)',
  '24m': 'Oxirgi 24 oy',
  all: 'Barcha davr',
  custom: 'Ixtiyoriy davr',
}

export function monthKey(y: number, m: number): MonthKey {
  return `${y}-${String(m).padStart(2, '0')}`
}

export function parseMonth(key: MonthKey): { y: number; m: number } {
  const [y, m] = String(key ?? '').split('-').map(Number)
  return { y: y || 2000, m: m || 1 }
}

export function addMonths(key: MonthKey, n: number): MonthKey {
  const { y, m } = parseMonth(key)
  const idx = y * 12 + (m - 1) + n
  return monthKey(Math.floor(idx / 12), (idx % 12) + 1)
}

export function monthDiff(a: MonthKey, b: MonthKey): number {
  const pa = parseMonth(a), pb = parseMonth(b)
  return pa.y * 12 + pa.m - (pb.y * 12 + pb.m)
}

export function daysInMonth(key: MonthKey): number {
  const { y, m } = parseMonth(key)
  return new Date(y, m, 0).getDate()
}

export function monthStart(key: MonthKey): ISODate {
  return `${key}-01`
}

export function monthEnd(key: MonthKey): ISODate {
  return `${key}-${String(daysInMonth(key)).padStart(2, '0')}`
}

export function monthOfDate(iso: ISODate): MonthKey {
  return iso.slice(0, 7)
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function diffDays(a: ISODate, b: ISODate): number {
  const da = new Date(a + 'T00:00:00Z').getTime()
  const db = new Date(b + 'T00:00:00Z').getTime()
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 0
  return Math.round((da - db) / 86_400_000)
}

/** Months (sorted) for a period, restricted to those present in `allMonths`. */
export function monthsInRange(allMonths: MonthKey[], period: Period): MonthKey[] {
  const sorted = [...new Set(allMonths)].filter(isMonthKey).sort()
  const asOf = isMonthKey(period.asOf) ? period.asOf : sorted[sorted.length - 1]
  if (!asOf) return []
  const { from, to } = periodBounds({ ...period, asOf }, sorted[0])
  return sorted.filter((m) => m >= from && m <= to)
}

/** Preceding window of same length (for ▲/▼ comparisons). */
export function previousWindow(allMonths: MonthKey[], months: MonthKey[]): MonthKey[] {
  if (!isContinuous(months)) return []
  const n = months.length
  const sorted = [...allMonths].sort()
  const first = months[0]
  const from = addMonths(first, -n)
  const to = addMonths(first, -1)
  const win = sorted.filter((m) => m >= from && m <= to)
  // to'liq bo'lmagan oldingi oyna (ma'lumot boshlanishidan oldin) → taqqoslama yo'q
  return win.length === n && isContinuous(win) ? win : []
}

/** Same window one year earlier. */
export function lastYearWindow(allMonths: MonthKey[], months: MonthKey[]): MonthKey[] {
  if (!isContinuous(months)) return []
  const sorted = [...allMonths].sort()
  const from = addMonths(months[0], -12)
  const to = addMonths(months[months.length - 1], -12)
  const win = sorted.filter((m) => m >= from && m <= to)
  return win.length === months.length && isContinuous(win) ? win : []
}

export function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

export function isContinuous(months: MonthKey[]): boolean {
  return months.length > 0 && months.every((month, index) => index === 0 || month === addMonths(months[index - 1], 1))
}

/** Year-to-date window ending at last month of `months`. */
export function ytdWindow(allMonths: MonthKey[], months: MonthKey[]): MonthKey[] {
  if (!months.length) return []
  const last = months[months.length - 1]
  const from = `${parseMonth(last).y}-01`
  return [...allMonths].sort().filter((m) => m >= from && m <= last)
}

export function periodLabel(months: MonthKey[], fmt: (m: MonthKey) => string): string {
  if (!months.length) return '—'
  if (months.length === 1) return fmt(months[0])
  return `${fmt(months[0])} – ${fmt(months[months.length - 1])}`
}

export function quarterOf(key: MonthKey): string {
  const { y, m } = parseMonth(key)
  return `${y}-Q${Math.ceil(m / 3)}`
}

/** Calendar boundaries are independent of missing observations. */
export function periodBounds(period: Period, first = period.asOf): { from: string; to: string } {
  const { asOf, range } = period
  const { y, m } = parseMonth(asOf)
  const quarterStart = monthKey(y, Math.floor((m - 1) / 3) * 3 + 1)
  switch (range) {
    case '1m': return { from: asOf, to: asOf }
    case 'qtd': return { from: quarterStart, to: asOf }
    case 'ytd': return { from: monthKey(y, 1), to: asOf }
    case 'last-month': return { from: addMonths(asOf, -1), to: addMonths(asOf, -1) }
    case 'last-quarter': return { from: addMonths(quarterStart, -3), to: addMonths(quarterStart, -1) }
    case 'last-year': return { from: monthKey(y - 1, 1), to: monthKey(y - 1, 12) }
    case 'custom': return { from: period.from ?? asOf, to: asOf }
    case 'all': return { from: first, to: asOf }
    default: return { from: addMonths(asOf, 1 - Number.parseInt(range)), to: asOf }
  }
}
export function periodStep(period: Period, first?: string): number {
  if (period.range === 'qtd' || period.range === 'last-quarter') return 3
  if (period.range === 'ytd' || period.range === 'last-year') return 12
  const { from, to } = periodBounds(period, first)
  return Math.max(1, monthDiff(to, from) + 1)
}
export function shiftPeriod(period: Period, direction: -1 | 1, first?: string): Period {
  const step = direction * periodStep(period, first)
  return { ...period, asOf: addMonths(period.asOf, step), ...(period.range === 'custom' ? { from: addMonths(period.from ?? period.asOf, step) } : {}) }
}
export function isPeriodAvailable(allMonths: string[], period: Period): boolean {
  if (!allMonths.length || !isMonthKey(period.asOf)) return false
  const { from, to } = periodBounds(period, [...allMonths].sort()[0])
  const months = monthsInRange(allMonths, period)
  return from <= to && months.length === monthDiff(to, from) + 1 && isContinuous(months)
}

export type SliceFilters = Record<string, string[]>
export const FILTER_KEYS = ['segment', 'category', 'supplier'] as const
export interface SliceState { period: Period; currency: 'UZS' | 'USD'; filters: SliceFilters }
export function readSlice(search: string, fallback: SliceState): SliceState {
  const q = new URLSearchParams(search)
  const range = q.get('period') === 'mtd' ? '1m' : q.get('period')
  const period = { ...fallback.period }
  if (range && Object.prototype.hasOwnProperty.call(RANGE_LABELS, range)) period.range = range as RangeKey
  if (isMonthKey(q.get('asOf'))) period.asOf = q.get('asOf')!
  if (isMonthKey(q.get('from'))) period.from = q.get('from')!
  if (period.range === 'custom' && (!isMonthKey(period.from) || period.from > period.asOf)) period.from = period.asOf
  const cmp = q.get('cmp')
  if (['previous', 'year', 'plan', 'none'].includes(cmp ?? '')) period.comparison = cmp as ComparisonKey
  const currency = q.get('cur')
  const filters = q.has('filters') ? {} : { ...fallback.filters }
  for (const key of FILTER_KEYS) if (q.has('f.' + key)) filters[key] = [...new Set(q.getAll('f.' + key).filter(Boolean))]
  return { period, currency: currency === 'USD' || currency === 'UZS' ? currency : fallback.currency, filters }
}
export function writeSlice(search: string, state: SliceState): string {
  const q = new URLSearchParams(search)
  q.set('period', state.period.range === '1m' ? 'mtd' : state.period.range)
  q.set('asOf', state.period.asOf); q.set('cmp', state.period.comparison ?? 'previous'); q.set('cur', state.currency)
  q.delete('from')
  if (state.period.range === 'custom' && state.period.from) q.set('from', state.period.from)
  q.set('filters', '1')
  for (const key of FILTER_KEYS) { q.delete('f.' + key); for (const value of state.filters[key] ?? []) q.append('f.' + key, value) }
  q.sort()
  return '?' + q.toString()
}
