/**
 * Tanqidchi (critic) chekka holatlari — regressiya testi.
 * Har sahifa quyidagi rejimlarda NaN/Infinity/undefined chiqarmasligi va runtime xatosiz render bo'lishi shart:
 *  1. Bo'sh ma'lumot (clearAll) → EmptyState.
 *  2. Bitta oy ('1m') — nolga bo'lish / oldingi davr yo'q.
 *  3. Birinchi oy asOf — oldingi davr, o'tgan yil va YTD oynalari bo'sh.
 *  4. Hujjatsiz oy — debitorlik/kreditorlik hujjatlari hali yo'q (aging, DSO/DPO, to'lov taqvimi nol).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ComponentType } from 'react'
import { useDataStore } from '@/store/useDataStore'
import { useUiStore } from '@/store/useUiStore'
import { CURRENT_PERIOD, MONTH_COUNT } from '@/data/seed'
import { addMonths, type ComparisonKey, type RangeKey } from '@/lib/period'
import { useLanguageStore, type Language } from '@/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BAD_TOKENS } from './renderPage'
import PnL from '@/pages/PnL'
import PnLDetail from '@/pages/PnLDetail'
import Bep from '@/pages/Bep'
import Cashflow from '@/pages/Cashflow'
import Balance from '@/pages/Balance'
import Budgeting from '@/pages/Budgeting'
import { ROUTES } from '@/lib/routes'

interface PageDef { name: string; Page: ComponentType; path: string }

const PAGES: PageDef[] = [
  { name: 'PnL', Page: PnL, path: ROUTES.pnl },
  { name: 'PnLDetail', Page: PnLDetail, path: ROUTES.pnlDetail },
  { name: 'Bep', Page: Bep, path: ROUTES.bep },
  { name: 'Cashflow', Page: Cashflow, path: ROUTES.cashflow },
  { name: 'Balance', Page: Balance, path: ROUTES.balance },
  { name: 'Budgeting', Page: Budgeting, path: ROUTES.budget },
]

const FIRST_MONTH = addMonths(CURRENT_PERIOD, -(MONTH_COUNT - 1))
/** Demo hujjatlar (invoys/hisob) faqat oxirgi ~12 oyda chiqarilgan — bu oyda aging bo'sh. */
const NO_DOCS_MONTH = addMonths(CURRENT_PERIOD, -18)

interface EdgeOpts { empty?: boolean; range?: RangeKey; asOf?: string; from?: string; comparison?: ComparisonKey; language?: Language }
interface EdgeResult { text: string; bad: string[]; real: unknown[] }

async function renderEdge(Page: ComponentType, path: string, opts: EdgeOpts): Promise<EdgeResult> {
  if (opts.empty) useDataStore.getState().clearAll()
  else useDataStore.getState().resetDemo()
  useUiStore.setState({ period: { asOf: opts.asOf ?? CURRENT_PERIOD, range: opts.range ?? '12m', from: opts.from, comparison: opts.comparison }, currency: 'UZS', theme: 'dark' })
  useLanguageStore.setState({ language: opts.language ?? 'uz' })
  const errors: unknown[] = []
  const origError = console.error
  console.error = (...args: unknown[]) => { errors.push(args); origError(...args) }
  let text = ''
  try {
    const utils = render(
      <TooltipProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes><Route path="*" element={<Page />} /></Routes>
        </MemoryRouter>
      </TooltipProvider>,
    )
    await act(async () => { await new Promise((r) => setTimeout(r, 450)) })
    text = utils.container.textContent ?? ''
  } finally {
    console.error = origError
  }
  const bad = BAD_TOKENS.filter((t) => text.includes(t))
  const real = errors.filter((e) => {
    const s = String((e as unknown[])[0])
    return !s.includes('act(') && !s.includes('width(0) and height(0)') && !s.includes('not wrapped in act')
  })
  return { text, bad, real }
}

function expectOk(res: EdgeResult, check: { mustInclude?: string; minLength?: number }) {
  if (res.bad.length) {
    const idx = res.text.indexOf(res.bad[0])
    throw new Error(`Buzuq qiymat topildi: ${res.bad.join(', ')} → "...${res.text.slice(Math.max(0, idx - 80), idx + 40)}..."`)
  }
  if (res.real.length) throw new Error(`console.error: ${String((res.real[0] as unknown[])[0]).slice(0, 400)}`)
  if (check.mustInclude) expect(res.text).toContain(check.mustInclude)
  if (check.minLength) expect(res.text.length).toBeGreaterThanOrEqual(check.minLength)
}

afterEach(() => {
  cleanup()
  useDataStore.getState().resetDemo()
  useLanguageStore.setState({ language: 'uz' })
})

describe("Davr rejimlari: QTD, barcha davr, ixtiyoriy, taqqoslash (o'tgan yil / o'chirilgan)", () => {
  const MODES: EdgeOpts[] = [
    { range: 'qtd' }, { range: 'all' }, { range: 'custom', from: addMonths(CURRENT_PERIOD, -4) },
    { range: '12m', comparison: 'year' }, { range: '3m', comparison: 'none' },
  ]
  for (const p of PAGES) {
    for (const mode of MODES) {
      it(`${p.name} · ${mode.range}${mode.comparison ? ` / ${mode.comparison}` : ''}`, async () => expectOk(await renderEdge(p.Page, p.path, mode), { minLength: 200 }))
    }
  }
})

describe('Tillar: rus va ingliz — runtime xatosiz, NaN/undefined yo\'q', () => {
  for (const p of PAGES) {
    for (const language of ['ru', 'en'] as const) {
      it(`${p.name} · ${language}`, async () => expectOk(await renderEdge(p.Page, p.path, { language }), { minLength: 200 }))
    }
  }
})

describe("Bo'sh ma'lumot (clearAll) → EmptyState, runtime xatosiz", () => {
  for (const p of PAGES) {
    it(p.name, async () => expectOk(await renderEdge(p.Page, p.path, { empty: true }), { mustInclude: "Demo ma'lumotni tiklash" }))
  }
})

describe("Bitta oy ('1m') — nolga bo'lish / oldingi davr", () => {
  for (const p of PAGES) {
    it(p.name, async () => expectOk(await renderEdge(p.Page, p.path, { range: '1m' }), { minLength: 200 }))
  }
})

describe(`Birinchi oy asOf (${FIRST_MONTH}) — oldingi davr / o'tgan yil / YTD bo'sh`, () => {
  for (const p of PAGES) {
    it(p.name, async () => expectOk(await renderEdge(p.Page, p.path, { range: '12m', asOf: FIRST_MONTH }), { minLength: 200 }))
  }
})

describe(`Hujjatsiz oy asOf (${NO_DOCS_MONTH}) — aging/DSO/DPO/taqvim nol`, () => {
  for (const p of PAGES.filter((x) => ['Balance', 'Cashflow'].includes(x.name))) {
    it(p.name, async () => expectOk(await renderEdge(p.Page, p.path, { range: '3m', asOf: NO_DOCS_MONTH }), { minLength: 200 }))
  }
})
