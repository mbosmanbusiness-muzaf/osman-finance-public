import { useLanguageStore } from "@/i18n"
import { Skeleton } from '@/components/ui/skeleton'

/** Sahifa o'tishidagi skeleton — layout pattern bilan bir xil (withHeader — lazy yuklanishda sarlavha bloki ham). */
export function PageSkeleton({ kpis = 6, withHeader = true }: { kpis?: number; withHeader?: boolean }) {
  useLanguageStore((state) => state.language)
  return (
    <div className="space-y-4 animate-in fade-in-0 duration-200">
      {(withHeader && <Skeleton className="h-[124px] w-full rounded-2xl" />)}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {(Array.from({ length: kpis }).map((_, i) => <Skeleton key={i} className="h-[132px]" />))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {(Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[330px]" />))}
      </div>
      <Skeleton className="h-[280px]" />
    </div>
  )
}
