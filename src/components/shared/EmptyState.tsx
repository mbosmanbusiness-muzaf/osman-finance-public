import { translate as localize, useLanguageStore } from "@/i18n"
import { Database, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDataStore } from '@/store/useDataStore'

/** Ma'lumot bo'sh bo'lganda — bir bosishda demo ma'lumotni tiklash. */
export function EmptyState({ title = "Ma'lumot yo'q", text = "Demo ma'lumotni tiklang." }: { title?: string; text?: string }) {
  useLanguageStore((state) => state.language)
  const resetDemo = useDataStore((s) => s.resetDemo)
  return (
    <div className="card-surface p-10 flex flex-col items-center text-center gap-3">
      <div className="h-12 w-12 rounded-full bg-gold/10 flex items-center justify-center">
        <Database className="h-6 w-6 text-gold-bright" />
      </div>
      <h3 className="section-title">{localize(title)}</h3>
      <p className="text-sm text-txt-muted max-w-md">{localize(text)}</p>
      <Button onClick={resetDemo}><RotateCcw />{localize(" Demo ma'lumotni tiklash")}</Button>
    </div>
  )
}
