import { fmtDate } from '@/lib/format'
import { translate as localize, useLanguageStore } from "@/i18n"
import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useDataset, usePeriod } from '@/hooks'
import { FilterBar } from './FilterBar'
import { EmptyState } from './EmptyState'

export interface PageLayoutProps {
  title: string
  subtitle?: string
  /** FilterBar ichidagi sahifaga xos filtrlar */
  filters?: ReactNode
  /** FilterBar o'ng tomonidagi tugmalar */
  actions?: ReactNode
  /** KPI kartalar (qator) */
  kpis?: ReactNode
  kpiCols?: 4 | 5 | 6 | 8
  /** Ikkinchi KPI qatori (masalan, savdo ko'rsatkichlari) — sarlavha bilan */
  kpisSecondary?: ReactNode
  kpisSecondaryTitle?: string
  kpisSecondaryCols?: 4 | 5 | 6 | 8
  /** Grafik gridi (2×2). ChartCard span={2} bilan to'liq kenglik */
  charts?: ReactNode
  /** Grafiklardan keyingi qo'shimcha bloklar */
  children?: ReactNode
  /** Eng pastdagi to'liq jadval */
  table?: ReactNode
  hideFilterBar?: boolean
  /** ma'lumot bo'sh bo'lsa ham sahifani ko'rsatish (admin) */
  allowEmpty?: boolean
  skeletonKpis?: number
}

const KPI_COLS: Record<NonNullable<PageLayoutProps['kpiCols']>, string> = {
  4: 'grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5',
  6: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6',
  8: 'grid-cols-2 md:grid-cols-4 2xl:grid-cols-8',
}

/**
 * Sarlavha bloki (oltin fon + filtrlar) → KPI qatori → 2×2 grafik gridi → to'liq jadval.
 * Barcha sahifalar shu komponent orqali quriladi.
 */
export function PageLayout({ title, subtitle, filters, actions, kpis, kpiCols = 6, kpisSecondary, kpisSecondaryTitle, kpisSecondaryCols = 6, charts, children, table, hideFilterBar = false, allowEmpty = false }: PageLayoutProps) {
  useLanguageStore((state) => state.language)
  const { isEmpty, data } = useDataset()
  const { label } = usePeriod()
  const [printedAt, setPrintedAt] = useState(() => new Date().toISOString())
  useEffect(() => { const before = () => setPrintedAt(new Date().toISOString()); window.addEventListener('beforeprint', before); return () => window.removeEventListener('beforeprint', before) }, [])

  return (
    <div className="space-y-4">
      <div className="print-heading">{data.settings.companyName} · {localize(title)} · {label} · {localize("Chop etilgan sana")}: {fmtDate(printedAt.slice(0, 10))}</div>
      <section className="hero-wash p-4 md:p-5 space-y-4">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-[28px] leading-tight tracking-display">{localize(title)}</h1>
          {localize(subtitle && <p className="text-sm text-txt-secondary mt-1.5 max-w-4xl">{localize(subtitle)}</p>)}
        </div>
      </section>
      {(!hideFilterBar && <FilterBar actions={actions}>{localize(filters)}</FilterBar>)}
      {(isEmpty && !allowEmpty ? (
        <EmptyState />
      ) : (
        <>
          {localize(kpis && <div className={cn('grid gap-3', KPI_COLS[kpiCols])}>{localize(kpis)}</div>)}
          {localize(kpisSecondary && (
            <div className="space-y-2.5">
              {localize(kpisSecondaryTitle && <div className="flex items-center gap-3 px-0.5"><span className="text-xs font-medium text-txt-muted">{localize(kpisSecondaryTitle)}</span><span className="h-px flex-1 bg-border" /></div>)}
              <div className={cn('grid gap-3', KPI_COLS[kpisSecondaryCols])}>{localize(kpisSecondary)}</div>
            </div>
          ))}
          {localize(charts && <div className="grid gap-3 lg:grid-cols-2">{localize(charts)}</div>)}
          {localize(children)}
          {localize(table && <div className="card-surface p-4">{localize(table)}</div>)}
        </>
      ))}
    </div>
  )
}
