import type { Theme } from '@/store/useUiStore'

/**
 * Grafik ranglari. Qoida (3A): rang ma'noga biriktiriladi, indeksga emas.
 * - ssenariylar (IBCS): fakt — to'ldirilgan oltin, plan — neytral kontur/punktir, o'tgan yil — bo'g'iq kulrang, prognoz — shtrix;
 * - kategoriya shkalasi (`series`) — 6 rang; protanopiya va deyteranopiyada eng yaqin juftlik ΔE00 ≥ 14
 *   (o'lchangan 2026-09-12). Ilgari bu yerda xato bor edi: c2/c4 (ko'k va binafsha) deyteranopiyada
 *   ΔE00 = 0,8 — ya'ni umuman ajralmasdi, garchi izohda "farqlanadi" deb yozilgan bo'lsa ham.
 *   c4 va c6 almashtirildi. Ajratish qisman yorqinlik orqali beriladi — dixromatiyada boshqa yo'l yo'q.
 *   Tritanopiyada eng yaqin juftlik 8,0 (qorong'i) / 10,3 (yorug'): u juda kam uchraydi (~0,01%).
 *   Rang yagona belgi emas: sektor va ustunlar doim yozuv bilan belgilanadi;
 * - yashil/qizil/sariq faqat holat uchun (o'sish, xavf, diqqat), kategoriya uchun emas.
 */
export interface Palette {
  /** kategoriya shkalasi (segment, kanal, ombor) */
  series: string[]
  /** ssenariylar */
  actual: string
  plan: string
  prior: string
  forecast: string
  gold: string
  goldBright: string
  positive: string
  negative: string
  warning: string
  info: string
  muted: string
  text: string
  textSecondary: string
  grid: string
  surface: string
  elevated: string
  border: string
  purple: string
  teal: string
  pink: string
  orange: string
}

export const PALETTES: Record<Theme, Palette> = {
  // `purple` va `pink` — tarixiy nomlar: ular 4- va 6- kategoriya slotlari bilan bir xil qiymatda turadi.
  dark: {
    series: ['#E0B36A', '#60A5FA', '#2DD4BF', '#8051C8', '#9A9389', '#AC6CA8'],
    actual: '#E0B36A', plan: '#C9C3B9', prior: '#6F6A61', forecast: '#E0B36A',
    gold: '#E0B36A', goldBright: '#F2CC85', positive: '#4ADE80', negative: '#FB7185', warning: '#FBBF24', info: '#60A5FA',
    muted: '#9A9389', text: '#FAF9F7', textSecondary: '#C9C3B9', grid: 'rgba(201,195,185,0.12)', surface: '#23201B', elevated: '#2E2A24', border: '#3A352E',
    purple: '#8051C8', teal: '#2DD4BF', pink: '#AC6CA8', orange: '#FB923C',
  },
  light: {
    series: ['#B07F2E', '#2563EB', '#0D9488', '#4C325D', '#6D675F', '#10107F'],
    // prior — oq fonda 3:1 bo'lishi uchun to'qroq qilindi (#A9A299 edi: 2,53 — 1.4.11 dan o'tmasdi)
    actual: '#B07F2E', plan: '#6D675F', prior: '#948C82', forecast: '#B07F2E',
    gold: '#B07F2E', goldBright: '#8A6218', positive: '#137236', negative: '#BE193C', warning: '#A04A08', info: '#1D4ED8',
    // elevated/border — index.css tokenlaridan hisoblangan qiymatlar (#EFECE6 va #DDD8CF edi:
    // grafik ichidagi fon va to'r kartaning haqiqiy foniga to'g'ri kelmasdi, ΔE00 2,1 va 3,0)
    muted: '#6D675F', text: '#1A1714', textSecondary: '#4A453D', grid: 'rgba(26,23,20,0.10)', surface: '#FFFFFF', elevated: '#F5F3F0', border: '#E7E4DE',
    // orange — index.css dagi `--orange` (#C2410C) bilan bir xil: ilgari bu yerda #EA580C turardi va
    // aging 61–90 katagi jadvalda (Tailwind tokeni) bir rangda, grafikda boshqa rangda chiqardi.
    purple: '#4C325D', teal: '#0D9488', pink: '#10107F', orange: '#C03F0C',
  },
}

/** Ko'rsatkichga biriktirilgan rang: bir ko'rsatkich barcha sahifalarda bir xil rangda. */
export type SeriesKey =
  | 'revenue' | 'profit' | 'margin' | 'cost'
  | 'cash' | 'receivables' | 'payables' | 'inventory'
  | 'plan' | 'prior' | 'forecast'

const SERIES_COLOR: Record<SeriesKey, (p: Palette) => string> = {
  revenue: (p) => p.actual,
  profit: (p) => p.positive,
  margin: (p) => p.teal,
  cost: (p) => p.negative,
  cash: (p) => p.actual,
  receivables: (p) => p.info,
  payables: (p) => p.negative,
  inventory: (p) => p.purple,
  plan: (p) => p.plan,
  prior: (p) => p.prior,
  forecast: (p) => p.forecast,
}

export const seriesColor = (p: Palette, key: SeriesKey): string => SERIES_COLOR[key](p)

/** Kategoriya rangi: faqat segment/kategoriya kabi ro'yxatlar uchun (ma'nosi yo'q, faqat ajratish uchun). */
export const categoryColor = (p: Palette, index: number): string => p.series[index % p.series.length]
