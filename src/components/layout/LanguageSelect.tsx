import { LANGUAGES, useLanguageStore, type Language } from '@/i18n'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'

/** Tugmada qisqa kod (UZ/RU/EN), ro'yxatda to'liq nom. */
const CODES: Record<Language, string> = { uz: 'UZ', ru: 'RU', en: 'EN' }

/** Til tanlagich — ixcham tugma va ochiluvchi ro'yxat (ro'yxat tugma ostiga biriktirilgan). */
export function LanguageSelect() {
  const language = useLanguageStore((state) => state.language)
  const setLanguage = useLanguageStore((state) => state.setLanguage)
  return (
    <Select value={language} onValueChange={(value) => setLanguage(value as Language)}>
      <SelectTrigger aria-label="Language / Язык / Til" title={LANGUAGES[language]} className="h-9 w-auto gap-1.5 px-3 text-xs font-semibold">
        {CODES[language]}
      </SelectTrigger>
      <SelectContent align="end">
        {(Object.keys(CODES) as Language[]).map((code) => (
          <SelectItem key={code} value={code} className="text-sm">
            <span className="font-semibold">{CODES[code]}</span>
            <span className="ml-2 text-txt-muted">{LANGUAGES[code]}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
