import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { useLanguageStore } from '@/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { useTheme, useSliceSync } from '@/hooks'

/** Karkas: chapda menyu, tepada shapka. Ma'lumot brauzerda (demo dataset) — server va kirish yo'q. */
export function AppShell() {
  useLanguageStore((state) => state.language)
  useTheme()
  useSliceSync()
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen bg-base">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <Header />
          <main className="flex-1 p-4 md:p-6 max-w-[1800px] w-full mx-auto">
            <Suspense fallback={<PageSkeleton />}><Outlet /></Suspense>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
