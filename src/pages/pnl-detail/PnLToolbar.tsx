import { translate as localize, useLanguageStore } from "@/i18n"
import { ChevronsDownUp, ChevronsUpDown, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BIG_VARIANCE_PCT } from './columns'

interface PnLToolbarProps {
  onExpandAll: () => void
  onCollapseAll: () => void
}

/** Jadval ustidagi boshqaruv: hammasini ochish / yopish + rang va chegara izohi. */
export function PnLToolbar({ onExpandAll, onCollapseAll }: PnLToolbarProps) {
  useLanguageStore((state) => state.language)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={onExpandAll}>
        <ChevronsUpDown />{localize(" Hammasini ochish")}</Button>
      <Button variant="outline" size="sm" onClick={onCollapseAll}>
        <ChevronsDownUp />{localize(" Yopish")}</Button>
      <span className="hidden lg:inline-flex items-center gap-1 text-[11px] text-txt-muted">
        <Info className="h-3 w-3 shrink-0" />{localize("Variance = Fakt − Plan. Rang foydaga ta'siri bo'yicha: ")}<span className="text-positive">{localize("yashil")}</span>{localize(" — ijobiy,")}{localize(' ')}
        <span className="text-negative">{localize("qizil")}</span>{localize(" — salbiy. |Var %| ≥")}{(BIG_VARIANCE_PCT)}{localize("% qalin ko'rsatiladi.")}</span>
    </div>
  )
}
