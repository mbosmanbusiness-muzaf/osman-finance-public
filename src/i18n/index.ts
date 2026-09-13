import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { messages } from './messages'
import { catalog } from './catalog'
import { catalogExtra } from './catalog-extra'
import { catalogPanels } from './catalog-panels'
import { catalogShell } from './catalog-shell'

export type Language = 'uz' | 'ru' | 'en'
export const LOCALES: Record<Language, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-GB' }
export const LANGUAGES: Record<Language, string> = { uz: "O‘zbekcha", ru: 'Русский', en: 'English' }
const dictionary = { ...Object.fromEntries([...catalog, ...catalogExtra, ...catalogPanels, ...catalogShell].map(([source, ru, en]) => [source, { ru, en }])), ...messages }
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** so'z chegarasi: harf/raqam/pastki chiziqdan keyin yoki oldin kelmasa */
const bounded = (alternatives: string[]) => new RegExp('(?<![\\p{L}\\p{N}_])(?:' + alternatives.map(escape).join('|') + ')(?![\\p{L}\\p{N}_])', 'gu')
const phrasePattern = bounded(Object.keys(dictionary).sort((left, right) => right.length - left.length))

/**
 * Tarjima qilinmaydigan ma'lumot nomlari (mijoz, yetkazib beruvchi, mahsulot, xodim, kompaniya):
 * "Toshkent Qurilish MCHJ" → "Toshkent Строительство MCHJ" bo'lib ketmasligi uchun iboralar almashtirilishidan oldin yashiriladi.
 */
let protectedTerms = new Set<string>()
let protectedPattern: RegExp | null = null
export function setProtectedTerms(terms: string[]) {
  const list = Array.from(new Set(terms.filter((term) => term && term.trim().length > 2))).sort((left, right) => right.length - left.length)
  protectedTerms = new Set(list)
  protectedPattern = list.length ? bounded(list) : null
}

export const useLanguageStore = create<{ language: Language; setLanguage: (language: Language) => void }>()(
  persist((set) => ({ language: 'uz', setLanguage: (language) => set({ language }) }), {
    name: 'osman-language-v1',
    storage: createJSONStorage(() => localStorage),
    merge: (saved, current) => {
      const language = (saved as { language?: Language } | undefined)?.language
      return { ...current, language: language && language in LANGUAGES ? language : 'uz' }
    },
  }),
)

/** Yashirilgan nom o'rniga qo'yiladigan belgi (U+0001 — oddiy matnda uchramaydi). */
const MASK = String.fromCharCode(1)
const UNMASK = new RegExp(`${MASK}(\\d+)${MASK}`, 'g')

/** Aniq moslik bo'lmasa — ma'lumot nomlarini yashirib, iboralarni alohida almashtiradi. */
function phraseTranslate(source: string, language: 'ru' | 'en'): string {
  if (protectedTerms.has(source)) return source
  const kept: string[] = []
  const masked = protectedPattern ? source.replace(protectedPattern, (term) => `${MASK}${kept.push(term) - 1}${MASK}`) : source
  const translated = masked.replace(phrasePattern, (phrase) => dictionary[phrase][language])
  return kept.length ? translated.replace(UNMASK, (_, index: string) => kept[Number(index)]) : translated
}

export function t(source: string, values?: Record<string, string | number>, language = useLanguageStore.getState().language): string {
  const translated = language === 'uz' ? source : dictionary[source]?.[language] ?? phraseTranslate(source, language)
  return values ? translated.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match)) : translated
}

export function translate<T>(value: T): T {
  return (typeof value === 'string' ? t(value) : value) as T
}

export function useTranslation() {
  const language = useLanguageStore((state) => state.language)
  return { language, locale: LOCALES[language], t: (source: string, values?: Record<string, string | number>) => t(source, values, language) }
}
