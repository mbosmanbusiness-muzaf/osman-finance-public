/**
 * P&L sahifasi smoke testi — 4 rejim: 12 oy / 1 oy / 24 oy + USD / YTD + light.
 */
import { describe, it } from 'vitest'
import Page from '@/pages/PnL'
import { renderPage, expectClean } from '../renderPage'

describe('PnL smoke', () => {
  it('12m UZS dark', async () => expectClean(await renderPage(Page, '/pnl', { range: '12m' })))
  it('1m (bitta oy) — bo\'linish/oldingi davr', async () => expectClean(await renderPage(Page, '/pnl', { range: '1m' })))
  it('24m + USD', async () => expectClean(await renderPage(Page, '/pnl', { range: '24m', currency: 'USD' })))
  it('ytd + light', async () => expectClean(await renderPage(Page, '/pnl', { range: 'ytd', theme: 'light' })))
})
