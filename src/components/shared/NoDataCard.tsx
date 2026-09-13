import { translate as localize, useLanguageStore } from "@/i18n"
import { DatabaseZap } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Manbasi hali ulanmagan KPI — kulrang karta: "0" emas, "Ma'lumot yetarli emas" (spetsifikatsiya qoidasi). */
export function NoDataCard({ title, need, className }: { title: string; need: string; className?: string }) {
  useLanguageStore((state) => state.language)
  return (
    <div className={cn('card-surface border-dashed p-4 flex flex-col gap-2.5 min-w-0', className)}>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="status-dot bg-txt-muted/60" aria-label={localize("ma'lumot yo'q")} />
        <span className="text-[13px] font-medium text-txt-secondary truncate" title={localize(title)}>{localize(title)}</span>
      </div>
      <div className="kpi-value text-txt-muted">—</div>
      <span className="text-[11px] font-medium text-txt-muted">{localize("Ma'lumot yetarli emas")}</span>
      <span className="flex items-start gap-1 text-[11px] leading-snug text-txt-muted" title={localize(need)}>
        <DatabaseZap className="h-3.5 w-3.5 shrink-0 mt-px" />
        <span className="line-clamp-2">{localize("Kerak:")} {localize(need)}</span>
      </span>
    </div>
  )
}

/** Grafik yoki jadval o'rnida — manba ulanmagan blok (sarlavha ChartCard bilan bir xil). */
export function NoDataPanel({ title, subtitle, need, span = 1, height = 180 }: { title: string; subtitle?: string; need: string; span?: 1 | 2; height?: number }) {
  useLanguageStore((state) => state.language)
  return (
    <div className={cn('card-surface border-dashed flex flex-col min-w-0', span === 2 && 'lg:col-span-2')}>
      <div className="px-4 pt-3.5 pb-1.5">
        <h3 className="section-title truncate" title={localize(title)}>{localize(title)}</h3>
        {localize(subtitle && <p className="text-xs text-txt-muted mt-1 line-clamp-2 leading-relaxed">{localize(subtitle)}</p>)}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 pb-5 text-center" style={{ minHeight: height }}>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-elevated"><DatabaseZap className="h-5 w-5 text-txt-muted" /></div>
        <div className="text-sm font-medium text-txt-secondary">{localize("Ma'lumot yetarli emas")}</div>
        <div className="text-xs text-txt-muted max-w-sm">{localize("Kerak:")} {localize(need)}</div>
      </div>
    </div>
  )
}
