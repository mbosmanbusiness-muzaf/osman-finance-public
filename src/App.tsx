import { lazy, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useLanguageStore } from '@/i18n'
import { AppShell } from '@/components/layout/AppShell'
import { ROUTES } from '@/lib/routes'

const PnL = lazy(() => import('@/pages/PnL'))
const PnLDetail = lazy(() => import('@/pages/PnLDetail'))
const Bep = lazy(() => import('@/pages/Bep'))
const Cashflow = lazy(() => import('@/pages/Cashflow'))
const Balance = lazy(() => import('@/pages/Balance'))
const Budgeting = lazy(() => import('@/pages/Budgeting'))

/** Kirishsiz ochiq ilova: barcha marshrutlar — moliya bo'limi, boshqa manzillar P&L'ga yo'naltiriladi. */
export function AppRoutes() {
  const language = useLanguageStore((state) => state.language)
  useEffect(() => { document.documentElement.lang = language }, [language])
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to={ROUTES.pnl} replace />} />
        <Route path="finance">
          <Route index element={<Navigate to={ROUTES.pnl} replace />} />
          <Route path="pnl" element={<PnL />} />
          <Route path="pnl/detail" element={<PnLDetail />} />
          <Route path="pnl/bep" element={<Bep />} />
          <Route path="cashflow" element={<Cashflow />} />
          <Route path="balance" element={<Balance />} />
          <Route path="budget" element={<Budgeting />} />
        </Route>
        <Route path="*" element={<Navigate to={ROUTES.pnl} replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRoutes />
    </BrowserRouter>
  )
}
