import { translate as localize, useLanguageStore } from "@/i18n"
import { useState, type ReactNode } from 'react'
import { Download, Maximize2, MoreHorizontal, FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { exportToCsv, exportToXlsx } from '@/lib/export'

export interface ChartCardProps {
  title: string
  subtitle?: string
  children: ReactNode | ((opts: { height: number; expanded: boolean }) => ReactNode)
  height?: number
  /** eksport uchun qatorlar (bo'lmasa eksport menyusi yashirinadi) */
  exportData?: Record<string, unknown>[]
  exportName?: string
  /** sarlavha o'ng tomonidagi qo'shimcha elementlar (segment filtri va h.k.) */
  headerRight?: ReactNode
  footer?: ReactNode
  className?: string
  /** 2 ustunli gridda to'liq kenglik */
  span?: 1 | 2
  noPadding?: boolean
}

/** Grafik kartasi: sarlavha, izoh, o'ng yuqorida menyu (kattalashtirish/eksport). */
export function ChartCard({ title, subtitle, children, height = 280, exportData, exportName, headerRight, footer, className, span = 1, noPadding = false }: ChartCardProps) {
  useLanguageStore((state) => state.language)
  const [open, setOpen] = useState(false)
  const name = exportName ?? title.replace(/[^\wЀ-ӿ' -]/g, '').trim()
  const render = (h: number, expanded: boolean) => (typeof children === 'function' ? children({ height: h, expanded }) : children)
  return (
    <div className={cn('card-surface flex flex-col min-w-0 animate-fade-in', span === 2 && 'lg:col-span-2', className)}>
      {/* sarlavha kamida 60% joyni oladi va ikki qatorga o'tadi; o'ng blok (chip, segment) joy yetmasa pastga tushadi */}
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1 px-4 pt-3.5 pb-1.5">
        <div className="min-w-0 flex-1 basis-[60%]">
          <h3 className="section-title line-clamp-2" title={localize(title)}>{localize(title)}</h3>
          {subtitle && <p className="text-xs text-txt-muted mt-1 line-clamp-2 leading-relaxed" title={localize(subtitle)}>{localize(subtitle)}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {localize(headerRight)}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={localize("Menyu")}><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setOpen(true)}><Maximize2 />{localize(" Kattalashtirish")}</DropdownMenuItem>
              {(exportData && <DropdownMenuItem onSelect={() => exportToXlsx(exportData, name)}><FileSpreadsheet />{localize(" Excel eksport")}</DropdownMenuItem>)}
              {(exportData && <DropdownMenuItem onSelect={() => exportToCsv(exportData, name)}><Download />{localize(" CSV eksport")}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className={cn('flex-1 min-w-0', noPadding ? '' : 'px-2 pb-2')} style={{ height: height + 8 }}>
        <div style={{ height }} className="w-full min-w-0">{localize(render(height, false))}</div>
      </div>
      {localize(footer && <div className="px-4 pb-3.5 text-xs text-txt-muted">{localize(footer)}</div>)}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>{localize(title)}</DialogTitle>
            {localize(subtitle && <DialogDescription>{localize(subtitle)}</DialogDescription>)}
          </DialogHeader>
          <div style={{ height: 520 }} className="w-full min-w-0">{localize(open && render(520, true))}</div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
