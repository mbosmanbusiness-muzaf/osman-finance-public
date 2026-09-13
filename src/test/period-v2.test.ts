import { describe, expect, it } from 'vitest'
import { addMonths, isPeriodAvailable, monthsInRange, periodBounds, periodStep, readSlice, shiftPeriod, writeSlice, type Period, type RangeKey } from '@/lib/period'
import { filterDataset } from '@/hooks'
import { useDataStore } from '@/store/useDataStore'
const all = Array.from({ length: 48 }, (_, i) => addMonths('2023-01', i))
describe('period v2 calendar semantics', () => {
  const cases: [RangeKey, string, string, number][] = [
    ['1m','2026-08','2026-08',1],['3m','2026-06','2026-08',3],['6m','2026-03','2026-08',6],['12m','2025-09','2026-08',12],['24m','2024-09','2026-08',24],
    ['qtd','2026-07','2026-08',3],['ytd','2026-01','2026-08',12],['last-month','2026-07','2026-07',1],['last-quarter','2026-04','2026-06',3],['last-year','2025-01','2025-12',12],['custom','2026-05','2026-08',4],['all','2023-01','2026-08',44],
  ]
  it.each(cases)('%s has explicit boundaries and reversible arrows', (range, from, to, step) => {
    const period: Period = { range, asOf: '2026-08', from: '2026-05' }
    expect(periodBounds(period, all[0])).toEqual({ from, to })
    expect(periodStep(period, all[0])).toBe(step)
    const next = shiftPeriod(period, 1, all[0])
    expect(next.asOf).toBe(addMonths(period.asOf, step))
    if (range !== 'all') expect(shiftPeriod(next, -1, all[0])).toEqual(period)
    expect(isPeriodAvailable(all, period)).toBe(true)
  })
  it('closed quarters and years cross January correctly', () => {
    expect(periodBounds({ range: 'last-quarter', asOf: '2026-01' })).toEqual({ from: '2025-10', to: '2025-12' })
    expect(monthsInRange(all, { range: 'last-year', asOf: '2026-01' })).toHaveLength(12)
  })
  it('rejects incomplete and gapped presets', () => {
    expect(isPeriodAvailable(['2026-07','2026-08'], { range: '12m', asOf: '2026-08' })).toBe(false)
    expect(isPeriodAvailable(['2026-06','2026-08'], { range: '3m', asOf: '2026-08' })).toBe(false)
    expect(isPeriodAvailable([], { range: 'all', asOf: '2026-08' })).toBe(false)
  })
})
describe('shareable slices', () => {
  const fallback = { period: { asOf: '2026-08', range: 'ytd' as const }, currency: 'UZS' as const, filters: { segment: ['Ulgurji'] } }
  it('round-trips custom periods, comparison, currency, multi-select and unrelated query', () => {
    const state = { period: { asOf: '2026-08', from: '2025-12', range: 'custom' as const, comparison: 'plan' as const }, currency: 'USD' as const, filters: { category: ['A & B','C'], segment: ['Ulgurji'] } }
    const search = writeSlice('?tab=margin', state)
    expect(readSlice(search, fallback)).toEqual(state)
    expect(new URLSearchParams(search).get('tab')).toBe('margin')
    expect(writeSlice(search, state)).toBe(search)
  })
  it('ignores invalid URL values and makes explicit empty filters override storage', () => {
    expect(readSlice('?period=bad&asOf=2026-99&cmp=bad&cur=EUR', fallback)).toEqual(fallback)
    expect(readSlice('?filters=1', fallback).filters).toEqual({})
    expect(readSlice('?period=mtd&cmp=year', fallback).period).toMatchObject({ range: '1m', comparison: 'year' })
  })
  it('filters transactions using OR within a dimension and AND between dimensions', () => {
    const data = useDataStore.getState().data
    const category = data.products[0].category
    const filtered = filterDataset(data, { category: [category], segment: ['Ulgurji'] })
    const products = new Set(data.products.filter((p) => p.category === category).map((p) => p.id))
    const customers = new Set(data.customers.filter((c) => c.segment === 'Ulgurji').map((c) => c.id))
    expect(filtered.sales).toEqual(data.sales.filter((r) => products.has(r.productId) && customers.has(r.customerId)))
    expect(filterDataset(data, {})).toBe(data)
    expect(filtered.budget.filter((r) => r.scope === 'pnl')).toEqual([])
  })
})
