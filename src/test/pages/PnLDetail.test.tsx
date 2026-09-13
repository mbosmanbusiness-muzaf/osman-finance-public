/**
 * P&L — batafsil sahifasi smoke testi.
 * Har sahifa 4 rejimda tekshiriladi: 12 oy / 1 oy / USD / light.
 */
import { describe, it } from 'vitest'
import Page from '@/pages/PnLDetail'
import { renderPage, expectClean } from '../renderPage'

describe('Page smoke', () => {
  it('12m UZS dark', async () => expectClean(await renderPage(Page, '/pnl/detail', { range: '12m' })))
  it('1m (bitta oy) — bo\'linish/oldingi davr', async () => expectClean(await renderPage(Page, '/pnl/detail', { range: '1m' })))
  it('24m + USD', async () => expectClean(await renderPage(Page, '/pnl/detail', { range: '24m', currency: 'USD' })))
  it('ytd + light', async () => expectClean(await renderPage(Page, '/pnl/detail', { range: 'ytd', theme: 'light' })))
})
