import { translate as localize, useLanguageStore } from "@/i18n"
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

type Tone = 'good' | 'warn' | 'bad'

export interface TrafficCell { metric: string; value: string; status: Tone; route: string; note?: string }
export interface TrafficRow { dept: string; owner: string; cells: TrafficCell[] }

const DOT: Record<Tone, string> = { good: 'bg-positive', warn: 'bg-warning', bad: 'bg-negative' }
const CELL: Record<Tone, string> = { good: 'border-positive/30 bg-positive/10', warn: 'border-warning/30 bg-warning/10', bad: 'border-negative/30 bg-negative/10' }

/** Bo'limlar svetofori: bo'lim × asosiy ko'rsatkichlar; katak rangi — holat, bosilsa bo'lim sahifasi ochiladi. */
export function DeptTrafficLight({ rows }: { rows: TrafficRow[] }) {
  useLanguageStore((state) => state.language)
  const nav = useNavigate()
  const cols = Math.max(1, ...rows.map((r) => r.cells.length))
  return (
    <div className="space-y-2">
      {(rows.map((r) => {
        const worst: Tone = r.cells.some((c) => c.status === 'bad') ? 'bad' : r.cells.some((c) => c.status === 'warn') ? 'warn' : 'good'
        return (
          <div key={r.dept} className="grid grid-cols-1 sm:grid-cols-[minmax(140px,180px)_1fr] gap-2">
            <div className="flex items-center gap-2.5 min-w-0 rounded-xl bg-elevated px-3 py-2">
              <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', DOT[worst])} />
              <div className="min-w-0 leading-tight">
                <div className="text-sm font-medium text-txt-primary truncate">{localize(r.dept)}</div>
                <div className="text-[11px] text-txt-muted truncate">{localize(r.owner)}</div>
              </div>
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {(r.cells.map((c) => (
                <button key={c.metric} type="button" onClick={() => nav(c.route)} title={localize(c.note)}
                  className={cn('min-w-0 rounded-xl border px-3 py-2 text-left transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-gold/30', CELL[c.status])}>
                  <div className="text-[11px] text-txt-secondary truncate">{localize(c.metric)}</div>
                  <div className="num text-sm font-semibold text-txt-primary truncate">{localize(c.value)}</div>
                </button>
              )))}
            </div>
          </div>
        )
      }))}
    </div>
  )
}
