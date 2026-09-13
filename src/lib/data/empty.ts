import type { Dataset, Settings } from '@/types'

export function emptyDataset(settings: Settings): Dataset {
  return { settings, products: [], customers: [], suppliers: [], employees: [], sales: [], purchases: [], pnl: [], balance: [], cashflow: [], inventory: [], invoices: [], bills: [], budget: [], kpiTargets: [] }
}
