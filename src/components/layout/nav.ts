import { ListTree, Scale, Target, TrendingUp, Wallet, Waves, type LucideIcon } from 'lucide-react'
import { ROUTES } from '@/lib/routes'

export interface NavItem { to: string; label: string; icon: LucideIcon }
export interface NavGroup { label: string; items: NavItem[] }

/** Moliyaviy direktor bo'limi — bu ilovadagi yagona bo'lim (kirishsiz, ochiq ko'rinish). */
export const NAV_ITEMS: NavItem[] = [
  { to: ROUTES.pnl, label: 'P&L (foyda va zarar)', icon: TrendingUp },
  { to: ROUTES.pnlDetail, label: 'P&L — batafsil', icon: ListTree },
  { to: ROUTES.bep, label: 'BEP va Sensitivity', icon: Target },
  { to: ROUTES.cashflow, label: 'Cashflow', icon: Waves },
  { to: ROUTES.balance, label: 'Balans va koeffitsiyentlar', icon: Scale },
  { to: ROUTES.budget, label: 'Byudjet (Plan/Fakt)', icon: Wallet },
]

export const NAV_GROUPS: NavGroup[] = [{ label: 'Moliyaviy direktor', items: NAV_ITEMS }]

export const findNavItem = (pathname: string): NavItem | null => NAV_ITEMS.find((i) => i.to === pathname) ?? null
