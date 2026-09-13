import { translate as localize, useLanguageStore } from "@/i18n"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCurrency } from '@/hooks'
import { fmtMonth } from '@/lib/format'
import { fcfOf, icfOf, ocfOf } from '@/lib/finance'
import { cn, fin } from '@/lib/utils'
import type { CashflowMonth } from '@/types'
import { CF_ITEM_LABELS, type CfItemKey } from './common'

interface Props {
  month: string | null
  row: CashflowMonth | undefined
  onClose: () => void
}

const GROUPS: { title: string; keys: CfItemKey[]; total: (c: CashflowMonth) => number; totalLabel: string }[] = [
  { title: 'Operatsion faoliyat', keys: ['receiptsFromCustomers', 'otherOperatingReceipts', 'paidToSuppliers', 'salariesPaid', 'opexPaid', 'taxesPaid', 'interestPaid'], total: ocfOf, totalLabel: 'Operatsion CF' },
  { title: 'Investitsion faoliyat', keys: ['capex', 'assetSales'], total: icfOf, totalLabel: 'Investitsion CF' },
  { title: 'Moliyaviy faoliyat', keys: ['loansReceived', 'loansRepaid', 'dividendsPaid'], total: fcfOf, totalLabel: 'Moliyaviy CF' },
]

function Amount({ v, bold = false }: { v: number; bold?: boolean }) {
  useLanguageStore((state) => state.language)
  const { money, moneyFull } = useCurrency()
  const n = fin(v)
  return (
    <span className={cn('num', bold ? 'font-semibold' : 'font-medium', n > 0 ? 'text-positive' : n < 0 ? 'text-negative' : 'text-txt-secondary')} title={localize(moneyFull(n))}>
      {localize(money(n, { sign: true }))}
    </span>
  )
}

/** Oy bo'yicha to'g'ri (direct) usul tafsiloti — jadval qatori bosilganda. */
export function MonthDetailDialog({ month, row, onClose }: Props) {
  useLanguageStore((state) => state.language)
  const { money } = useCurrency()
  const open = month !== null
  const net = row ? ocfOf(row) + icfOf(row) + fcfOf(row) : 0
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{localize(month ? fmtMonth(month, true) : '')}{localize(" — pul oqimi tafsiloti")}</DialogTitle>
          <DialogDescription>{localize("To'g'ri (direct) usul: kirim musbat, chiqim manfiy. Yakuniy qoldiq = boshlang'ich + OCF + ICF + FCF.")}</DialogDescription>
        </DialogHeader>
        {(!row ? (
          <div className="text-sm text-txt-muted py-6 text-center">{localize("Bu oy uchun ma'lumot yo'q")}</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {([
                { l: "Boshlang'ich qoldiq", v: fin(row.openingCash) },
                { l: "Sof o'zgarish", v: net },
                { l: 'Yakuniy qoldiq', v: fin(row.closingCash) },
                { l: 'Free cash flow', v: ocfOf(row) + fin(row.capex) },
              ].map((k) => (
                <div key={k.l} className="rounded-lg bg-elevated px-3 py-2">
                  <div className="text-[11px] text-txt-muted">{localize(k.l)}</div>
                  <div className="num font-semibold text-txt-primary" title={localize(k.l)}>{localize(money(k.v))}</div>
                </div>
              )))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {(GROUPS.map((g) => (
                <div key={g.title} className={cn('rounded-lg border border-border p-3', g.keys.length > 3 && 'md:row-span-2')}>
                  <div className="section-title text-sm mb-2">{localize(g.title)}</div>
                  <ul className="space-y-1.5 text-sm">
                    {(g.keys.map((k) => (
                      <li key={k} className="flex items-center justify-between gap-3">
                        <span className="text-txt-secondary truncate" title={localize(CF_ITEM_LABELS[k])}>{localize(CF_ITEM_LABELS[k])}</span>
                        <Amount v={row[k]} />
                      </li>
                    )))}
                    <li className="flex items-center justify-between gap-3 border-t border-border pt-1.5 mt-1">
                      <span className="text-txt-primary font-medium">{localize(g.totalLabel)}</span>
                      <Amount v={g.total(row)} bold />
                    </li>
                  </ul>
                </div>
              )))}
            </div>
          </div>
        ))}
      </DialogContent>
    </Dialog>
  )
}
