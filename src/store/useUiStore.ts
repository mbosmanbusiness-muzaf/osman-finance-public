import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Currency } from '@/lib/format'
import type { Period, RangeKey, SliceFilters } from '@/lib/period'
import { CURRENT_PERIOD } from '@/data/seed'

export type Theme = 'dark' | 'light'

export interface UiState {
  theme: Theme
  currency: Currency
  period: Period
  sidebarCollapsed: boolean
  collapsedGroups: Record<string, boolean>
  recentPaths: string[]
  activeSection: string
  sectionFilters: Record<string, SliceFilters>
  setFilters: (section: string, filters: SliceFilters) => void
  toggleGroup: (group: string) => void
  visit: (path: string) => void
  setTheme: (t: Theme) => void
  toggleTheme: () => void
  setCurrency: (c: Currency) => void
  setPeriod: (p: Partial<Period>) => void
  setRange: (r: RangeKey) => void
  setAsOf: (m: string) => void
  toggleSidebar: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'dark',
      currency: 'UZS',
      period: { asOf: CURRENT_PERIOD, range: '12m' },
      sidebarCollapsed: false,
      collapsedGroups: {}, recentPaths: [], activeSection: '', sectionFilters: {},
      setFilters: (section, filters) => set((s) => ({ sectionFilters: { ...s.sectionFilters, [section]: filters } })),
      toggleGroup: (group) => set((s) => ({ collapsedGroups: { ...s.collapsedGroups, [group]: !s.collapsedGroups[group] } })),
      visit: (path) => set((s) => ({ recentPaths: [path, ...s.recentPaths.filter((p) => p !== path)].slice(0, 5) })),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setCurrency: (currency) => set({ currency }),
      setPeriod: (p) => set((s) => ({ period: { ...s.period, ...p } })),
      setRange: (range) => set((s) => ({ period: { ...s.period, range } })),
      setAsOf: (asOf) => set((s) => ({ period: { ...s.period, asOf } })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: 'osman-fin-ui-v1', storage: createJSONStorage(() => localStorage) },
  ),
)
