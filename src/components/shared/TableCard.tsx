import { translate as localize, useLanguageStore } from "@/i18n"
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Jadval kartasi: sarlavha, izoh, o'ng tomonda qisqa matn (soni, davr). */
export function TableCard({ title, subtitle, right, children, span = 1, className }: { title: string; subtitle?: string; right?: ReactNode; children: ReactNode; span?: 1 | 2; className?: string }) {
  useLanguageStore((state) => state.language)
  return (
    <div className={cn('card-surface p-4 min-w-0 flex flex-col gap-3 animate-fade-in', span === 2 && 'lg:col-span-2', className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h3 className="section-title">{localize(title)}</h3>
          {localize(subtitle && <p className="text-xs text-txt-muted mt-0.5 leading-relaxed">{localize(subtitle)}</p>)}
        </div>
        {localize(right && <span className="text-xs text-txt-muted num">{localize(right)}</span>)}
      </div>
      {localize(children)}
    </div>
  )
}

/** Blok sarlavhasi — sahifani mantiqiy qismlarga ajratadi (KPI ikkinchi qatori bilan bir xil uslub). */
export function SectionTitle({ title }: { title: string }) {
  useLanguageStore((state) => state.language)
  return (
    <div className="flex items-center gap-3 px-0.5">
      <span className="text-xs font-medium text-txt-muted whitespace-nowrap">{localize(title)}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}
