import { useEffect, useState } from 'react'
import { writeSlice } from '@/lib/period'
import { translate as localize, useLanguageStore } from '@/i18n'
import { useLocation, NavLink } from 'react-router-dom'
import { ChevronDown, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/store/useUiStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { BrandMark } from './BrandMark'
import { NAV_GROUPS, type NavItem } from './nav'

export function Sidebar() {
  useLanguageStore((state) => state.language)
  const [shortScreen, setShortScreen] = useState(() => window.matchMedia('(max-height: 900px)').matches)
  useEffect(() => { const media = window.matchMedia('(max-height: 900px)'); const update = () => setShortScreen(media.matches); media.addEventListener('change', update); return () => media.removeEventListener('change', update) }, [])
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggle = useUiStore((s) => s.toggleSidebar)
  const { pathname } = useLocation()
  const groups = useUiStore((s) => s.collapsedGroups)
  const toggleGroup = useUiStore((s) => s.toggleGroup)
  const period = useUiStore((s) => s.period)
  const currency = useUiStore((s) => s.currency)
  const filters = useUiStore((s) => s.sectionFilters)
  useEffect(() => {
    const current = NAV_GROUPS.find((g) => g.items.some((i) => i.to === pathname))
    if (current) useUiStore.setState((s) => ({ collapsedGroups: { ...s.collapsedGroups, [current.label]: false } }))
  }, [pathname])

  const renderItem = (item: NavItem) => {
    const link = (
      <NavLink
        key={item.to}
        to={item.to + writeSlice('', { period, currency, filters: filters[item.to.split('/')[1]] ?? {} })}
        aria-label={localize(item.label)}
        title={localize(item.label)}
        end
        className={({ isActive }) =>
          cn('flex items-center gap-2.5 h-8 px-3 rounded-full text-sm font-medium transition-colors', collapsed && 'justify-center px-0',
            isActive ? 'bg-gold/15 text-gold-bright' : 'text-txt-secondary hover:bg-elevated hover:text-txt-primary')
        }
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{localize(item.label)}</span>}
      </NavLink>
    )
    return collapsed ? (
      <Tooltip key={item.to}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{localize(item.label)}</TooltipContent>
      </Tooltip>
    ) : link
  }

  return (
    <aside className={cn('hidden md:flex sticky top-0 h-screen self-start flex-col border-r border-border bg-surface transition-[width] duration-200 shrink-0', collapsed ? 'w-[64px]' : 'w-[264px]')}>
      <div className={cn('flex items-center gap-2.5 h-14 px-4 border-b border-border', collapsed && 'justify-center px-0')}>
        <BrandMark />
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="font-semibold text-[15px] tracking-heading text-txt-primary">OSMAN</div>
            <div className="text-[11px] text-txt-muted">{localize('Moliyaviy analitika')}</div>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-3" aria-label={localize("Bo'limlar")}>
        {NAV_GROUPS.map((g) => (
          <div key={g.label} className="mt-3">
            {!collapsed && <button type="button" onClick={() => { if (groups[g.label] === undefined) useUiStore.setState({ collapsedGroups: { ...groups, [g.label]: !shortScreen } }); else toggleGroup(g.label) }} aria-expanded={(groups[g.label] === undefined ? !shortScreen : !groups[g.label])} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-txt-muted text-left focus-visible:ring-2 focus-visible:ring-gold"><span>{localize(g.label)}</span><ChevronDown className="h-3 w-3 shrink-0" /></button>}
            {(collapsed || (groups[g.label] === undefined ? !shortScreen : !groups[g.label])) && <div className="space-y-0.5">{g.items.map(renderItem)}</div>}
          </div>
        ))}
      </nav>
      <button onClick={toggle} className="h-10 border-t border-border flex items-center justify-center text-txt-muted hover:text-txt-primary hover:bg-elevated transition-colors" aria-label={localize(collapsed ? 'Menyuni kengaytirish' : 'Menyuni yig‘ish')} title={localize(collapsed ? 'Menyuni kengaytirish' : 'Menyuni yig‘ish')}>
        {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
      </button>
    </aside>
  )
}
