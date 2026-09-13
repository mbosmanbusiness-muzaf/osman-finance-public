import { useEffect, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Printer, SlidersHorizontal, X } from 'lucide-react'
import { usePeriod, useSectionFilters } from '@/hooks'
import { useUiStore } from '@/store/useUiStore'
import { useDataStore } from '@/store/useDataStore'
import { isPeriodAvailable, shiftPeriod, previousWindow, lastYearWindow, monthEnd, type ComparisonKey } from '@/lib/period'
import { fmtDate, fmtMonth, fmtNum } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { useTranslation } from '@/i18n'
import { PeriodPicker } from './PeriodPicker'
import { cn } from '@/lib/utils'

interface FilterBarProps { children?: ReactNode; actions?: ReactNode; className?: string }
export function FilterBar({ children, actions, className }: FilterBarProps) {
  const { period, allMonths, months, prevMonths, prevLabel, hasComparisonPlan } = usePeriod()
  const { t } = useTranslation()
  const setPeriod = useUiStore((s) => s.setPeriod)
  const currency = useUiStore((s) => s.currency)
  const setCurrency = useUiStore((s) => s.setCurrency)
  const section = useUiStore((s) => s.activeSection)
  const raw = useDataStore((s) => s.data)
  const { filters, setFilters, reset } = useSectionFilters()
  const [mobileOpen, setMobileOpen] = useState(false)
  const latest = allMonths.at(-1) ?? period.asOf
  const comparison = period.comparison ?? 'previous'
  const count = Object.values(filters).reduce((n, values) => n + values.length, 0)
  const shift = (direction: -1 | 1) => {
    const next = shiftPeriod(period, direction, allMonths[0])
    if (next.asOf <= latest && isPeriodAvailable(allMonths, next)) setPeriod(next)
  }
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLElement && e.target.closest('input,textarea,select,[contenteditable=true],[role=dialog]')) return
      if (document.querySelector('[role=dialog]')) return
      if (e.key === '[' || e.key === ']') { e.preventDefault(); shift(e.key === '[' ? -1 : 1) }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [period, allMonths, latest])
  const fields: { key: string; label: string; options: { value: string; label: string }[] }[] = []
  if (section === 'sales') fields.push({ key: 'segment', label: 'Segment', options: [...new Set(raw.customers.map((c) => c.segment))].map((value) => ({ value, label: value })) })
  if (['sales', 'procurement', 'warehouse', 'finance'].includes(section)) fields.push({ key: 'category', label: 'Kategoriya', options: [...new Set(raw.products.map((p) => p.category))].map((value) => ({ value, label: value })) })
  if (['sales', 'procurement', 'warehouse'].includes(section)) fields.push({ key: 'supplier', label: 'Yetkazib beruvchi', options: raw.suppliers.map((s) => ({ value: s.id, label: s.name })) })
  const chips = Object.entries(filters).flatMap(([key, values]) => values.map((value) => {
    const field = fields.find((f) => f.key === key)
    const label = field?.options.find((o) => o.value === value)?.label ?? value
    return <button key={key + value} type="button" onClick={() => setFilters({ ...filters, [key]: values.filter((v) => v !== value) })} aria-label={t('Filtrni olib tashlash: {name}', { name: key === 'supplier' ? label : t(label) })} className="inline-flex max-w-full items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-1 text-xs focus-visible:ring-2 focus-visible:ring-gold"><span className="break-words">{t(field?.label ?? key)}: {t(label)}</span><X className="h-3 w-3 shrink-0" /></button>
  }))
  const controls = <>{fields.map((field) => <Popover key={field.key}><PopoverTrigger asChild><Button variant="outline" size="sm">{t(field.label)}{filters[field.key]?.length ? ` (${fmtNum(filters[field.key].length)})` : ''}</Button></PopoverTrigger><PopoverContent className="max-h-72 overflow-auto space-y-2" align="start"><p className="text-sm font-medium">{t(field.label)}</p>{field.options.map((option) => <label key={option.value} className="flex gap-2 items-center text-sm"><input type="checkbox" checked={filters[field.key]?.includes(option.value) ?? false} onChange={(e) => setFilters({ ...filters, [field.key]: e.target.checked ? [...(filters[field.key] ?? []), option.value] : (filters[field.key] ?? []).filter((v) => v !== option.value) })} className="accent-gold h-4 w-4" />{field.key === 'supplier' ? option.label : t(option.label)}</label>)}</PopoverContent></Popover>)}{children}</>
  const utility = <>
    <div className="segmented" role="group" aria-label={t('Valyuta')}>{(['UZS', 'USD'] as const).map((c) => <button key={c} type="button" aria-pressed={currency === c} onClick={() => setCurrency(c)} className={cn('segmented-item', currency === c && 'segmented-item-active')}>{c}</button>)}</div>
    {actions}
    <Button variant="outline" size="sm" onClick={() => window.print()} title={t('Chop etish / PDF')}><Printer />{t('Chop etish / PDF')}</Button>
    <Button variant="ghost" size="sm" onClick={() => { reset(); setPeriod({ asOf: latest, range: '12m', comparison: 'previous', from: undefined }); setCurrency('UZS') }}>{t('Tiklash ({n})', { n: fmtNum(count) })}</Button>
  </>
  return <div data-no-print className={cn('sticky top-14 z-20 rounded-xl border border-border bg-surface p-3 shadow-sm space-y-2', className)}>
    <div className="flex flex-wrap items-center gap-2">
      <PeriodPicker />
      <div className="flex items-center rounded-lg border border-border">
        {([-1, 1] as const).map((direction) => { const next = shiftPeriod(period, direction, allMonths[0]); const label = t(direction === -1 ? 'Oldingi davr' : 'Keyingi davr'); return <Button key={direction} variant="ghost" size="icon" aria-label={label} title={label + (direction === -1 ? ' [' : ' ]')} disabled={next.asOf > latest || !isPeriodAvailable(allMonths, next)} onClick={() => shift(direction)}>{direction === -1 ? <ChevronLeft /> : <ChevronRight />}</Button> })}
      </div>
      {/* taqqoslash: brauzerning o'z ro'yxati karta tashqarisida, noto'g'ri joyda ochilardi (egasi xabar bergan xato) */}
      <Select value={comparison} onValueChange={(value) => setPeriod({ comparison: value as ComparisonKey })}>
        <SelectTrigger aria-label={t('Taqqoslash')} title={t('Taqqoslash')} className="h-9 w-auto min-w-[168px] max-w-full px-3 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent align="start">
          {([['previous', 'Oldingi davr', previousWindow(allMonths, months).length > 0], ['year', "O'tgan yil", lastYearWindow(allMonths, months).length > 0], ['plan', 'Reja (byudjet)', hasComparisonPlan], ['none', 'Taqqoslashsiz', true]] as const).map(([value, label, available]) => (
            <SelectItem key={value} value={value} disabled={!available} className="text-xs">
              {t(label)}{!available ? ` — ${t('Ma’lumot yetarli emas')}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="hidden lg:flex w-full 2xl:w-auto 2xl:flex-1 flex-wrap items-center gap-2">{controls}<div className="ml-auto flex flex-wrap items-center gap-2">{utility}</div></div>
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}><DialogTrigger asChild><Button variant="outline" className="lg:hidden"><SlidersHorizontal />{t('Filtrlar ({n})', { n: fmtNum(count) })}</Button></DialogTrigger><DialogContent className="top-auto bottom-0 left-0 translate-x-0 translate-y-0 w-full max-w-none rounded-b-none lg:max-w-2xl" aria-describedby="filter-description"><DialogTitle>{t('Filtrlar')}</DialogTitle><DialogDescription id="filter-description">{t('Tanlov joriy bo‘limda saqlanadi')}</DialogDescription><div className="flex flex-wrap gap-2">{controls}</div><div className="flex flex-wrap gap-2">{chips}</div><div className="flex flex-wrap gap-2">{utility}</div></DialogContent></Dialog>
    </div>
    {!!count && <div className="flex flex-wrap gap-1.5" aria-label={t('Faol filtrlar')}>{chips}</div>}
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-txt-muted" role="status">
      <span>{t('Hisobot oyi')}: {fmtMonth(period.asOf, true)}</span><span>{t('Ma’lumot sanasi')}: {fmtDate(monthEnd(latest))}</span>
      {comparison !== 'none' && <span>{comparison === 'plan' ? t(hasComparisonPlan ? 'Rejaga nisbatan' : 'Bu kesim uchun reja yo‘q') : prevMonths.length ? `${t('Taqqoslash')}: ${prevLabel}` : t('Taqqoslash uchun to‘liq davr yo‘q')}</span>}
      {!!count && <span>{t('Filtrlar tegishli operatsiyalar jadvallariga qo‘llanadi')}</span>}
    </div>
  </div>
}
