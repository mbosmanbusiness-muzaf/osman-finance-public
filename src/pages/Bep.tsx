import { translate as localize, useLanguageStore } from "@/i18n"
import { useMemo, useState } from 'react'
import { useSliceNavigate } from '@/hooks'
import { ROUTES } from '@/lib/routes'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChartCard, DataTable, KpiCard, PageLayout } from '@/components/shared'
import { useCurrency, useDataset, usePeriod } from '@/hooks'
import { applySensitivity, bepBase, bepCompute, type SensitivityDeltas } from '@/lib/finance/bep'
import { fmtNum, fmtPct } from '@/lib/format'
import { cn, fin, pctChange } from '@/lib/utils'
import {
  BEP_NOT_COMPUTABLE, ZERO_DELTAS, describeDeltas, fmtSignedPct, fmtUnits, isActive, isComputable, monthlyBep, mosStatus,
  planBep, scenarioGrid, sensitivityCurves, tornadoBars, type FactorKey, type GridRow,
} from './bep/helpers'
import { BepChart, SensitivityCurvesChart, TornadoChart } from './bep/BepCharts'
import { BepInputsStrip } from './bep/BepInputsStrip'
import { SensitivityPanel } from './bep/SensitivityPanel'

/** BEP va Sensitivity: 4 slider → sof foyda va BEP jonli o'zgaradi; tornado — qaysi omil kuchliroq. */
export default function Bep() {
  useLanguageStore((state) => state.language)
  const nav = useSliceNavigate()
  const { data, allMonths } = useDataset()
  const { months, prevMonths, label, asOf, compareLabel, noCompareText: NO_PREV } = usePeriod()
  const { money } = useCurrency()
  const [deltas, setDeltas] = useState<SensitivityDeltas>(ZERO_DELTAS)
  const active = isActive(deltas)

  const m = useMemo(() => {
    const base = bepCompute(bepBase(data.pnl, data.sales, months))
    const prev = prevMonths.length ? bepCompute(bepBase(data.pnl, data.sales, prevMonths)) : null
    const scenario = applySensitivity(base, deltas)
    const plan = planBep(data.budget, months)
    const spark = monthlyBep(data, months.length >= 6 ? months : allMonths.filter((x) => x <= asOf).slice(-12))
    return {
      base, prev, scenario, plan,
      grid: scenarioGrid(base),
      curves: sensitivityCurves(scenario),
      tornado: tornadoBars(scenario, 20),
      spark: {
        bepUnits: spark.map((r) => fin(r.bepUnits)), bepRevenue: spark.map((r) => fin(r.bepRevenue)),
        mos: spark.map((r) => fin(r.marginOfSafetyPct)), cmr: spark.map((r) => fin(r.contributionMarginRatio) * 100),
        profit: spark.map((r) => fin(r.profit)), fixed: spark.map((r) => fin(r.fixedCosts)),
      },
    }
  }, [data, allMonths, asOf, months, prevMonths, deltas])

  const { base, prev, scenario, plan } = m
  const sOk = isComputable(scenario), bOk = isComputable(base)
  /** taqqoslama: slider faol bo'lsa bazaga, aks holda o'tgan davrga */
  const ref = active ? base : prev
  const refLabel = active ? 'bazaga' : compareLabel
  const dl = (cur: number, r: number | undefined | null) => (r === undefined || r === null ? null : pctChange(cur, r))
  const da = (cur: number, r: number | undefined | null) => (r === undefined || r === null ? null : cur - r)
  const baseHint = (s: string) => (active ? `Baza: ${s}` : prev ? undefined : NO_PREV)

  const onChange = (key: FactorKey, value: number) => setDeltas((d) => ({ ...d, [key]: value }))

  const gridColumns = useMemo<ColumnDef<GridRow>[]>(() => {
    const right = { align: 'right' as const }
    const tone = (v: number) => (v > 0 ? 'text-positive' : v < 0 ? 'text-negative' : 'text-txt-muted')
    return [
      { accessorKey: 'factor', header: 'Omil', cell: ({ row }) => <span className="font-sans text-txt-primary">{localize(row.original.factor)}</span> },
      { accessorKey: 'delta', header: "O'zgarish", meta: right, cell: ({ row }) => <span className={cn(row.original.delta === 0 && 'text-txt-muted')}>{localize(fmtSignedPct(row.original.delta))}</span> },
      { accessorKey: 'profit', header: 'Sof foyda', meta: right, cell: ({ row }) => <span className={cn(row.original.profit < 0 && 'text-negative')}>{localize(money(row.original.profit))}</span> },
      { accessorKey: 'dProfit', header: 'Δ foyda (bazaga)', meta: right, cell: ({ row }) => <span className={tone(row.original.dProfit)}>{localize(money(row.original.dProfit, { sign: true }))} ({localize(fmtPct(row.original.dProfitPct, 1, true))})</span> },
      { accessorKey: 'bepUnits', header: 'BEP (dona)', meta: right, cell: ({ row }) => (row.original.computable ? fmtNum(row.original.bepUnits, 0) : '—') },
      { accessorKey: 'bepRevenue', header: 'BEP (summa)', meta: right, cell: ({ row }) => (row.original.computable ? money(row.original.bepRevenue) : '—') },
      { accessorKey: 'mosPct', header: 'MoS %', meta: right, cell: ({ row }) => (row.original.computable ? <span className={cn(row.original.mosPct < 10 && 'text-negative')}>{localize(fmtPct(row.original.mosPct))}</span> : '—') },
    ]
  }, [money])

  const gridExport = useMemo(() => m.grid.map((r) => ({ Omil: r.factor, "O'zgarish %": r.delta, 'Sof foyda': Math.round(r.profit), 'Δ foyda': Math.round(r.dProfit), 'BEP (dona)': Math.round(r.bepUnits), 'BEP (summa)': Math.round(r.bepRevenue), 'MoS %': Number(r.mosPct.toFixed(1)) })), [m.grid])
  const tornadoExport = useMemo(() => m.tornado.map((t) => ({ Omil: t.factor, 'Past holat': Math.round(t.low), 'Yuqori holat': Math.round(t.high), Diapazon: Math.round(t.swing) })), [m.tornado])
  const curvesExport = useMemo(() => m.curves.map((c) => ({ "O'zgarish %": c.delta, Narx: Math.round(c.price), Hajm: Math.round(c.volume), "O'zg. xarajat": Math.round(c.varCost), 'Doimiy xarajat': Math.round(c.fixedCost) })), [m.curves])

  const scenarioNote = active ? `Ssenariy: ${describeDeltas(deltas)}` : 'Baza (sliderlar 0%)'

  return (
    <PageLayout
      title={localize("BEP va Sensitivity tahlili")}
      subtitle={localize("BEP (dona) = Doimiy xarajat / (Narx − O'zgaruvchan xarajat) · BEP (summa) = Doimiy xarajat / CM ratio · Margin of safety = (Sotuv − BEP sotuv) / Sotuv")}
      actions={
        <>
          {(active && <Button variant="outline" size="sm" onClick={() => setDeltas(ZERO_DELTAS)}><RotateCcw />{localize(" Sliderlarni tiklash")}</Button>)}
          <Button variant="outline" size="sm" onClick={() => nav(ROUTES.pnl)}><ArrowLeft />{localize(" P&L")}</Button>
        </>
      }
      kpiCols={6}
      kpis={
        <>
          <KpiCard title={localize("BEP (dona)")} value={scenario.bepUnits} format={(v) => (sOk ? fmtUnits(v) : '—')} invert
            delta={sOk && (active ? bOk : !!prev && isComputable(prev)) ? dl(scenario.bepUnits, ref?.bepUnits) : null} deltaLabel={refLabel}
            hint={localize(sOk ? baseHint(fmtUnits(base.bepUnits)) ?? 'Doimiy / (Narx − O\'zg. xarajat)' : BEP_NOT_COMPUTABLE)} sparkline={m.spark.bepUnits} />
          <KpiCard title={localize("BEP (summa)")} value={scenario.bepRevenue} format={(v) => (sOk ? money(v) : '—')} invert
            delta={sOk && (active ? bOk : !!prev && isComputable(prev)) ? dl(scenario.bepRevenue, ref?.bepRevenue) : null} deltaLabel={refLabel}
            plan={plan.hasPlan && plan.bepRevenue > 0 ? plan.bepRevenue : null} planLabel="Plan BEP"
            hint={localize(sOk ? baseHint(money(base.bepRevenue)) ?? 'Doimiy / CM ratio' : BEP_NOT_COMPUTABLE)} sparkline={m.spark.bepRevenue} />
          <KpiCard title={localize("Margin of safety")} value={scenario.marginOfSafetyPct} format="pct" status={sOk ? mosStatus(scenario.marginOfSafetyPct) : 'bad'}
            delta={sOk ? da(scenario.marginOfSafetyPct, ref?.marginOfSafetyPct) : null} deltaUnit=" p.p." deltaLabel={refLabel}
            hint={localize(baseHint(fmtPct(base.marginOfSafetyPct)) ?? '≥ 20% yaxshi · 10–20% ehtiyot · < 10% xavf')} sparkline={m.spark.mos} />
          <KpiCard title={localize("CM ratio")} value={scenario.contributionMarginRatio * 100} format="pct"
            delta={da(scenario.contributionMarginRatio * 100, ref ? ref.contributionMarginRatio * 100 : null)} deltaUnit=" p.p." deltaLabel={refLabel}
            plan={plan.hasPlan ? plan.cmr * 100 : null} planLabel="Plan CMR"
            hint={localize(baseHint(fmtPct(base.contributionMarginRatio * 100)) ?? '(Tushum − O\'zgaruvchan) / Tushum')} sparkline={m.spark.cmr} />
          <KpiCard title={localize("Sof foyda (ssenariy)")} value={scenario.profit} status={scenario.profit >= 0 ? 'good' : 'bad'}
            delta={dl(scenario.profit, ref?.profit)} deltaLabel={refLabel}
            plan={active ? base.profit : plan.hasPlan ? plan.netProfit : null} planLabel={active ? 'Baza' : 'Plan'}
            hint={localize(active ? scenarioNote : 'Soliq va boshqa daromadsiz (BEP modeli)')} sparkline={m.spark.profit} />
          <KpiCard title={localize("Doimiy xarajatlar")} value={scenario.fixedCosts} invert
            delta={dl(scenario.fixedCosts, ref?.fixedCosts)} deltaLabel={refLabel}
            plan={active ? base.fixedCosts : plan.hasPlan ? plan.fixedCosts : null} planLabel={active ? 'Baza' : 'Plan'}
            hint={localize(baseHint(money(base.fixedCosts)) ?? 'OPEX (logistika, marketingsiz) + amortizatsiya + foizlar')} sparkline={m.spark.fixed} />
        </>
      }
      charts={
        <>
          <ChartCard title={localize("BEP grafigi")} subtitle={localize(`Tushum va umumiy xarajat chiziqlari hajm bo'yicha; kesishuv — BEP nuqtasi. ${scenarioNote}.`)} height={300}
            exportData={[{ Hajm: Math.round(scenario.units), Narx: Math.round(scenario.price), "O'zg. xarajat/dona": Math.round(scenario.varCostPerUnit), 'Doimiy xarajat': Math.round(scenario.fixedCosts), 'BEP (dona)': Math.round(scenario.bepUnits), 'BEP (summa)': Math.round(scenario.bepRevenue) }]} exportName="BEP">
            {(sOk ? <BepChart r={scenario} /> : <div className="h-full flex items-center justify-center text-sm text-txt-muted px-4 text-center">{localize(BEP_NOT_COMPUTABLE)}</div>)}
          </ChartCard>
          <ChartCard title={localize("Sensitivity paneli")} subtitle={localize("4 omilni −20…+20% oralig'ida suring — sof foyda va BEP jonli o'zgaradi.")} height={300}
            headerRight={active ? <Button variant="ghost" size="sm" onClick={() => setDeltas(ZERO_DELTAS)}><RotateCcw />{localize(" Tiklash")}</Button> : undefined}>
            {(({ height }) => <SensitivityPanel deltas={deltas} onChange={onChange} scenario={scenario} base={base} active={active} height={height} />)}
          </ChartCard>
          <ChartCard title={localize("Tornado: qaysi omil kuchliroq")} subtitle={localize("Har omil ±20% o'zgarganda sof foydaning og'ishi (joriy ssenariyga nisbatan); eng kuchli omil yuqorida.")} exportData={tornadoExport} exportName="Tornado">
            <TornadoChart rows={m.tornado} />
          </ChartCard>
          <ChartCard title={localize("Omillar sensitivligi")} subtitle={localize("Har bir omil −20…+20% o'zgarganda sof foyda (boshqa omillar o'zgarmas).")} exportData={curvesExport} exportName="Sensitivity_egri">
            <SensitivityCurvesChart data={m.curves} />
          </ChartCard>
        </>
      }
      table={
        <DataTable columns={gridColumns} data={m.grid} dense exportName="Sensitivity_ssenariylar" exportRow={(r) => gridExport[m.grid.indexOf(r)] ?? {}}
          rowClassName={(r) => (r.delta === 0 ? 'bg-elevated/40' : '')}
          toolbar={<div className="flex items-baseline gap-2"><h3 className="section-title">{localize("Ssenariylar jadvali")}</h3><span className="text-xs text-txt-muted num">{localize(label)}{localize(" · baza bo'yicha ±10 / ±20%")}</span></div>} />
      }
    >
      <BepInputsStrip scenario={scenario} base={base} active={active} periodLabel={label} />
    </PageLayout>
  )
}
