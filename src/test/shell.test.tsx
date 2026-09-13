import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { usePeriod, useSliceSync, useSliceNavigate, safeBackTarget } from '@/hooks'
import { useUiStore } from '@/store/useUiStore'
import { useDataStore } from '@/store/useDataStore'
import { useLanguageStore } from '@/i18n'
import { pnlPlanTotals } from '@/lib/finance/pnl'
import { pageCommands } from '@/components/shared/CommandPalette'
import { NAV_ITEMS } from '@/components/layout/nav'
import { ROUTES } from '@/lib/routes'
import { FilterBar } from '@/components/shared/FilterBar'
function Probe() {
  useSliceSync()
  const location = useLocation(), navigate = useNavigate(), drill = useSliceNavigate()
  const context = usePeriod()
  return <><output data-testid="url">{location.pathname + location.search}</output><output data-testid="plan">{context.comparisonTotals?.revenue}</output><button onClick={() => useUiStore.getState().setRange('3m')}>range</button><button onClick={() => drill('/finance/pnl/detail')}>drill</button><button onClick={() => navigate(-1)}>history</button><button onClick={() => { const back = safeBackTarget(location.search); if (back) navigate(back) }}>back</button><FilterBar /></>
}
beforeEach(() => { useUiStore.setState({ period: { range: '12m', asOf: '2026-08' }, activeSection: '', sectionFilters: {}, currency: 'UZS' }); useLanguageStore.getState().setLanguage('en') })
afterEach(cleanup)
describe('shell contracts', () => {
  it('command palette offers every finance page and nothing else', () => {
    const commands = pageCommands()
    expect(commands.map((c) => c.to)).toEqual(NAV_ITEMS.map((i) => i.to))
    expect(commands.every((c) => c.to.startsWith(ROUTES.finance))).toBe(true)
  })
  it('hydrates plan from URL, replaces edits and preserves slice in drill-down/back', async () => {
    render(<MemoryRouter initialEntries={['/finance/balance?period=mtd&asOf=2026-07&cmp=none&cur=UZS&filters=1','/finance/pnl?period=ytd&asOf=2026-08&cmp=plan&cur=USD&filters=1']} initialIndex={1}><Probe /></MemoryRouter>)
    await waitFor(() => expect(screen.getByTestId('plan')).toHaveTextContent(String(pnlPlanTotals(useDataStore.getState().data.budget, ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08']).revenue)))
    fireEvent.click(screen.getByText('range'))
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('period=3m'))
    fireEvent.click(screen.getByText('drill'))
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/finance/pnl/detail?'))
    expect(screen.getByTestId('url')).toHaveTextContent('cur=USD')
    fireEvent.click(screen.getByText('back'))
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/finance/pnl?'))
    expect(useUiStore.getState().period.comparison).toBe('plan')
  })
  it('replaces period clicks so browser Back restores previous route', async () => {
    render(<MemoryRouter initialEntries={['/finance/balance?period=mtd&asOf=2026-07&filters=1','/finance/pnl?period=ytd&asOf=2026-08&filters=1']} initialIndex={1}><Probe /></MemoryRouter>)
    fireEvent.click(screen.getByText('range')); fireEvent.click(screen.getByText('history'))
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('/finance/balance?'))
    expect(useUiStore.getState().period.asOf).toBe('2026-07')
  })
  it('reset removes section filters and persists explicit empty URL', async () => {
    render(<MemoryRouter initialEntries={['/finance/pnl?period=mtd&asOf=2026-08&filters=1&f.category=Elektronika']}><Probe /></MemoryRouter>)
    expect(useUiStore.getState().sectionFilters.finance.category).toEqual(['Elektronika'])
    fireEvent.click(screen.getByRole('button', { name: 'Reset (1)' }))
    await waitFor(() => expect(useUiStore.getState().sectionFilters.finance).toEqual({}))
    expect(screen.getByTestId('url').textContent).not.toContain('f.category')
  })
  it('cannot return to an external URL', () => {
    expect(safeBackTarget('?back=https%3A%2F%2Fevil.example')).toBeNull()
    expect(safeBackTarget('?back=%2F%2Fevil.example')).toBeNull()
  })
})
