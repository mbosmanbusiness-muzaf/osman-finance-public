import { writeSlice } from '@/lib/period'
import { useUiStore } from '@/store/useUiStore'
import { CommandPalette } from '@/components/shared/CommandPalette'
import { safeBackTarget } from '@/hooks'
import { useNavigate } from 'react-router-dom'
import { translate as localize, useLanguageStore } from '@/i18n'
import { Menu, Moon, Sun } from 'lucide-react'
import { useLocation, NavLink } from 'react-router-dom'
import { useState } from 'react'
import { useTheme, usePeriod } from '@/hooks'
import { Button } from '@/components/ui/button'
import { NAV_GROUPS } from './nav'
import { fmtMonth } from '@/lib/format'
import { cn } from '@/lib/utils'
import { LanguageSelect } from './LanguageSelect'

/**
 * Sarlavha: chapda — mobil menyu va "orqaga", o'ngda — qidiruv, til, hisobot oyi va tema.
 * Profil va chiqish yo'q: ilova kirishsiz ochiladi.
 */
export function Header() {
  useLanguageStore((state) => state.language)
  const { theme, toggleTheme } = useTheme()
  const slice = useUiStore((s) => ({ period: s.period, currency: s.currency, filters: s.sectionFilters }))
  const { search } = useLocation()
  const navigate = useNavigate()
  const back = safeBackTarget(search)
  const { asOf } = usePeriod()
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <header className="h-14 border-b border-border bg-base/80 backdrop-blur-md flex items-center gap-2 px-4 md:px-6 sticky top-0 z-30">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen((v) => !v)} aria-label={localize('Menyu')}><Menu /></Button>
      {back && <Button variant="ghost" size="sm" onClick={() => navigate(back)}>{localize('← Orqaga')}</Button>}
      {/* qidiruv bo'sh joyni egallaydi: sarlavhada o'ng tomonda katta bo'shliq qolmasin */}
      <div className="min-w-0 flex-1 max-w-[460px]"><CommandPalette /></div>
      <div className="ml-auto flex items-center gap-2">
        <LanguageSelect />
        <span className="hidden md:inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs text-txt-muted num">
          <span className="hidden lg:inline">{localize('Hisobot oyi')}</span>
          <span className="font-medium text-txt-primary">{fmtMonth(asOf, true)}</span>
        </span>
        <Button variant="outline" size="icon" onClick={toggleTheme} aria-label={localize(theme === 'dark' ? "Yorug' tema" : "Qorong'i tema")} title={localize(theme === 'dark' ? "Yorug' tema" : "Qorong'i tema")}>
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>
      </div>
      {mobileOpen && (
        <div className="absolute left-0 right-0 top-14 bg-surface border-b border-border p-2 md:hidden shadow-float max-h-[70vh] overflow-y-auto">
          {NAV_GROUPS.map((g) => (
            <div key={g.label} className="mb-2">
              <div className="px-3 pb-1 text-xs font-medium text-txt-muted">{localize(g.label)}</div>
              {g.items.map((i) => (
                <NavLink key={i.to} to={i.to + writeSlice('', { period: slice.period, currency: slice.currency, filters: slice.filters[i.to.split('/')[1]] ?? {} })} end onClick={() => setMobileOpen(false)} className={({ isActive }) => cn('flex items-center gap-2 h-9 px-3 rounded-full text-sm font-medium', isActive ? 'bg-gold/15 text-gold-bright' : 'text-txt-secondary')}>
                  <i.icon className="h-4 w-4" /> {localize(i.label)}
                </NavLink>
              ))}
            </div>
          ))}
        </div>
      )}
    </header>
  )
}
