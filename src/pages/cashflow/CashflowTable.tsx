import { translate as localize, useLanguageStore } from "@/i18n"
import { useMemo } from 'react'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { DataTable, performancePct, perfTone } from '@/components/shared'
import { useCurrency } from '@/hooks'
import { fmtMonth, fmtPct } from '@/lib/format'
import type { CfMonthPoint, CfTotals } from '@/lib/finance'
import { cn, fin } from '@/lib/utils'
import type { CashflowMonth } from '@/types'

export interface CfTableRow {
  month: string
  opening: number
  receipts: number
  ocf: number
  planOcf: number
  ocfPct: number | null
  icf: number
  fcf: number
  netChange: number
  closing: number
  planClosing: number
  closingPct: number | null
}

/** Plan > 0 bo'lsa bajarilish %, aks holda null ("—"). */
function pctOf(fact: number, plan: number): number | null {
  return fin(plan) > 0 ? performancePct(fact, plan) : null
}

export function buildRows(series: CfMonthPoint[], byMonth: Map<string, CashflowMonth>): CfTableRow[] {
  return series.map((s) => {
    const c = byMonth.get(s.month)
    return {
      month: s.month,
      opening: s.opening,
      receipts: fin(c?.receiptsFromCustomers) + fin(c?.otherOperatingReceipts),
      ocf: s.ocf,
      planOcf: s.planOcf,
      ocfPct: pctOf(s.ocf, s.planOcf),
      icf: s.icf,
      fcf: s.fcf,
      netChange: s.netChange,
      closing: s.closing,
      planClosing: s.planClosing,
      closingPct: pctOf(s.closing, s.planClosing),
    }
  })
}

const TONE_CLASS = { good: 'text-positive', warn: 'text-warning', bad: 'text-negative' } as const

function PctCell({ v }: { v: number | null }) {
  useLanguageStore((state) => state.language)
  if (v === null) return <span className="text-txt-muted">—</span>
  return <span className={cn('font-medium', TONE_CLASS[perfTone(v)])}>{localize(fmtPct(v, 0))}</span>
}

function Signed({ v }: { v: number }) {
  useLanguageStore((state) => state.language)
  const { money } = useCurrency()
  const n = fin(v)
  return <span className={cn(n < 0 && 'text-negative')}>{localize(money(n))}</span>
}

const col = createColumnHelper<CfTableRow>()
const right = { meta: { align: 'right' as const } }

interface Props {
  series: CfMonthPoint[]
  totals: CfTotals
  byMonth: Map<string, CashflowMonth>
  onRowClick: (month: string) => void
}

/** Oylik cashflow jadvali: Plan | Fakt | % (OCF va yakuniy qoldiq), footer yig'indilari. */
export function CashflowTable({ series, totals, byMonth, onRowClick }: Props) {
  useLanguageStore((state) => state.language)
  const { money } = useCurrency()
  const rows = useMemo(() => buildRows(series, byMonth), [series, byMonth])

  const columns = useMemo<ColumnDef<CfTableRow, any>[]>(() => [ // eslint-disable-line @typescript-eslint/no-explicit-any
    col.accessor('month', { header: 'Oy', cell: (i) => <span className="font-medium text-txt-primary">{localize(fmtMonth(i.getValue()))}</span>, meta: { exportLabel: 'Oy' } }),
    col.accessor('opening', { header: "Boshlang'ich", cell: (i) => money(i.getValue()), ...right }),
    col.accessor('receipts', { header: 'Tushum', cell: (i) => money(i.getValue()), ...right }),
    col.accessor('ocf', { header: 'OCF', cell: (i) => <Signed v={i.getValue()} />, ...right }),
    col.accessor('planOcf', { header: 'Plan OCF', cell: (i) => <span className="text-txt-secondary">{localize(money(i.getValue()))}</span>, ...right }),
    col.accessor('ocfPct', { header: '%', cell: (i) => <PctCell v={i.getValue()} />, ...right, enableSorting: false, meta: { align: 'right', exportLabel: 'OCF %' } }),
    col.accessor('icf', { header: 'ICF', cell: (i) => <Signed v={i.getValue()} />, ...right }),
    col.accessor('fcf', { header: 'FCF', cell: (i) => <Signed v={i.getValue()} />, ...right }),
    col.accessor('netChange', { header: "Sof o'zgarish", cell: (i) => <Signed v={i.getValue()} />, ...right }),
    col.accessor('closing', { header: 'Yakuniy', cell: (i) => <span className="font-semibold text-gold-bright">{localize(money(i.getValue()))}</span>, ...right }),
    col.accessor('planClosing', { header: 'Plan yakuniy', cell: (i) => <span className="text-txt-secondary">{localize(money(i.getValue()))}</span>, ...right }),
    col.accessor('closingPct', { header: '%', cell: (i) => <PctCell v={i.getValue()} />, ...right, enableSorting: false, meta: { align: 'right', exportLabel: 'Yakuniy %' } }),
  ], [money])

  const planOcfSum = rows.reduce((a, r) => a + fin(r.planOcf), 0)
  const lastPlanClosing = fin(rows[rows.length - 1]?.planClosing)
  const foot = (v: number, cls?: string) => <td className={cn('px-3 py-2 num text-right', cls)}>{localize(money(v))}</td>

  const footer = rows.length ? (
    <tr>
      <td className="px-3 py-2 text-txt-primary">{localize("Jami")}</td>
      {(foot(totals.opening))}
      {(foot(totals.receipts + totals.otherReceipts))}
      {(foot(totals.ocf, totals.ocf < 0 ? 'text-negative' : undefined))}
      {(foot(planOcfSum, 'text-txt-secondary'))}
      <td className="px-3 py-2 num text-right"><PctCell v={pctOf(totals.ocf, planOcfSum)} /></td>
      {(foot(totals.icf, totals.icf < 0 ? 'text-negative' : undefined))}
      {(foot(totals.fcf, totals.fcf < 0 ? 'text-negative' : undefined))}
      {(foot(totals.netChange, totals.netChange < 0 ? 'text-negative' : undefined))}
      {(foot(totals.closing, 'text-gold-bright font-semibold'))}
      {(foot(lastPlanClosing, 'text-txt-secondary'))}
      <td className="px-3 py-2 num text-right"><PctCell v={pctOf(totals.closing, lastPlanClosing)} /></td>
    </tr>
  ) : undefined

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h3 className="section-title">{localize("Oylik pul oqimi jadvali")}</h3>
        <span className="text-xs text-txt-muted">{localize("Qatorni bosing — oyning to'g'ri usul tafsiloti ochiladi")}</span>
      </div>
      <DataTable<CfTableRow>
        columns={columns}
        data={rows}
        dense
        exportName="Cashflow_oylik"
        exportRow={(r) => ({
          Oy: fmtMonth(r.month), "Boshlang'ich": r.opening, Tushum: r.receipts, OCF: r.ocf, 'Plan OCF': r.planOcf, 'OCF %': r.ocfPct === null ? '' : Math.round(r.ocfPct),
          ICF: r.icf, FCF: r.fcf, "Sof o'zgarish": r.netChange, Yakuniy: r.closing, 'Plan yakuniy': r.planClosing, 'Yakuniy %': r.closingPct === null ? '' : Math.round(r.closingPct),
        })}
        onRowClick={(r) => onRowClick(r.month)}
        footer={footer}
        emptyText={localize("Tanlangan davrda cashflow ma'lumoti yo'q")}
        getRowId={(r) => r.month}
      />
    </div>
  )
}
