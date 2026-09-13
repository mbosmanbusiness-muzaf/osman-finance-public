import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useUiStore } from '@/store/useUiStore'
import { useLanguageStore, useTranslation, LANGUAGES } from '@/i18n'
import { NAV_GROUPS } from '@/components/layout/nav'
import { useSliceNavigate } from '@/hooks'
import { isPeriodAvailable, RANGE_LABELS, type RangeKey } from '@/lib/period'
import { allMonthsOf, useDataStore } from '@/store/useDataStore'
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function pageCommands() { return NAV_GROUPS.flatMap((g) => g.items) }
export function CommandPalette() {
  const { t } = useTranslation()
  const navigate = useSliceNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [selected, setSelected] = useState(0)
  const recent = useUiStore((s) => s.recentPaths)
  const period = useUiStore((s) => s.period)
  const data = useDataStore((s) => s.data)
  const trigger = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  useEffect(() => { useUiStore.getState().visit(location.pathname) }, [location.pathname])
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); previousFocus.current = document.activeElement as HTMLElement; setOpen((v) => !v) }
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])
  const commands = useMemo(() => {
    const pages = pageCommands()
    const pageItems = pages.map((page) => ({ id: page.to, label: t(page.label), run: () => navigate(page.to) }))
    const recentItems = recent.filter((path) => path !== location.pathname && pages.some((p) => p.to === path)).map((path) => ({ ...pageItems.find((p) => p.id === path)!, id: 'recent:' + path, label: t('Yaqinda') + ' · ' + t(pages.find((p) => p.to === path)!.label) }))
    const ui = useUiStore.getState()
    const actions = [
      { id: 'theme', label: t('Temani almashtirish'), run: ui.toggleTheme },
      ...(['UZS', 'USD'] as const).map((currency) => ({ id: currency, label: t('Valyuta') + ': ' + currency, run: () => ui.setCurrency(currency) })),
      ...(['uz', 'ru', 'en'] as const).map((language) => ({ id: language, label: t('Til') + ': ' + LANGUAGES[language], run: () => useLanguageStore.getState().setLanguage(language) })),
      ...(Object.keys(RANGE_LABELS) as RangeKey[]).filter((range) => range !== 'custom' && isPeriodAvailable(allMonthsOf(data), { ...period, range })).map((range) => ({ id: range, label: t('Davr') + ': ' + t(RANGE_LABELS[range]), run: () => ui.setRange(range) })),
    ]
    return [...(!query ? recentItems : []), ...pageItems, ...actions].filter((command) => command.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  }, [query, recent, location.pathname, period, data, t, navigate])
  useEffect(() => { setSelected(0) }, [query])
  useEffect(() => { document.getElementById(`command-${selected}`)?.scrollIntoView?.({ block: 'nearest' }) }, [selected])
  const choose = (index: number) => { const command = commands[index]; if (command) { setOpen(false); command.run() } }
  return <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (value) { setQuery(''); setSelected(0) } }}>
    <DialogTrigger asChild><Button ref={trigger} variant="outline" className="h-9 w-full justify-start gap-2 px-3 font-normal text-txt-muted" aria-label={t('Buyruqlarni qidirish')} title={t('Buyruqlarni qidirish') + ' ⌘K / Ctrl+K'}><Search className="shrink-0" /><span className="truncate">{t('Qidirish')}</span><kbd className="ml-auto hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[11px] sm:inline">⌘K</kbd></Button></DialogTrigger>
    <DialogContent size="md" onCloseAutoFocus={(e) => { e.preventDefault(); (previousFocus.current?.isConnected ? previousFocus.current : trigger.current)?.focus(); previousFocus.current = null }}>
      <DialogTitle>{t('Buyruqlarni qidirish')}</DialogTitle><DialogDescription>{t('Sahifa yoki tezkor amalni tanlang')}</DialogDescription>
      <input autoFocus role="combobox" aria-label={t('Buyruqlarni qidirish')} aria-expanded="true" aria-controls="command-results" aria-activedescendant={commands.length ? `command-${Math.min(selected, commands.length - 1)}` : undefined} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setSelected((v) => commands.length ? (v + (e.key === 'ArrowDown' ? 1 : -1) + commands.length) % commands.length : 0) }
        if (e.key === 'Enter') { e.preventDefault(); choose(selected) }
      }} className="h-10 w-full rounded-lg border border-border bg-base px-3 focus-visible:ring-2 focus-visible:ring-gold" />
      <div role="listbox" id="command-results" aria-label={t('Buyruqlar')} className="max-h-[45vh] overflow-y-auto space-y-1">{commands.map((command, index) => <div role="option" aria-selected={index === selected} id={`command-${index}`} key={command.id} onMouseMove={() => setSelected(index)} onClick={() => choose(index)} className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${index === selected ? 'bg-gold/15 text-gold-bright' : 'text-txt-secondary'}`}>{command.label}</div>)}{!commands.length && <p className="p-3 text-sm text-txt-muted">{t('Natija topilmadi')}</p>}</div>
    </DialogContent>
  </Dialog>
}
