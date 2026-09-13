import { act, render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ComponentType } from 'react'
import { useDataStore } from '@/store/useDataStore'
import { useUiStore } from '@/store/useUiStore'
import { CURRENT_PERIOD } from '@/data/seed'
import { TooltipProvider } from '@/components/ui/tooltip'

export const BAD_TOKENS = ['NaN', 'Infinity', 'undefined', '[object Object]']

/**
 * Sahifani demo ma'lumot bilan render qiladi (skeleton 300ms o'tgach) va
 * matnda NaN/Infinity/undefined bo'lmasligini tekshiradi. Runtime xato → test yiqiladi.
 */
export async function renderPage(Page: ComponentType, path = '/', opts: { range?: '1m' | '3m' | '6m' | '12m' | 'ytd' | '24m'; currency?: 'UZS' | 'USD'; theme?: 'dark' | 'light' } = {}) {
  useDataStore.getState().resetDemo()
  useUiStore.setState({ period: { asOf: CURRENT_PERIOD, range: opts.range ?? '12m' }, currency: opts.currency ?? 'UZS', theme: opts.theme ?? 'dark' })
  const errors: unknown[] = []
  const origError = console.error
  console.error = (...args: unknown[]) => { errors.push(args); origError(...args) }
  const utils = render(
    <TooltipProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="*" element={<Page />} /></Routes>
      </MemoryRouter>
    </TooltipProvider>,
  )
  await act(async () => { await new Promise((r) => setTimeout(r, 450)) })
  console.error = origError
  const text = utils.container.textContent ?? ''
  const bad = BAD_TOKENS.filter((t) => text.includes(t))
  return { ...utils, text, bad, errors }
}

export function expectClean(res: { text: string; bad: string[]; errors: unknown[] }, minLength = 200) {
  if (res.bad.length) {
    const idx = res.text.indexOf(res.bad[0])
    throw new Error(`Buzuq qiymat topildi: ${res.bad.join(', ')} → "...${res.text.slice(Math.max(0, idx - 80), idx + 40)}..."`)
  }
  const real = res.errors.filter((e) => !String((e as unknown[])[0]).includes('act(') && !String((e as unknown[])[0]).includes('width(0) and height(0)') && !String((e as unknown[])[0]).includes('not wrapped in act'))
  if (real.length) throw new Error(`console.error: ${String((real[0] as unknown[])[0]).slice(0, 400)}`)
  if (res.text.length < minLength) throw new Error(`Sahifa juda bo'sh (matn ${res.text.length} belgi) — ma'lumot render bo'lmagan`)
}
