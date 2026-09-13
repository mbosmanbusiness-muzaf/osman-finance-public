import { fin } from './utils'
import { LOCALES, t, useLanguageStore, type Language } from '@/i18n'

export type Currency = 'UZS' | 'USD'

/** UZS per 1 USD — standart; Admin → Sozlamalar → "USD kursi" setUsdRate orqali almashtiradi. */
export const USD_RATE = 12_800
let usdRate = USD_RATE

export function setUsdRate(rate: number) {
  usdRate = Number.isFinite(rate) && rate > 0 ? rate : USD_RATE
}

export interface MoneyOptions {
  currency?: Currency
  compact?: boolean
  decimals?: number
  sign?: boolean
  suffix?: boolean
}

export function toCurrency(uzs: number, currency: Currency): number {
  return currency === 'USD' ? fin(uzs) / usdRate : fin(uzs)
}

/** Yaxlitlab −0 ni 0 ga keltiradi ("−0.0%" ko'rinishining oldini oladi). */
export function roundTo(v: number, decimals: number): number {
  const r = Number(fin(v).toFixed(decimals))
  return r === 0 ? 0 : r
}

const language = () => useLanguageStore.getState().language
/** bo'linmas bo'shliq — raqam va birlik ("1,23 mlrd") qatorga ajralib ketmasin */
const NBSP = String.fromCharCode(160)

/** Raqam ajratgichlari: o'zbek va rus tilida minglik — bo'shliq, o'nlik — vergul; ingliz tilida — vergul va nuqta. */
const SEPARATORS: Record<Language, { group: string; decimal: string }> = {
  uz: { group: ' ', decimal: ',' },
  ru: { group: ' ', decimal: ',' },
  en: { group: ',', decimal: '.' },
}

/** en-US ko'rinishidagi raqamni ("1,234.5") tanlangan tilning ajratgichlariga o'tkazadi: uz/ru — "1 234,5". */
export function localizeDigits(s: string, lang: Language = language()): string {
  const { group, decimal } = SEPARATORS[lang]
  return s.replace(/[,.]/g, (ch) => (ch === ',' ? group : decimal))
}

/** Qisqartirilgan birliklar: uz — trln / mlrd / mln / ming, ru — трлн / млрд / млн / тыс., en — T / B / M / K. */
const COMPACT_UNITS: Record<Language, { units: [string, string, string, string]; gap: string }> = {
  uz: { units: ['trln', 'mlrd', 'mln', 'ming'], gap: NBSP },
  ru: { units: ['трлн', 'млрд', 'млн', 'тыс.'], gap: NBSP },
  en: { units: ['T', 'B', 'M', 'K'], gap: '' },
}
/** [bo'luvchi, standart kasr xonalari] — trln, mlrd, mln, ming */
const SCALES: [number, number][] = [[1e12, 2], [1e9, 2], [1e6, 1], [1e3, 1]]

/** Qisqa ko'rinish: mos birlikni tanlaydi (999.96 mln → "1 mlrd", "1000 mln" emas). */
function compact(abs: number, digitsOf: (scale: number) => number, lang: Language): string {
  let i = SCALES.findIndex(([div]) => abs >= div)
  if (i > 0 && Number((abs / SCALES[i][0]).toFixed(digitsOf(i))) >= 1000) i -= 1
  const { units, gap } = COMPACT_UNITS[lang]
  return localizeDigits(trimZero((abs / SCALES[i][0]).toFixed(digitsOf(i))), lang) + gap + units[i]
}

const UZS_SUFFIX: Record<Language, string> = { uz: "so'm", ru: 'сум', en: 'UZS' }

/** Qisqa pul: uz — "1,23 mlrd" / "450,3 mln" / "12,5 ming"; ru — "1,23 млрд"; en — "1.23B". 10 000 dan kichigi — to'liq raqam. */
export function fmtMoney(uzs: number, opts: MoneyOptions = {}): string {
  const { currency = 'UZS', compact: isCompact = true, decimals, sign = false, suffix = false } = opts
  const lang = language()
  const v = toCurrency(fin(uzs), currency)
  const neg = v < 0
  const abs = Math.abs(v)
  const body = isCompact && abs >= 1e4 ? compact(abs, (i) => decimals ?? SCALES[i][1], lang) : fmtNum(abs, decimals ?? 0)
  const s = (neg && body !== '0' ? '−' : sign && v > 0 ? '+' : '') + (currency === 'USD' ? '$' : '') + body
  return suffix && currency === 'UZS' ? `${s} ${UZS_SUFFIX[lang]}` : s
}

/** Qisqa son (dona va h.k.): uz — "478 ming", "1,2 mln"; ru — "478 тыс."; en — "478K". 1000 dan kichigi — to'liq raqam. */
export function fmtCompactNum(n: number): string {
  const v = fin(n)
  const abs = Math.abs(v)
  if (abs < 1e3) return fmtNum(v, 0).replace('-', '−')
  return (v < 0 ? '−' : '') + compact(abs, (i) => (i === 3 && abs >= 1e5 ? 0 : 1), language())
}

function trimZero(s: string) {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s
}

/** uz / ru: 1 234 567,5 · en: 1,234,567.5 */
export function fmtNum(n: number, decimals = 0): string {
  const v = roundTo(n, decimals)
  return localizeDigits(new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v))
}

/** Foiz (kirish allaqachon % da): uz/ru — "12,3%", en — "12.3%". */
export function fmtPct(p: number, decimals = 1, sign = false): string {
  const v = roundTo(p, decimals)
  return (sign && v > 0 ? '+' : '') + localizeDigits(v.toFixed(decimals)).replace('-', '−') + '%'
}

/** Koeffitsiyent: uz/ru — "1,85×", en — "1.85×". */
export function fmtRatio(r: number, decimals = 2): string {
  return localizeDigits(roundTo(r, decimals).toFixed(decimals)).replace('-', '−') + '×'
}

export function fmtDays(d: number): string {
  return `${fmtNum(d, 0).replace('-', '−')} ${t('kun')}`
}

export type ValueFormat = 'money' | 'pct' | 'number' | 'days' | 'ratio' | 'score'

export function fmtValue(v: number, format: ValueFormat, currency: Currency = 'UZS'): string {
  switch (format) {
    case 'money': return fmtMoney(v, { currency })
    case 'pct': return fmtPct(v)
    case 'days': return fmtDays(v)
    case 'ratio': return fmtRatio(v)
    case 'score': return localizeDigits(roundTo(v, 2).toFixed(2)).replace('-', '−')
    default: return fmtNum(v)
  }
}

const UZ_MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']
const UZ_MONTHS_FULL = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr']

/** '2026-08' → 'Avg 26' */
export function fmtMonth(key: string, full = false): string {
  const [y, m] = key.split('-').map(Number)
  if (!y || !m || m > 12) return key
  const lang = language()
  if (lang !== 'uz') return new Intl.DateTimeFormat(LOCALES[lang], { month: full ? 'long' : 'short', year: full ? 'numeric' : '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)))
  return full ? `${UZ_MONTHS_FULL[m - 1]} ${y}` : `${UZ_MONTHS[m - 1]} ${String(y).slice(2)}`
}

export function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(LOCALES[language()], { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(d)
}

export function fmtDateShort(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const lang = language()
  if (lang !== 'uz') return new Intl.DateTimeFormat(LOCALES[lang], { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(d)
  return `${String(d.getUTCDate()).padStart(2, '0')} ${UZ_MONTHS[d.getUTCMonth()]}`
}
