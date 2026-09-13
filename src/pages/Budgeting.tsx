import { translate as localize, useLanguageStore } from "@/i18n"
import { useMemo, useState } from 'react'
import type { ColumnDef, Row } from '@tanstack/react-table'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ChartCard, DataTable, KpiCard, PageLayout, WaterfallChart } from '@/components/shared'
import { useCurrency, useDataset, usePeriod } from '@/hooks'
import { budgetTree, perfStatus, planFulfillment, pnlMonthlySeries, pnlTotals, varianceWaterfall, type BudgetNode } from '@/lib/finance'
import { previousWindow, quarterOf, ytdWindow, periodLabel } from '@/lib/period'
import { fmtMonth, fmtPct } from '@/lib/format'
import { cn, fin, pctChange } from '@/lib/utils'
import { GroupsPlanFactChart, ItemsPerformanceChart, MonthlyPlanFactChart } from './budgeting/BudgetCharts'

type Mode = 'month' | 'quarter' | 'ytd'
const MODES: { key: Mode; label: string }[] = [{ key: 'month', label: 'Oy' }, { key: 'quarter', label: 'Chorak' }, { key: 'ytd', label: 'YTD' }]
type RowNode = BudgetNode & { isTotal?: boolean }

const PERF_CLASS = { good: 'text-positive bg-positive/10', warn: 'text-warning bg-warning/10', bad: 'text-negative bg-negative/10' }

/** Byudjet — Plan/Fakt: ierarxik jadval, variance waterfall, guruh va modda kesimlari. */
export default function Budgeting() {
  useLanguageStore((state) => state.language)
  const { data, allMonths } = useDataset()
  const { asOf, ytdMonths } = usePeriod()
  const { money } = useCurrency()
  const [mode, setMode] = useState<Mode>('quarter')

  const m = useMemo(() => {
    const used = mode === 'month' ? [asOf] : mode === 'quarter' ? allMonths.filter((x) => quarterOf(x) === quarterOf(asOf) && x <= asOf) : (ytdWindow(allMonths, [asOf]).length ? ytdWindow(allMonths, [asOf]) : ytdMonths)
    const usedMonths = used.length ? used : [asOf]
    const prev = previousWindow(allMonths, usedMonths)
    const tree = budgetTree(data.pnl, data.budget, usedMonths)
    const prevT = prev.length ? pnlTotals(data.pnl, prev) : null
    const curT = pnlTotals(data.pnl, usedMonths)
    const pf = planFulfillment(data.pnl, data.budget, usedMonths)
    const pfPrev = prev.length ? planFulfillment(data.pnl, data.budget, prev) : null
    const items = tree.nodes.flatMap((g) => g.children ?? [])
    const worst = items.filter((i) => fin(i.plan) > 0).sort((a, b) => a.profitImpact - b.profitImpact)[0] ?? null
    const sparkMonths = allMonths.filter((x) => x <= asOf).slice(-12)
    const series = pnlMonthlySeries(data.pnl, data.budget, sparkMonths)
    const pfSpark = sparkMonths.map((x) => fin(planFulfillment(data.pnl, data.budget, [x]).overall))
    const tableRows: RowNode[] = [...tree.nodes, ...tree.totals.map((t) => ({ ...t, isTotal: true }))]
    const spark = (pick: (s: (typeof series)[number]) => number) => series.map(pick)
    return { usedMonths, prev, tree, prevT, curT, pf, pfPrev, items, worst, series, tableRows, spark, pfSpark, steps: varianceWaterfall(tree, 8), label: periodLabel(usedMonths, (x) => fmtMonth(x)) }
  }, [data, allMonths, asOf, mode, ytdMonths])

  const g = (id: string) => m.tree.nodes.find((n) => n.id === id)
  const tot = (id: string) => m.tree.totals.find((n) => n.id === id)
  const rev = g('revenue'), opex = g('opex'), ebitda = tot('ebitda'), net = tot('netProfit')
  const dl = (cur: number, p: number | null | undefined) => (p === null || p === undefined ? null : pctChange(cur, p))
  const hasPrev = m.prev.length > 0
  const deltaLabel = hasPrev ? "o'tgan davrga" : undefined
  const noPrev = hasPrev ? undefined : "Oldingi davr yo'q"

  const columns = useMemo<ColumnDef<RowNode>[]>(() => {
    const right = { align: 'right' as const }
    const Expander = ({ row }: { row: Row<RowNode> }) => {
      const n = row.original
      const can = row.getCanExpand()
      return (
        <div className="flex items-center gap-1 font-sans" style={{ paddingLeft: row.depth * 18 }}>
          {(can ? (
            <button type="button" className="h-5 w-5 inline-flex items-center justify-center rounded text-txt-muted hover:bg-elevated hover:text-txt-primary" onClick={(e) => { e.stopPropagation(); row.toggleExpanded() }} aria-label={localize(row.getIsExpanded() ? 'Yopish' : 'Ochish')}>
              {(row.getIsExpanded() ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />)}
            </button>
          ) : <span className="inline-block w-5" />)}
          <span className={cn('truncate', (n.level === 0 || n.isTotal) && 'text-txt-primary')}>{localize(n.label)}</span>
          {(n.level === 0 && n.isCostItem && !n.isTotal && <Badge variant="secondary" className="ml-1 font-sans text-[10px]">{localize("xarajat")}</Badge>)}
        </div>
      )
    }
    return [
      { id: 'label', header: 'Modda', accessorFn: (n) => n.label, enableSorting: false, cell: ({ row }) => <Expander row={row} />, meta: { className: 'min-w-[240px]' } },
      { id: 'plan', header: 'Plan', accessorFn: (n) => n.plan, enableSorting: false, meta: right, cell: ({ row }) => money(row.original.plan) },
      { id: 'fact', header: 'Fakt', accessorFn: (n) => n.fact, enableSorting: false, meta: right, cell: ({ row }) => <span className="text-txt-primary">{localize(money(row.original.fact))}</span> },
      { id: 'variance', header: 'Variance', accessorFn: (n) => n.variance, enableSorting: false, meta: right, cell: ({ row }) => { const n = row.original; const good = n.profitImpact >= 0; return <span className={cn(Math.abs(n.variance) < 1 ? 'text-txt-muted' : good ? 'text-positive' : 'text-negative')}>{localize(money(n.variance, { sign: true }))}</span> } },
      { id: 'variancePct', header: 'Var %', accessorFn: (n) => n.variancePct, enableSorting: false, meta: right, cell: ({ row }) => { const n = row.original; return fin(n.plan) === 0 ? <span className="text-txt-muted">—</span> : <span className={cn(n.profitImpact >= 0 ? 'text-positive' : 'text-negative')}>{localize(fmtPct(n.variancePct, 1, true))}</span> } },
      { id: 'performance', header: 'Performance %', accessorFn: (n) => n.performance, enableSorting: false, meta: right, cell: ({ row }) => { const n = row.original; if (fin(n.plan) === 0 && fin(n.fact) === 0) return <span className="text-txt-muted">—</span>; return <span className={cn('inline-block rounded-md px-2 py-0.5 font-semibold', PERF_CLASS[n.status])}>{localize(fmtPct(Math.min(999, n.performance), 0))}</span> } },
    ]
  }, [money])

  const exportRow = (n: RowNode) => ({ Daraja: n.isTotal ? 'Natija' : n.level === 0 ? 'Guruh' : 'Modda', Modda: n.label, Plan: Math.round(n.plan), Fakt: Math.round(n.fact), Variance: Math.round(n.variance), 'Var %': Number(fin(n.variancePct).toFixed(1)), 'Performance %': Number(fin(n.performance).toFixed(1)), Xarajat: n.isCostItem ? 'ha' : '' })
  const stepsExport = useMemo(() => m.steps.map((s) => ({ Bosqich: s.name, Qiymat: Math.round(s.value) })), [m.steps])
  const groupsExport = useMemo(() => m.tree.nodes.map((n) => ({ Guruh: n.label, Plan: Math.round(n.plan), Fakt: Math.round(n.fact), 'Performance %': Number(n.performance.toFixed(1)) })), [m.tree])
  const itemsExport = useMemo(() => m.items.map((n) => ({ Modda: n.label, Plan: Math.round(n.plan), Fakt: Math.round(n.fact), 'Performance %': Number(n.performance.toFixed(1)), Holat: n.status })), [m.items])
  const monthlyExport = useMemo(() => m.series.map((s) => ({ Oy: fmtMonth(s.month, true), 'Tushum fakt': Math.round(s.revenue), 'Tushum plan': Math.round(s.planRevenue), 'Sof foyda fakt': Math.round(s.netProfit), 'Sof foyda plan': Math.round(s.planNetProfit) })), [m.series])

  return (
    <PageLayout
      title={localize("Byudjet — Plan / Fakt")}
      subtitle={localize(`Bajarilish: daromadda fakt/plan, xarajat moddalarida plan/fakt (teskari mantiq). Rang: ≥100% yashil, 90–99% sariq, <90% qizil · ${m.label}`)}
      filters={
        <div className="segmented">
          {(MODES.map((x) => (
            <button key={x.key} onClick={() => setMode(x.key)} className={cn('segmented-item', mode === x.key && 'segmented-item-active')}>{localize(x.label)}</button>
          )))}
        </div>
      }
      kpiCols={6}
      kpis={
        <>
          <KpiCard title={localize("Tushum")} value={rev?.fact ?? 0} plan={rev?.plan ?? null} delta={dl(rev?.fact ?? 0, m.prevT?.revenue)} deltaLabel={deltaLabel} hint={localize(noPrev)} sparkline={m.spark((s) => s.revenue)} />
          <KpiCard title={localize("Operatsion xarajatlar")} value={opex?.fact ?? 0} plan={opex?.plan ?? null} invert delta={dl(opex?.fact ?? 0, m.prevT?.opex)} deltaLabel={deltaLabel} hint={localize(noPrev ?? 'Xarajat: kam bo\'lsa yaxshi')} sparkline={m.spark((s) => s.opex)} />
          <KpiCard title={localize("EBITDA")} value={ebitda?.fact ?? 0} plan={ebitda?.plan ?? null} delta={dl(ebitda?.fact ?? 0, m.prevT?.ebitda)} deltaLabel={deltaLabel} hint={localize(noPrev)} sparkline={m.spark((s) => s.ebitda)} />
          <KpiCard title={localize("Sof foyda")} value={net?.fact ?? 0} plan={net?.plan ?? null} delta={dl(net?.fact ?? 0, m.prevT?.netProfit)} deltaLabel={deltaLabel} hint={localize(noPrev)} sparkline={m.spark((s) => s.netProfit)} />
          <KpiCard title={localize("Umumiy bajarilish")} value={m.pf.overall} format="pct" status={perfStatus(m.pf.overall)} delta={m.pfPrev ? m.pf.overall - m.pfPrev.overall : null} deltaUnit=" p.p." deltaLabel={deltaLabel}
            hint={localize(`Tushum ${fmtPct(m.pf.revenue, 0)} · EBITDA ${fmtPct(m.pf.ebitda, 0)} · Sof ${fmtPct(m.pf.netProfit, 0)}`)} sparkline={m.pfSpark} />
          <KpiCard title={localize("Eng katta og'ish")} value={m.worst?.profitImpact ?? 0} format={(v) => money(v, { sign: true })} status={m.worst ? (m.worst.profitImpact < 0 ? 'bad' : 'good') : null}
            hint={localize(m.worst ? `${m.worst.label}: bajarilish ${fmtPct(m.worst.performance, 0)}` : 'Og\'ish yo\'q')} delta={m.worst ? m.worst.variancePct : null} deltaUnit="% plan" invert={m.worst?.isCostItem} deltaLabel="planga nisbatan" />
        </>
      }
      charts={
        <>
          <ChartCard title={localize("Variance waterfall: plandan faktgacha")} subtitle={localize("Plan sof foydadan fakt sof foydagacha — foydaga ta'siri bo'yicha eng katta 8 og'ish (yashil — ijobiy, qizil — salbiy).")} span={2} height={300} exportData={stepsExport} exportName="Byudjet_waterfall">
            {(({ height }) => <WaterfallChart steps={m.steps} height={height} />)}
          </ChartCard>
          <ChartCard title={localize("Guruhlar bo'yicha Plan vs Fakt")} subtitle={localize("Har P&L guruhi uchun plan (ko'k) va fakt (oltin).")} exportData={groupsExport} exportName="Byudjet_guruhlar" height={340}>
            <GroupsPlanFactChart nodes={m.tree.nodes} />
          </ChartCard>
          <ChartCard title={localize("Moddalar bajarilishi %")} subtitle={localize("Eng yomondan eng yaxshigacha; punktir — 90% va 100% chegaralari. Xarajat moddalarida % = plan/fakt.")} exportData={itemsExport} exportName="Byudjet_moddalar" height={340}>
            <ItemsPerformanceChart items={m.items} />
          </ChartCard>
          <ChartCard title={localize("Oylik plan vs fakt (12 oy)")} subtitle={localize("Tushum (chap o'q) va sof foyda (o'ng o'q): fakt va plan.")} span={2} exportData={monthlyExport} exportName="Byudjet_oylik">
            <MonthlyPlanFactChart series={m.series} />
          </ChartCard>
        </>
      }
      table={
        <DataTable<RowNode> columns={columns} data={m.tableRows} getSubRows={(n) => n.children as RowNode[] | undefined} getRowId={(n) => n.id} initialExpanded={true} dense exportName="Byudjet" exportRow={exportRow}
          rowClassName={(n) => (n.isTotal ? 'font-semibold bg-elevated/50 border-t border-border' : n.level === 0 ? 'font-medium' : 'text-txt-secondary')}
          toolbar={<div className="flex items-baseline gap-2"><h3 className="section-title">{localize("Ierarxik byudjet")}</h3><span className="text-xs text-txt-muted num">{localize(m.label)}{localize(" · guruh → modda")}</span></div>} />
      }
    />
  )
}
