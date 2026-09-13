import { translate as localize, useLanguageStore } from "@/i18n"
import { useMemo, useState } from 'react'
import { Wallet } from 'lucide-react'
import { ChartCard, KpiCard, PageLayout, WaterfallChart } from '@/components/shared'
import { useCurrency, usePeriod } from '@/hooks'
import { fmtMonth, fmtPct } from '@/lib/format'
import type { Granularity } from '@/lib/finance'
import { fin, safeDiv } from '@/lib/utils'
import { CashBalanceChart } from './cashflow/CashBalanceChart'
import { CashflowTable } from './cashflow/CashflowTable'
import { FlowCards } from './cashflow/FlowCards'
import { FlowsCompositionChart } from './cashflow/FlowsCompositionChart'
import { MonthDetailDialog } from './cashflow/MonthDetailDialog'
import { EmptyNote, GranularityToggle } from './cashflow/common'
import { flowDelta, useCashSeries, useCashflowModel } from './cashflow/useCashflowModel'

export default function Cashflow() {
  useLanguageStore((state) => state.language)
  const { period, months, label, compareLabel, noCompareText: NO_PREV } = usePeriod()
  const { money } = useCurrency()
  const model = useCashflowModel()
  const { totals, prevTotals, hasPrev, series, waterfall, minCash, planClosing, planOcf, spark, byMonth } = model

  // Kunlik | Haftalik | Oylik — foydalanuvchi tanlamaguncha davr uzunligiga qarab
  const [picked, setPicked] = useState<Granularity | null>(null)
  const granularity: Granularity = picked ?? (months.length > 3 ? 'month' : 'day')
  const cash = useCashSeries(granularity)

  const [detailMonth, setDetailMonth] = useState<string | null>(null)

  const deltaLabel = hasPrev || period.comparison === 'plan' ? compareLabel : undefined
  const signedMoney = (v: number) => money(v, { sign: true })
  const cmp = (curr: number, prev: number, plan?: number | null) => {
    const d = period.comparison === 'plan' ? flowDelta(curr, plan ?? 0, plan !== null && plan !== undefined) : flowDelta(curr, prev, hasPrev)
    return d === null ? { delta: null } : d.isAbs ? { delta: d.value, deltaFormat: signedMoney } : { delta: d.value }
  }

  const closingStatus: 'good' | 'warn' | 'bad' = totals.closing < minCash ? 'bad' : totals.closing < minCash * 1.25 ? 'warn' : 'good'
  const belowMin = useMemo(() => cash.filter((pt) => pt.balance < minCash).length, [cash, minCash])
  const coverage = safeDiv(totals.closing, minCash, 0)

  const balanceExport = useMemo(
    () => cash.map((pt) => ({ Sana: granularity === 'month' ? fmtMonth(pt.key) : pt.label, Kirim: pt.inflow, Chiqim: pt.outflow, Sof: pt.net, Qoldiq: pt.balance, 'Plan qoldiq': pt.planBalance })),
    [cash, granularity],
  )
  const compositionExport = useMemo(
    () => series.map((s) => ({ Oy: fmtMonth(s.month), 'Operatsion CF': s.ocf, 'Investitsion CF': s.icf, 'Moliyaviy CF': s.fcf, "Sof o'zgarish": s.netChange })),
    [series],
  )
  const waterfallExport = useMemo(() => waterfall.map((w) => ({ Bosqich: w.name, Qiymat: w.value })), [waterfall])

  const kpis = (
    <>
      <KpiCard
        title={localize("Yakuniy qoldiq")}
        value={totals.closing}
        {...cmp(totals.closing, prevTotals.closing, planClosing)}
        deltaLabel={deltaLabel}
        plan={planClosing}
        planLabel="Plan"
        status={closingStatus}
        sparkline={spark.closing}
        hint={localize(`Minimal ${money(minCash)} · qoplama ${fin(coverage).toFixed(1)}×`)}
        icon={<Wallet className="h-4 w-4" />}
      />
      <KpiCard
        title={localize("Operatsion CF")}
        value={totals.ocf}
        {...cmp(totals.ocf, prevTotals.ocf, planOcf)}
        deltaLabel={deltaLabel}
        plan={planOcf}
        planLabel="Plan"
        status={totals.ocf >= 0 ? 'good' : 'bad'}
        sparkline={spark.ocf}
        hint={localize(hasPrev || period.comparison === 'plan' && planOcf !== null ? undefined : NO_PREV)}
      />
      <KpiCard
        title={localize("Investitsion CF")}
        value={totals.icf}
        {...cmp(totals.icf, prevTotals.icf)}
        deltaLabel={deltaLabel}
        invert
        sparkline={spark.icf}
        hint={localize(hasPrev ? 'CapEx − aktivlar sotuvi' : NO_PREV)}
      />
      <KpiCard
        title={localize("Moliyaviy CF")}
        value={totals.fcf}
        {...cmp(totals.fcf, prevTotals.fcf)}
        deltaLabel={deltaLabel}
        sparkline={spark.fcf}
        hint={localize(hasPrev ? 'Kreditlar − qaytarish − dividend' : NO_PREV)}
      />
      <KpiCard
        title={localize("Free cash flow")}
        value={totals.freeCashFlow}
        {...cmp(totals.freeCashFlow, prevTotals.freeCashFlow)}
        deltaLabel={deltaLabel}
        status={totals.freeCashFlow >= 0 ? 'good' : 'bad'}
        sparkline={spark.freeCashFlow}
        hint={localize(hasPrev ? 'OCF − CapEx' : `OCF − CapEx · ${NO_PREV}`)}
      />
      <KpiCard
        title={localize("Sof o'zgarish")}
        value={totals.netChange}
        {...cmp(totals.netChange, prevTotals.netChange)}
        deltaLabel={deltaLabel}
        status={totals.netChange >= 0 ? 'good' : 'warn'}
        sparkline={spark.netChange}
        hint={localize(hasPrev ? `Davr: ${label}` : NO_PREV)}
      />
    </>
  )

  const charts = (
    <>
      <ChartCard
        title={localize("Pul qoldig'i")}
        subtitle={localize(`Davr davomidagi pul qoldig'i (${granularity === 'day' ? 'kunlik' : granularity === 'week' ? 'haftalik' : 'oylik'}) plan qoldiq va minimal xavfsiz chegara bilan.`)}
        span={2}
        height={300}
        exportData={balanceExport}
        exportName="Cashflow_qoldiq"
        headerRight={
          belowMin > 0
            ? <span className="chip chip-neg">{(belowMin)}{localize(" nuqta minimumdan past")}</span>
            : cash.length > 0 ? <span className="chip chip-pos">{localize("Minimumdan yuqori")}</span> : null
        }
      >
        <CashBalanceChart data={cash} granularity={granularity} minCash={minCash} />
      </ChartCard>

      <ChartCard
        title={localize("Birlashtirilgan waterfall")}
        subtitle={localize("Boshlang'ich qoldiqdan operatsion, investitsion va moliyaviy oqimlar orqali yakuniy qoldiqqacha.")}
        exportData={waterfallExport}
        exportName="Cashflow_waterfall"
        footer={`Sof o'zgarish: ${money(totals.netChange, { sign: true })} (${fmtPct(safeDiv(totals.netChange, Math.abs(totals.opening), 0) * 100, 1, true)} boshlang'ich qoldiqqa)`}
      >
        {(({ height }) => (series.length ? <WaterfallChart steps={waterfall} height={height} /> : <EmptyNote />))}
      </ChartCard>

      <ChartCard
        title={localize("Oylik oqimlar tarkibi")}
        subtitle={localize("Har oy uchun 3 oqim (ustunlar, ishora bo'yicha) va sof o'zgarish chizig'i.")}
        exportData={compositionExport}
        exportName="Cashflow_oqimlar"
      >
        <FlowsCompositionChart series={series} />
      </ChartCard>
    </>
  )

  return (
    <PageLayout
      title={localize("Cashflow — pul oqimi")}
      subtitle={localize("To'g'ri (direct) usul: operatsion, investitsion va moliyaviy oqimlar, pul qoldig'i va plan bilan taqqoslash")}
      filters={<GranularityToggle value={granularity} onChange={setPicked} />}
      kpis={kpis}
      kpiCols={6}
      charts={charts}
      table={<CashflowTable series={series} totals={totals} byMonth={byMonth} onRowClick={setDetailMonth} />}
    >
      <FlowCards model={model} />
      <MonthDetailDialog month={detailMonth} row={detailMonth ? byMonth.get(detailMonth) : undefined} onClose={() => setDetailMonth(null)} />
    </PageLayout>
  )
}
