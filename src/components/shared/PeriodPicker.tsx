import { useEffect, useState } from 'react'
import { CalendarRange } from 'lucide-react'
import { usePeriod } from '@/hooks'
import { useUiStore } from '@/store/useUiStore'
import { useTranslation } from '@/i18n'
import { RANGE_LABELS, isMonthKey, isPeriodAvailable, type RangeKey } from '@/lib/period'
import { fmtMonth } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const groups: [string, RangeKey[]][] = [
  ['Davr boshidan', ['1m', 'qtd', 'ytd']],
  ['Sirg‘aluvchi davrlar', ['3m', '6m', '12m', '24m']],
  ['Yopilgan davrlar', ['last-month', 'last-quarter', 'last-year']],
  ['Boshqa davr', ['all', 'custom']],
]
export function PeriodPicker() {
  const { period, allMonths, months, label } = usePeriod()
  const setPeriod = useUiStore((s) => s.setPeriod)
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(period)
  useEffect(() => { if (open) setDraft(period) }, [open, period])
  const invalid = !isMonthKey(draft.asOf) || (draft.range === 'custom' && (!isMonthKey(draft.from) || draft.from > draft.asOf)) || !isPeriodAvailable(allMonths, draft)
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="outline" className="min-w-0 max-w-full justify-start rounded-lg" title={label}><CalendarRange className="shrink-0" /><span className="truncate">{label === '—' ? fmtMonth(period.asOf, true) : label}</span></Button></PopoverTrigger>
    <PopoverContent align="start" className="w-[min(440px,calc(100vw-24px))] max-h-[80dvh] overflow-y-auto p-4 space-y-3">
      <h2 className="text-sm font-semibold">{t('Davr')}</h2>
      <label className="block space-y-1 text-xs"><span>{t('Hisobot oyi')}</span><Input type="month" aria-label={t('Hisobot oyi')} min={allMonths[0]} max={allMonths.at(-1)} value={draft.asOf} onChange={(e) => setDraft({ ...draft, asOf: e.target.value })} /></label>
      {groups.map(([title, keys]) => <fieldset key={title} className="space-y-1"><legend className="text-xs text-txt-muted mb-1">{t(title)}</legend><div className="grid grid-cols-2 gap-1.5">{keys.map((key) => {
        const candidate = { ...draft, range: key, from: draft.from ?? months[0] ?? allMonths[0] ?? draft.asOf }
        const unavailable = key !== 'custom' && !isPeriodAvailable(allMonths, candidate)
        return <span key={key} title={unavailable ? t('Bu davr uchun to‘liq ma’lumot yo‘q') : undefined}><button type="button" disabled={unavailable} aria-pressed={draft.range === key} onClick={() => setDraft(candidate)} className={cn('w-full min-h-9 rounded-lg border px-3 py-2 text-left text-xs focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-40', draft.range === key ? 'border-gold/50 bg-gold/10 text-gold-bright' : 'border-border hover:bg-elevated')}>{t(RANGE_LABELS[key])}{unavailable && <span className="block text-[10px]">{t('Ma’lumot yetarli emas')}</span>}</button></span>
      })}</div></fieldset>)}
      {draft.range === 'custom' && <label className="block space-y-1 text-xs"><span>{t('Boshlanish')}</span><Input aria-label={t('Boshlanish')} type="month" min={allMonths[0]} max={draft.asOf} value={draft.from ?? ''} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></label>}
      {invalid && <p role="alert" className="text-xs text-warning">{t('Bu davr uchun to‘liq ma’lumot yo‘q')}</p>}
      <Button className="w-full" disabled={invalid} onClick={() => { setPeriod(draft); setOpen(false) }}>{t('Qo‘llash')}</Button>
    </PopoverContent>
  </Popover>
}
