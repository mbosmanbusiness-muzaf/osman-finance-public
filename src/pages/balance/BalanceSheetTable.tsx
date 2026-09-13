import { CheckCircle2, XCircle } from 'lucide-react'
import { t, translate as localize, useLanguageStore } from '@/i18n'
import { useCurrency } from '@/hooks'
import { balanceTotals } from '@/lib/finance'
import { fmtMonth, fmtPct } from '@/lib/format'
import type { BalanceMonth } from '@/types'
import { cn, fin, pctChange } from '@/lib/utils'
import { ASSET_KEYS, LIAB_KEYS } from './BalanceCharts'

interface Line { label: string; cur: number; prev: number; kind?: 'sub' | 'total' }

function Side({ title, lines, curLabel, prevLabel }: { title: string; lines: Line[]; curLabel: string; prevLabel: string }) {
  useLanguageStore((state) => state.language)
  const { money } = useCurrency()
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="table-head text-left px-2 py-2">{localize(title)}</th>
          <th className="table-head text-right px-2 py-2">{curLabel}</th>
          <th className="table-head text-right px-2 py-2">{prevLabel}</th>
          <th className="table-head text-right px-2 py-2">Δ %</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => {
          const d = pctChange(l.cur, l.prev)
          return (
            <tr key={l.label} className={cn('border-b border-border/60', l.kind === 'sub' && 'font-medium bg-elevated/30', l.kind === 'total' && 'font-semibold bg-elevated/60 border-t border-border')}>
              <td className={cn('px-2 py-1.5 font-sans', l.kind ? 'text-txt-primary' : 'text-txt-secondary pl-4')}>{localize(l.label)}</td>
              <td className="px-2 py-1.5 text-right num text-txt-primary">{money(l.cur)}</td>
              <td className="px-2 py-1.5 text-right num text-txt-secondary">{money(l.prev)}</td>
              <td className={cn('px-2 py-1.5 text-right num', Math.abs(d) < 0.05 ? 'text-txt-muted' : d > 0 ? 'text-positive' : 'text-negative')}>{fmtPct(d, 1, true)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** Balans jadvali: Aktivlar | Passivlar yonma-yon, joriy va o'tgan davr, tenglik tekshiruvi. */
export function BalanceSheetTable({ cur, prev }: { cur: BalanceMonth; prev: BalanceMonth }) {
  useLanguageStore((state) => state.language)
  const { money } = useCurrency()
  const tc = balanceTotals(cur), tp = balanceTotals(prev)
  const v = (b: BalanceMonth, k: keyof BalanceMonth) => fin(b[k] as number)
  const assets: Line[] = [
    ...ASSET_KEYS.slice(0, 4).map((k) => ({ label: k.label, cur: v(cur, k.key), prev: v(prev, k.key) })),
    { label: 'Joriy aktivlar', cur: tc.currentAssets, prev: tp.currentAssets, kind: 'sub' },
    ...ASSET_KEYS.slice(4).map((k) => ({ label: k.label, cur: v(cur, k.key), prev: v(prev, k.key) })),
    { label: 'Uzoq muddatli aktivlar', cur: tc.nonCurrentAssets, prev: tp.nonCurrentAssets, kind: 'sub' },
    { label: 'JAMI AKTIVLAR', cur: tc.totalAssets, prev: tp.totalAssets, kind: 'total' },
  ]
  const liab: Line[] = [
    ...LIAB_KEYS.slice(0, 3).map((k) => ({ label: k.label, cur: v(cur, k.key), prev: v(prev, k.key) })),
    { label: 'Joriy majburiyatlar', cur: tc.currentLiabilities, prev: tp.currentLiabilities, kind: 'sub' },
    { label: LIAB_KEYS[3].label, cur: v(cur, 'longTermDebt'), prev: v(prev, 'longTermDebt') },
    { label: 'Jami majburiyatlar', cur: tc.totalLiabilities, prev: tp.totalLiabilities, kind: 'sub' },
    ...LIAB_KEYS.slice(4).map((k) => ({ label: k.label, cur: v(cur, k.key), prev: v(prev, k.key) })),
    { label: 'Kapital', cur: tc.equity, prev: tp.equity, kind: 'sub' },
    { label: 'JAMI PASSIV + KAPITAL', cur: tc.totalLiabEquity, prev: tp.totalLiabEquity, kind: 'total' },
  ]
  const ok = Math.abs(tc.check) < 1000
  return (
    <div className="card-surface p-4 animate-fade-in">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <div>
          <h3 className="section-title">{localize('Balans jadvali')}</h3>
          <p className="text-xs text-txt-muted">{t('Oy oxiri holati: {cur} va {prev} bilan taqqoslama.', { cur: fmtMonth(cur.month, true), prev: fmtMonth(prev.month, true) })}</p>
        </div>
        <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium num', ok ? 'text-positive' : 'text-negative')}>
          {ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {localize('Balans tengligi:')} {ok ? localize('✓ farq 0') : t('farq {v}', { v: money(tc.check) })}
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 overflow-x-auto">
        <Side title="Aktivlar" lines={assets} curLabel={fmtMonth(cur.month)} prevLabel={fmtMonth(prev.month)} />
        <Side title="Passivlar va kapital" lines={liab} curLabel={fmtMonth(cur.month)} prevLabel={fmtMonth(prev.month)} />
      </div>
    </div>
  )
}
