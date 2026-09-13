import { translate as localize, useLanguageStore } from "@/i18n"
import { useMemo, type ReactNode } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { DataTable, perfTone, performancePct } from '@/components/shared'
import { useCurrency } from '@/hooks'
import { fmtMonth, fmtPct, toCurrency } from '@/lib/format'
import { cn, fin } from '@/lib/utils'
import type { PnLMonthPoint, PnLTotals } from '@/lib/finance'

const TONE_CLASS = { good: 'text-positive', warn: 'text-warning', bad: 'text-negative' } as const

interface PnLMonthlyTableProps {
  rows: PnLMonthPoint[]
  totals: PnLTotals
  planRevenue: number
  /** davr yorlig'i (toolbar) */
  label: string
}

/** Bajarilish % — plan bo'lmasa "—". */
function PerfCell({ fact, plan }: { fact: number; plan: number }) {
  useLanguageStore((state) => state.language)
  if (fin(plan) <= 0) return <span className="text-txt-muted">—</span>
  const pct = performancePct(fact, plan)
  return <span className={cn('font-semibold', TONE_CLASS[perfTone(pct)])}>{localize(fmtPct(pct))}</span>
}

/** Oylik P&L jadvali: Oy | Tushum | Plan | Bajarilish % | COGS | Yalpi foyda | Marja % | OPEX | EBITDA | Sof foyda | Sof marja %. Pastda jami qatori. */
export function PnLMonthlyTable({ rows, totals, planRevenue, label }: PnLMonthlyTableProps) {
  useLanguageStore((state) => state.language)
  const { money, currency } = useCurrency()

  const columns = useMemo(() => {
    const col = createColumnHelper<PnLMonthPoint>()
    const moneyCell = (v: number): ReactNode => <span className={cn(v < 0 && 'text-negative')}>{localize(money(v))}</span>
    const pctCell = (v: number): ReactNode => <span className={cn(v < 0 && 'text-negative')}>{localize(fmtPct(v))}</span>
    const right = { align: 'right' as const }
    return [
      col.accessor('month', { header: 'Oy', cell: (c) => <span className="font-medium text-txt-primary">{localize(fmtMonth(c.getValue(), true))}</span> }),
      col.accessor('revenue', { header: 'Tushum', cell: (c) => moneyCell(c.getValue()), meta: right }),
      col.accessor('planRevenue', { header: 'Plan tushum', cell: (c) => moneyCell(c.getValue()), meta: right }),
      col.accessor((r) => (fin(r.planRevenue) > 0 ? performancePct(r.revenue, r.planRevenue) : -1), {
        id: 'perf', header: 'Bajarilish %', cell: (c) => <PerfCell fact={c.row.original.revenue} plan={c.row.original.planRevenue} />, meta: right,
      }),
      col.accessor('cogs', { header: 'COGS', cell: (c) => moneyCell(c.getValue()), meta: right }),
      col.accessor('grossProfit', { header: 'Yalpi foyda', cell: (c) => moneyCell(c.getValue()), meta: right }),
      col.accessor('grossMargin', { header: 'Marja %', cell: (c) => pctCell(c.getValue()), meta: right }),
      col.accessor('opex', { header: 'OPEX', cell: (c) => moneyCell(c.getValue()), meta: right }),
      col.accessor('ebitda', { header: 'EBITDA', cell: (c) => moneyCell(c.getValue()), meta: right }),
      col.accessor('netProfit', { header: 'Sof foyda', cell: (c) => <span className={cn('font-semibold', c.getValue() < 0 ? 'text-negative' : 'text-txt-primary')}>{localize(money(c.getValue()))}</span>, meta: right }),
      col.accessor('netMargin', { header: 'Sof marja %', cell: (c) => pctCell(c.getValue()), meta: right }),
    ]
  }, [money])

  const cur = (v: number) => Math.round(toCurrency(fin(v), currency))
  const exportRow = (r: PnLMonthPoint) => ({
    Oy: fmtMonth(r.month, true),
    [`Tushum (${currency})`]: cur(r.revenue),
    [`Plan tushum (${currency})`]: cur(r.planRevenue),
    'Bajarilish %': fin(r.planRevenue) > 0 ? Number(performancePct(r.revenue, r.planRevenue).toFixed(1)) : '',
    [`COGS (${currency})`]: cur(r.cogs),
    [`Yalpi foyda (${currency})`]: cur(r.grossProfit),
    'Marja %': Number(fin(r.grossMargin).toFixed(1)),
    [`OPEX (${currency})`]: cur(r.opex),
    [`EBITDA (${currency})`]: cur(r.ebitda),
    [`Sof foyda (${currency})`]: cur(r.netProfit),
    'Sof marja %': Number(fin(r.netMargin).toFixed(1)),
  })

  const tdR = 'px-3 py-2 text-right num whitespace-nowrap'
  const footer = (
    <tr>
      <td className="px-3 py-2 text-txt-primary whitespace-nowrap">{localize("Jami ·")}{(rows.length)}{localize(" oy")}</td>
      <td className={tdR}>{localize(money(totals.revenue))}</td>
      <td className={tdR}>{localize(money(planRevenue))}</td>
      <td className={tdR}><PerfCell fact={totals.revenue} plan={planRevenue} /></td>
      <td className={tdR}>{localize(money(totals.cogs))}</td>
      <td className={tdR}>{localize(money(totals.grossProfit))}</td>
      <td className={tdR}>{localize(fmtPct(totals.grossMargin))}</td>
      <td className={tdR}>{localize(money(totals.opex))}</td>
      <td className={tdR}>{localize(money(totals.ebitda))}</td>
      <td className={cn(tdR, 'font-semibold', totals.netProfit < 0 ? 'text-negative' : 'text-gold-bright')}>{localize(money(totals.netProfit))}</td>
      <td className={tdR}>{localize(fmtPct(totals.netMargin))}</td>
    </tr>
  )

  return (
    <DataTable
      columns={columns}
      data={rows}
      exportName="PnL_oylik"
      exportRow={exportRow}
      footer={rows.length ? footer : undefined}
      maxHeight={520}
      dense
      emptyText={localize("Tanlangan davrda P&L ma'lumoti yo'q")}
      toolbar={
        <div className="flex items-baseline gap-2 min-w-0">
          <h3 className="section-title">{localize("Oylik P&L")}</h3>
          <span className="text-xs text-txt-muted num truncate">{localize(label)}</span>
        </div>
      }
    />
  )
}
