/**
 * Admin → dashboard tarqalishi: useDataStore.setTable / appendRows / resetDemo / clearAll
 * chaqirilganda P&L sahifasidagi "Tushum" KPI darhol yangilanishi (useDataset → memo deps: data).
 */
import { act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Page from '@/pages/PnL'
import { useDataStore } from '@/store/useDataStore'
import { CURRENT_PERIOD } from '@/data/seed'
import { pnlTotals } from '@/lib/finance'
import { fmtMoney } from '@/lib/format'
import type { PnLRow } from '@/types'
import { BAD_TOKENS, renderPage } from './renderPage'

/** "Tushum" KPI kartasining katta raqami (KpiCard: title span → .kpi-value). */
function kpiText(container: HTMLElement, title: string): string {
  const cards = Array.from(container.querySelectorAll<HTMLElement>('.card-surface'))
  const card = cards.find((c) => c.querySelector<HTMLElement>('span[title]')?.getAttribute('title') === title && c.querySelector('.kpi-value'))
  if (!card) throw new Error(`KPI karta topilmadi: ${title}`)
  return card.querySelector<HTMLElement>('.kpi-value')!.textContent ?? ''
}

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 450)) })

describe('Admin → dashboard propagation (P&L Tushum KPI)', () => {
  it('setTable("pnl") — joriy oy tushumi 2× bo\'lsa KPI matni o\'zgaradi va yangi qiymatga teng', async () => {
    const res = await renderPage(Page, '/pnl', { range: '1m' })
    const store = useDataStore.getState()
    const before = pnlTotals(store.data.pnl, [CURRENT_PERIOD]).revenue
    expect(before).toBeGreaterThan(0)
    const shown = kpiText(res.container, 'Tushum')
    expect(shown).toBe(fmtMoney(before))

    const modified: PnLRow[] = store.data.pnl.map((r) => (r.group === 'revenue' && r.month === CURRENT_PERIOD ? { ...r, amount: r.amount * 2 } : r))
    await act(async () => { useDataStore.getState().setTable('pnl', modified) })
    await settle()

    const after = kpiText(res.container, 'Tushum')
    expect(after).not.toBe(shown)
    expect(after).toBe(fmtMoney(before * 2))
    expect(useDataStore.getState().version).toBeGreaterThan(store.version)
    const text = res.container.textContent ?? ''
    expect(BAD_TOKENS.filter((t) => text.includes(t))).toEqual([])
  })

  it('appendRows("pnl") — yangi tushum qatori KPI ni oshiradi', async () => {
    const res = await renderPage(Page, '/pnl', { range: '1m' })
    const before = pnlTotals(useDataStore.getState().data.pnl, [CURRENT_PERIOD]).revenue
    const extra: PnLRow[] = [{ id: 'TEST-1', month: CURRENT_PERIOD, group: 'revenue', item: 'Test', element: 'Test', amount: 250_000_000 }]
    await act(async () => { useDataStore.getState().appendRows('pnl', extra) })
    await settle()
    expect(kpiText(res.container, 'Tushum')).toBe(fmtMoney(before + 250_000_000))
  })

  it('resetDemo() — o\'zgartirilgandan keyin demo qiymat qaytadi', async () => {
    const res = await renderPage(Page, '/pnl', { range: '1m' })
    const original = kpiText(res.container, 'Tushum')
    await act(async () => { useDataStore.getState().setTable('pnl', []) })
    await settle()
    expect(kpiText(res.container, 'Tushum')).not.toBe(original)
    await act(async () => { useDataStore.getState().resetDemo() })
    await settle()
    expect(kpiText(res.container, 'Tushum')).toBe(original)
  })

  it('clearAll() — bo\'sh holat (EmptyState), NaN/Infinity yo\'q; resetDemo → KPI qaytadi', async () => {
    const res = await renderPage(Page, '/pnl', { range: '12m' })
    const original = kpiText(res.container, 'Tushum')
    await act(async () => { useDataStore.getState().clearAll() })
    await settle()
    const text = res.container.textContent ?? ''
    expect(text).toContain("Ma'lumot yo'q")
    expect(BAD_TOKENS.filter((t) => text.includes(t))).toEqual([])
    expect(res.container.querySelector('.kpi-value')).toBeNull()
    await act(async () => { useDataStore.getState().resetDemo() })
    await settle()
    expect(kpiText(res.container, 'Tushum')).toBe(original)
  })
})
