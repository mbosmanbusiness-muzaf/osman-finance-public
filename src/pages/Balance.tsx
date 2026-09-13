import { translate as localize, useLanguageStore } from "@/i18n"
import { useMemo } from 'react'
import { ChartCard, PageLayout } from '@/components/shared'
import { useCurrency, useDataset, usePeriod } from '@/hooks'
import { balanceAt, balanceTotals, computeRatioCards, inventoryByCategory, inventoryRows } from '@/lib/finance'
import { addMonths } from '@/lib/period'
import { fin } from '@/lib/utils'
import { RatioCardView } from './balance/RatioCardView'
import { AssetLiabChart, BalanceTrendChart, InventoryTreemap, WorkingCapitalChart } from './balance/BalanceCharts'
import { BalanceSheetTable } from './balance/BalanceSheetTable'
import { InventoryTable } from './inventory/InventoryTable'

/** Balans: 12 koeffitsiyent kartasi, Aktiv/Passiv, dinamika, zaxira treemap, balans jadvali, zaxira ro'yxati. */
export default function Balance() {
  useLanguageStore((state) => state.language)
  const { data, allMonths } = useDataset()
  const { months, prevMonths, asOf, asOfDate, label } = usePeriod()
  const { money } = useCurrency()

  const m = useMemo(() => {
    const cards = computeRatioCards({ balance: data.balance, pnl: data.pnl, months, allMonths, prevMonths, targets: data.kpiTargets })
    const bal = balanceAt(data.balance, asOf)
    const prevKey = prevMonths.length ? prevMonths[prevMonths.length - 1] : addMonths(asOf, -Math.max(1, months.length))
    const prev = balanceAt(data.balance, prevKey)
    const last12 = allMonths.filter((x) => x <= asOf).slice(-12).map((x) => balanceAt(data.balance, x))
    const invCats = inventoryByCategory(data.inventory, data.products, data.pnl, months, asOfDate)
    const invRows = inventoryRows(data.inventory, data.products, data.pnl, months, asOfDate)
    const invTotal = invRows.reduce((a, r) => a + r.value, 0)
    const idle = invRows.filter((r) => r.idleDays > 90)
    return { cards, bal, prev, last12, invCats, invRows, invTotal, idleValue: idle.reduce((a, r) => a + r.value, 0), idleCount: idle.length, totals: balanceTotals(bal) }
  }, [data, months, prevMonths, asOf, asOfDate, allMonths])

  const catExport = useMemo(() => m.invCats.map((c) => ({ Kategoriya: c.category, Qiymat: Math.round(c.value), 'Ulush %': Number(c.share.toFixed(1)), 'Aylanish (kun)': Math.round(c.turnoverDays), 'Harakatsiz 90+': Math.round(c.idleValue), 'Harakatsiz soni': c.idleItems })), [m.invCats])
  const trendExport = useMemo(() => m.last12.map((b) => { const t = balanceTotals(b); return { Oy: b.month, 'Jami aktivlar': t.totalAssets, Kapital: t.equity, 'Jami majburiyatlar': t.totalLiabilities, Kreditlar: t.totalDebt } }), [m.last12])
  const wcExport = useMemo(() => m.last12.map((b) => ({ Oy: b.month, Debitorlik: fin(b.receivables), Zaxira: fin(b.inventory), Kreditorlik: fin(b.payables) })), [m.last12])
  const alExport = useMemo(() => [{ Tomon: 'Aktivlar', Jami: m.totals.totalAssets, Joriy: m.totals.currentAssets, 'Uzoq muddatli': m.totals.nonCurrentAssets }, { Tomon: 'Passiv + Kapital', Jami: m.totals.totalLiabEquity, Joriy: m.totals.currentLiabilities, 'Uzoq muddatli': m.totals.nonCurrentLiabilities + m.totals.equity }], [m.totals])

  return (
    <PageLayout
      title={localize("Balans va koeffitsiyentlar")}
      subtitle={localize(`12 ta koeffitsiyent (norma, maqsad va izoh bilan), Aktiv/Passiv tarkibi va zaxira tahlili · ${label}`)}
      kpiCols={6}
      kpis={<>{(m.cards.map((c) => <RatioCardView key={c.key} card={c} />))}</>}
      charts={
        <>
          <ChartCard title={localize("Aktiv / Passiv tarkibi")} subtitle={localize(`Holat: ${asOf} · aktivlar va ularni moliyalashtirish manbalari (majburiyat + kapital) bir xil balandlikda bo'lishi kerak.`)} exportData={alExport} exportName="Balans_tarkib" height={320}>
            <AssetLiabChart bal={m.bal} />
          </ChartCard>
          <ChartCard title={localize("Balans dinamikasi (12 oy)")} subtitle={localize("Jami aktivlar, kapital, majburiyatlar va kreditlar oy oxiri holatida.")} exportData={trendExport} exportName="Balans_dinamika" height={320}>
            <BalanceTrendChart rows={m.last12} />
          </ChartCard>
          <ChartCard title={localize("Zaxira: tovar kategoriyasi bo'yicha")} subtitle={localize(`Katak hajmi — zaxira qiymati; ichida aylanish kuni va 90+ kun harakatsiz qiymat. Jami ${money(m.invTotal)}, harakatsiz ${money(m.idleValue)} (${m.idleCount} ta mahsulot).`)} exportData={catExport} exportName="Zaxira_kategoriya" height={320}>
            <InventoryTreemap rows={m.invCats} />
          </ChartCard>
          <ChartCard title={localize("Aylanma kapital (12 oy)")} subtitle={localize("Debitorlik, zaxira va kreditorlik dinamikasi; punktir — sof aylanma kapital.")} exportData={wcExport} exportName="Aylanma_kapital" height={320}>
            <WorkingCapitalChart rows={m.last12} />
          </ChartCard>
        </>
      }
      table={<InventoryTable rows={m.invRows} />}
    >
      <BalanceSheetTable cur={m.bal} prev={m.prev} />
    </PageLayout>
  )
}
