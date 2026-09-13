import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Dataset, TableName } from '@/types'
import { generateDemoData } from '@/data/seed'
import { emptyDataset } from '@/lib/data/empty'
import { setUsdRate } from '@/lib/format'
import { setProtectedTerms } from '@/i18n'
import { isMonthKey } from '@/lib/period'

export const DATA_STORAGE_KEY = 'osman-fin-data-v1'

export interface DataState {
  data: Dataset
  /** har o'zgarishda oshadi — hisob-kitob memo'larini yangilash uchun */
  version: number
  /** oxirgi o'zgarish vaqti (ISO) — "Ma'lumot yangiligi" kartasi */
  updatedAt: string
  setTable: <K extends TableName>(name: K, rows: Dataset[K]) => void
  appendRows: <K extends TableName>(name: K, rows: Dataset[K]) => void
  setSettings: (patch: Partial<Dataset['settings']>) => void
  resetDemo: () => void
  clearAll: () => void
}

const now = () => new Date().toISOString()

/** Ma'lumot faqat brauzerda: demo dataset + localStorage. Server ham, kirish ham yo'q. */
export const useDataStore = create<DataState>()(
  persist(
    (set) => ({
      data: generateDemoData(),
      version: 1,
      updatedAt: now(),
      setTable: (name, rows) => set((s) => ({ data: { ...s.data, [name]: rows }, version: s.version + 1, updatedAt: now() })),
      appendRows: (name, rows) => set((s) => ({ data: { ...s.data, [name]: [...(s.data[name] as unknown[]), ...(rows as unknown[])] as never }, version: s.version + 1, updatedAt: now() })),
      setSettings: (patch) => set((s) => ({ data: { ...s.data, settings: { ...s.data.settings, ...patch } }, version: s.version + 1, updatedAt: now() })),
      resetDemo: () => set((s) => ({ data: generateDemoData(), version: s.version + 1, updatedAt: now() })),
      clearAll: () => set((s) => ({ data: emptyDataset(s.data.settings), version: s.version + 1, updatedAt: now() })),
    }),
    {
      name: DATA_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (s) => ({ data: s.data, version: s.version, updatedAt: s.updatedAt }),
      merge: (persisted, current) => {
        const p = persisted as Partial<DataState> | undefined
        // eski/buzuq saqlangan holat bo'lsa — demo
        if (!p?.data || !Array.isArray(p.data.pnl) || !p.data.settings) return current
        return { ...current, ...p, data: { ...current.data, ...p.data, settings: { ...current.data.settings, ...p.data.settings } } }
      },
    },
  ),
)

// Sozlamadagi USD kursi pul formatlashiga (fmtMoney/toCurrency), ma'lumot nomlari esa tarjima himoyasiga ulanadi
const namesOf = (d: Dataset) => [d.settings.companyName, ...d.customers.map((c) => c.name), ...d.suppliers.map((s) => s.name), ...d.products.map((p) => p.name), ...d.employees.map((e) => e.name)]
const syncFormatting = (d: Dataset) => { setUsdRate(d.settings.usdRate); setProtectedTerms(namesOf(d)) }
syncFormatting(useDataStore.getState().data)
useDataStore.subscribe((s, prev) => { if (s.data !== prev.data) syncFormatting(s.data) })

/** Barcha oylar (P&L bo'yicha; bo'lmasa cashflow/balans bo'yicha), saralangan. */
export function allMonthsOf(d: Dataset): string[] {
  const months = [d.pnl, d.cashflow, d.balance, d.sales, d.purchases, d.budget].flatMap((rows) => rows.map((row) => row.month))
  return Array.from(new Set(months.filter(isMonthKey))).sort()
}
