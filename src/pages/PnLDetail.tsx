import { translate as localize, useLanguageStore } from "@/i18n"
import { useMemo, useState } from 'react'
import { useSliceNavigate } from '@/hooks'
import { ArrowLeft } from 'lucide-react'
import { ROUTES } from '@/lib/routes'
import type { ExpandedState } from '@tanstack/react-table'
import { DataTable, KpiCard, PageLayout, TrendModal } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { useCurrency, useDataset, usePeriod } from '@/hooks'
import { buildPnLTree, planFulfillment, pnlMonthlySeries, pnlPlanTotals, pnlTotals, type PnLNode } from '@/lib/finance'
import { fin, pctChange } from '@/lib/utils'
import { fmtPct } from '@/lib/format'
import { buildPnLColumns, makePnLExportRow, nodeSubtitle, pnlRowClassName } from './pnl-detail/columns'
import { PnLToolbar } from './pnl-detail/PnLToolbar'

/** Dastlab ochiq turadigan guruhlar (qator id = node.id). */
const DEFAULT_EXPANDED: ExpandedState = { revenue: true, cogs: true, opex: true }

const PF_FALLBACK = { target: 100, normMin: 95, normMax: 110 }

/** P&L — batafsil: ko'p bosqichli hisobot (guruh → modda → element), grafiksiz. */
export default function PnLDetail() {
  useLanguageStore((state) => state.language)
  const navigate = useSliceNavigate()
  const { data, allMonths } = useDataset()
  const { comparisonTotals, months, prevMonths, prevYearMonths, ytdMonths, label, prevLabel, asOf, compareLabel, noCompareText } = usePeriod()
  const { currency, money, moneyFull } = useCurrency()

  const [expanded, setExpanded] = useState<ExpandedState>(DEFAULT_EXPANDED)
  const [selected, setSelected] = useState<PnLNode | null>(null)

  const hasPrev = prevMonths.length > 0
  const hasPrevYear = prevYearMonths.length > 0

  const tree = useMemo(
    () => buildPnLTree({ rows: data.pnl, budget: data.budget, months, prevMonths, prevYearMonths, ytdMonths, allMonths }),
    [data.pnl, data.budget, months, prevMonths, prevYearMonths, ytdMonths, allMonths],
  )

  const kpi = useMemo(() => {
    const cur = pnlTotals(data.pnl, months)
    const plan = pnlPlanTotals(data.budget, months)
    const prev = comparisonTotals
    const pf = planFulfillment(data.pnl, data.budget, months)
    const pfPrev = hasPrev ? planFulfillment(data.pnl, data.budget, prevMonths) : null

    const last12 = allMonths.filter((m) => m <= asOf).slice(-12)
    const series = pnlMonthlySeries(data.pnl, data.budget, last12)
    const spark = {
      revenue: series.map((s) => fin(s.revenue)),
      ebitda: series.map((s) => fin(s.ebitda)),
      netProfit: series.map((s) => fin(s.netProfit)),
      pf: last12.map((m) => fin(planFulfillment(data.pnl, data.budget, [m]).overall)),
    }

    const t = data.kpiTargets.find((k) => k.key === 'planFulfillment')
    const pfTarget = { target: fin(t?.target, PF_FALLBACK.target), normMin: fin(t?.normMin, PF_FALLBACK.normMin), normMax: fin(t?.normMax, PF_FALLBACK.normMax) }
    const pfValue = fin(pf.overall)
    const pfStatus: 'good' | 'warn' | 'bad' =
      pfValue < pfTarget.normMin ? (pfValue >= pfTarget.normMin - 5 ? 'warn' : 'bad') : pfValue > pfTarget.normMax ? 'warn' : 'good'

    const delta = (c: number, p: number | null | undefined) => (p === null || p === undefined ? null : pctChange(c, p))
    return {
      revenue: { value: cur.revenue, plan: plan.revenue, delta: delta(cur.revenue, prev?.revenue) },
      ebitda: { value: cur.ebitda, plan: plan.ebitda, delta: delta(cur.ebitda, prev?.ebitda) },
      netProfit: { value: cur.netProfit, plan: plan.netProfit, delta: delta(cur.netProfit, prev?.netProfit) },
      pf: { value: pfValue, delta: pfPrev ? pfValue - fin(pfPrev.overall) : null, status: pfStatus, target: pfTarget, parts: pf },
      spark,
    }
  }, [data.pnl, data.budget, data.kpiTargets, months, prevMonths, allMonths, asOf, hasPrev, comparisonTotals])

  const columns = useMemo(() => buildPnLColumns({ money, moneyFull, hasPrev, hasPrevYear }), [money, moneyFull, hasPrev, hasPrevYear])
  const exportRow = useMemo(() => makePnLExportRow(currency, hasPrev, hasPrevYear), [currency, hasPrev, hasPrevYear])

  const noPrevHint = noCompareText
  const pfHint = `Maqsad ${fmtPct(kpi.pf.target.target, 0)} · norma ${fmtPct(kpi.pf.target.normMin, 0)}–${fmtPct(kpi.pf.target.normMax, 0)}`
  const modalData = useMemo(
    () => (selected ? selected.monthly.map((m) => ({ month: m.month, fact: fin(m.fact), plan: fin(m.plan) })) : []),
    [selected],
  )

  return (
    <PageLayout
      title={localize("P&L — batafsil")}
      subtitle={localize("Ko'p bosqichli hisobot: guruh → modda → element. Modda ustiga bosing — oylik trend.")}
      actions={
        <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.pnl)}>
          <ArrowLeft />{localize(" P&L")}</Button>
      }
      kpiCols={4}
      skeletonKpis={4}
      kpis={
        <>
          <KpiCard
            title={localize("Tushum")}
            value={kpi.revenue.value}
            delta={kpi.revenue.delta}
            deltaLabel={compareLabel}
            plan={kpi.revenue.plan}
            sparkline={kpi.spark.revenue}
            hint={localize(hasPrev ? undefined : noPrevHint)}
          />
          <KpiCard
            title={localize("EBITDA")}
            value={kpi.ebitda.value}
            delta={kpi.ebitda.delta}
            deltaLabel={compareLabel}
            plan={kpi.ebitda.plan}
            sparkline={kpi.spark.ebitda}
            hint={localize(hasPrev ? undefined : noPrevHint)}
          />
          <KpiCard
            title={localize("Sof foyda")}
            value={kpi.netProfit.value}
            delta={kpi.netProfit.delta}
            deltaLabel={compareLabel}
            plan={kpi.netProfit.plan}
            sparkline={kpi.spark.netProfit}
            hint={localize(hasPrev ? undefined : noPrevHint)}
          />
          <KpiCard
            title={localize("Plan bajarilishi")}
            value={kpi.pf.value}
            format="pct"
            delta={kpi.pf.delta}
            deltaUnit=" p.p."
            deltaLabel={compareLabel}
            status={kpi.pf.status}
            sparkline={kpi.spark.pf}
            hint={localize(hasPrev ? pfHint : `${noPrevHint} · ${pfHint}`)}
          />
        </>
      }
      table={
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="section-title">{localize("Ko'p bosqichli hisobot")}</h3>
            <span className="text-xs text-txt-muted num">{localize("Davr: ")}{localize(label)}
              {localize(hasPrev ? ` · O'tgan davr: ${prevLabel}` : " · O'tgan davr: —")}
              {localize(` · Plan bajarilishi: tushum ${fmtPct(kpi.pf.parts.revenue, 0)}, EBITDA ${fmtPct(kpi.pf.parts.ebitda, 0)}, sof foyda ${fmtPct(kpi.pf.parts.netProfit, 0)}`)}
            </span>
          </div>
          <DataTable<PnLNode>
            columns={columns}
            data={tree}
            getSubRows={(n) => n.children}
            getRowId={(n) => n.id}
            expanded={expanded}
            onExpandedChange={setExpanded}
            enableColumnVisibility
            exportName="PnL_batafsil"
            exportRow={exportRow}
            dense
            rowClassName={pnlRowClassName}
            onRowClick={(n) => setSelected(n)}
            toolbar={<PnLToolbar onExpandAll={() => setExpanded(true)} onCollapseAll={() => setExpanded({})} />}
            emptyText={localize("P&L ma'lumoti yo'q")}
          />
        </div>
      }
    >
      <TrendModal
        open={selected !== null}
        onOpenChange={(o) => {
          if (!o) setSelected(null)
        }}
        title={localize(selected?.label ?? '')}
        subtitle={localize(selected ? nodeSubtitle(selected) : undefined)}
        data={modalData}
      />
    </PageLayout>
  )
}
