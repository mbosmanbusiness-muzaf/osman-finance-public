import { translate as localize, useLanguageStore } from "@/i18n"
import { useMemo } from 'react'
import { useSliceNavigate } from '@/hooks'
import { ArrowRight, Calculator, TableProperties } from 'lucide-react'
import { ROUTES } from '@/lib/routes'
import { Button } from '@/components/ui/button'
import { ChartCard, KpiCard, PageLayout, WaterfallChart, performancePct } from '@/components/shared'
import { useCurrency, usePeriod } from '@/hooks'
import { fmtMonth, fmtNum, fmtPct } from '@/lib/format'
import { fin, pctChange } from '@/lib/utils'
import type { PnLTotals } from '@/lib/finance'
import { statusVsTarget, usePnLData } from './pnl/usePnLData'
import { CategoryChart, ChartNote, DynamicsChart, OpexDonut } from './pnl/PnLCharts'
import { PnLMonthlyTable } from './pnl/PnLTable'

interface KpiDef {
  key: keyof PnLTotals
  title: string
  format: 'money' | 'pct'
  /** kpiTargets kaliti (marjalar uchun holat nuqtasi) */
  targetKey?: string
}

const KPIS: KpiDef[] = [
  { key: 'revenue', title: 'Tushum', format: 'money' },
  { key: 'grossProfit', title: 'Yalpi foyda', format: 'money' },
  { key: 'grossMargin', title: 'Yalpi marja %', format: 'pct', targetKey: 'grossMargin' },
  { key: 'ebitda', title: 'EBITDA', format: 'money' },
  { key: 'netProfit', title: 'Sof foyda', format: 'money' },
  { key: 'netMargin', title: 'Sof marja %', format: 'pct', targetKey: 'netMargin' },
]

export default function PnL() {
  useLanguageStore((state) => state.language)
  const nav = useSliceNavigate()
  const { period, comparisonTotals, label, prevLabel, prevMonths, compareLabel, noCompareText: NO_PREV_HINT } = usePeriod()
  const { money } = useCurrency()
  const d = usePnLData()
  const sp = d.salesPrev
  const srel = (cur: number, prev: number | undefined) => (sp && prev !== undefined ? pctChange(cur, prev) : null)
  const salesKpis = (
    <>
      <KpiCard title={localize("Savdo (tovar)")} value={d.sales.revenue} delta={period.comparison === 'plan' ? d.sales.plan > 0 ? pctChange(d.sales.revenue, d.sales.plan) : null : srel(d.sales.revenue, sp?.revenue)} deltaLabel={compareLabel} plan={d.sales.plan > 0 ? d.sales.plan : null} planLabel="Sotuv plani"
        sparkline={d.salesLast12.map((s) => s.revenue)} hint={localize(sp || period.comparison === 'plan' && d.sales.plan > 0 ? 'Tranzaksiyalar bo\'yicha (xizmatlarsiz)' : NO_PREV_HINT)} />
      <KpiCard title={localize("Cheklar soni")} value={d.sales.receipts} format="number" delta={srel(d.sales.receipts, sp?.receipts)} deltaLabel={compareLabel}
        sparkline={d.salesLast12.map((s) => s.receipts)} hint={localize(sp ? `${fmtNum(d.sales.avgUnitsPerCheck, 1)} dona / chek` : NO_PREV_HINT)} />
      <KpiCard title={localize("Sotilgan tovar soni")} value={d.sales.units} format="number" delta={srel(d.sales.units, sp?.units)} deltaLabel={compareLabel}
        sparkline={d.salesLast12.map((s) => s.units)} hint={localize(sp ? `O'rtacha narx ${money(d.sales.avgPrice)}` : NO_PREV_HINT)} />
      <KpiCard title={localize("O'rtacha chek")} value={d.sales.avgCheck} delta={srel(d.sales.avgCheck, sp?.avgCheck)} deltaLabel={compareLabel}
        sparkline={d.salesLast12.map((s) => s.avgCheck)} hint={localize(sp ? 'Savdo / cheklar soni' : NO_PREV_HINT)} />
    </>
  )

  const kpis = useMemo(() => KPIS.map((k) => {
    const value = fin(d.totals[k.key])
    const prev = d.prevTotals ? fin(d.prevTotals[k.key]) : null
    const isPct = k.format === 'pct'
    // marjalar: absolyut farq (p.p.), summalar: % o'zgarish
    const delta = prev === null ? null : isPct ? value - prev : pctChange(value, prev)
    const plan = d.hasPlan ? fin(d.planTotals[k.key]) : null
    const sparkline = d.last12.map((m) => fin(m[k.key]))
    const status = k.targetKey ? statusVsTarget(value, d.targets[k.targetKey]) : null
    const target = k.targetKey ? d.targets[k.targetKey] : undefined
    const hint = prev === null ? NO_PREV_HINT : target ? `Maqsad ${fmtPct(fin(target.target))}` : undefined
    return { ...k, value, delta, plan, sparkline, status, hint, deltaUnit: isPct ? ' p.p.' : undefined }
  }), [d, NO_PREV_HINT])

  const waterfallExport = useMemo(() => d.waterfall.map((s) => ({ Bosqich: s.name, Summa: Math.round(s.value), Tur: s.type === 'total' ? 'Jami' : s.type === 'up' ? 'Oshirish' : 'Kamaytirish' })), [d.waterfall])
  const dynamicsExport = useMemo(() => d.last12.map((m) => ({ Oy: fmtMonth(m.month, true), Tushum: Math.round(m.revenue), 'Plan tushum': Math.round(m.planRevenue), 'Sof foyda': Math.round(m.netProfit) })), [d.last12])
  const categoryExport = useMemo(() => d.categories.map((c) => ({ Kategoriya: c.category, Tushum: Math.round(c.revenue), COGS: Math.round(c.cogs), 'Yalpi foyda': Math.round(c.grossProfit), 'Marja %': Number(fin(c.margin).toFixed(1)) })), [d.categories])
  const opexExport = useMemo(() => d.opexItems.map((i) => ({ Modda: i.name, Summa: Math.round(i.value), 'Ulush %': Number(fin(i.share).toFixed(1)) })), [d.opexItems])

  const last12Label = d.last12.length ? `${fmtMonth(d.last12[0].month)} – ${fmtMonth(d.last12[d.last12.length - 1].month)}` : '—'

  // Plan har joyda: COGS/OPEX (xarajat — plan/fakt), EBITDA, sof foyda plan bajarilishi grafik izohida
  const planFooter = useMemo(() => {
    if (!d.hasPlan) return undefined
    const p = d.planTotals, t = d.totals
    const item = (name: string, fact: number, plan: number, isCost: boolean) => `${name}: plan ${money(plan)} · ${fmtPct(performancePct(fact, plan, isCost), 0)}`
    return `Plan/Fakt — ${item('COGS', t.cogs, p.cogs, true)} · ${item('OPEX', t.opex, p.opex, true)} · ${item('EBITDA', t.ebitda, p.ebitda, false)} · ${item('Sof foyda', t.netProfit, p.netProfit, false)}`
  }, [d, money])
  const opexFooter = d.hasPlan ? `Plan OPEX ${money(d.planTotals.opex)} · Fakt ${money(d.totals.opex)} · bajarilish ${fmtPct(performancePct(d.totals.opex, d.planTotals.opex, true), 0)} (xarajat: plan/fakt)` : undefined
  const detailButton = (
    <Button variant="outline" size="sm" onClick={() => nav(ROUTES.pnlDetail)}><TableProperties />{localize(" Batafsil P&L")}<ArrowRight /></Button>
  )

  return (
    <PageLayout
      title={localize("P&L — foyda va zarar")}
      subtitle={localize(comparisonTotals ? `Tushumdan sof foydagacha: plan/fakt va taqqoslama davri (${prevLabel})` : `Tushumdan sof foydagacha: plan/fakt · ${NO_PREV_HINT}`)}
      actions={
        <>
          {(detailButton)}
          <Button variant="outline" size="sm" onClick={() => nav(ROUTES.bep)}><Calculator />{localize(" BEP va Sensitivity")}<ArrowRight /></Button>
        </>
      }
      kpiCols={6}
      kpisSecondary={salesKpis}
      kpisSecondaryTitle={localize("Savdo ko'rsatkichlari")}
      kpisSecondaryCols={4}
      kpis={
        <>
          {(kpis.map((k) => (
            <KpiCard
              key={k.key}
              title={localize(k.title)}
              value={k.value}
              format={k.format}
              delta={k.delta}
              deltaLabel={compareLabel}
              deltaUnit={k.deltaUnit}
              plan={k.plan}
              sparkline={k.sparkline}
              status={k.status}
              hint={localize(k.hint)}
            />
          )))}
        </>
      }
      charts={
        <>
          <ChartCard
            title={localize("Waterfall: Tushum → Sof foyda")}
            subtitle={localize(`${label}: tushumdan sof foydagacha har bosqichda qancha ketgani (COGS, OPEX, amortizatsiya, foiz, soliq).`)}
            span={2}
            height={300}
            exportData={waterfallExport}
            exportName="PnL_waterfall"
            footer={planFooter}
          >
            {(({ height }) => (d.totals.revenue > 0 ? <WaterfallChart steps={d.waterfall} height={height} /> : <ChartNote text="Tanlangan davrda tushum yo'q" />))}
          </ChartCard>
          <ChartCard
            title={localize("12 oylik dinamika")}
            subtitle={localize(`Joriy davrgacha oxirgi 12 oy (${last12Label}): ustun — tushum, chiziq — sof foyda (o'ng o'q), punktir — plan tushum.`)}
            exportData={dynamicsExport}
            exportName="PnL_12oy"
          >
            <DynamicsChart series={d.last12} />
          </ChartCard>
          <ChartCard
            title={localize("Segment kesimi: kategoriya bo'yicha foyda")}
            subtitle={localize("Tanlangan davrda har mahsulot kategoriyasi keltirgan yalpi foyda; yorliq — yalpi marja %.")}
            exportData={categoryExport}
            exportName="PnL_kategoriya"
          >
            <CategoryChart categories={d.categories} />
          </ChartCard>
          <ChartCard
            title={localize("OPEX tarkibi")}
            subtitle={localize("Operatsion xarajatlarning modda bo'yicha tarkibi va ulushi (tanlangan davr).")}
            exportData={opexExport}
            exportName="PnL_opex"
            footer={opexFooter}
          >
            {(({ expanded }) => <OpexDonut items={d.opexItems} total={d.opexTotal} expanded={expanded} />)}
          </ChartCard>
        </>
      }
      table={
        <>
          <PnLMonthlyTable rows={d.monthly} totals={d.totals} planRevenue={d.hasPlan ? d.planTotals.revenue : 0} label={localize(label)} />
          <Button variant="outline" className="w-full mt-3" onClick={() => nav(ROUTES.pnlDetail)}>
            <TableProperties />{localize(" Batafsil P&L")}<ArrowRight />
          </Button>
          {(!prevMonths.length && period.comparison !== 'plan' && <p className="mt-2 text-xs text-txt-muted text-center">{localize(NO_PREV_HINT)}{localize(" — taqqoslama uchun qisqaroq davr tanlang.")}</p>)}
        </>
      }
    />
  )
}
