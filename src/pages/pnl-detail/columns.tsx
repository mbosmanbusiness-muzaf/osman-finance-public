import { translate as localize, useLanguageStore } from "@/i18n"
import type { ColumnDef, Row } from '@tanstack/react-table'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn, fin, round } from '@/lib/utils'
import { fmtPct, toCurrency, type Currency } from '@/lib/format'
import { PNL_GROUP_LABELS } from '@/types'
import type { PnLNode } from '@/lib/finance'

const DASH = '—'

/** Daraja nomlari (eksport va modal izohi uchun). */
export const KIND_LABELS: Record<PnLNode['kind'], string> = {
  group: 'Guruh',
  item: 'Modda',
  element: 'Element',
  subtotal: 'Oraliq natija',
}

/** Qator uslubi: subtotal — qalin + yuqori chiziq, guruh — o'rtacha, element — ikkilamchi rang. */
export function pnlRowClassName(n: PnLNode): string {
  switch (n.kind) {
    case 'subtotal':
      return 'font-semibold border-t border-border bg-elevated/40'
    case 'group':
      return 'font-medium'
    case 'element':
      return 'text-txt-secondary'
    default:
      return ''
  }
}

/** Modal izohi: guruh nomi + daraja. */
export function nodeSubtitle(n: PnLNode): string {
  const grp = n.group ? PNL_GROUP_LABELS[n.group] : 'Hisobot natijasi'
  return `${grp} · ${KIND_LABELS[n.kind]} · oylik fakt (ustun) va plan (chiziq)`
}

/** Modda ustuni: daraja bo'yicha chekinish + ochish/yopish tugmasi (qator bosilishini to'xtatadi). */
export function ModdaCell({ row }: { row: Row<PnLNode> }) {
  useLanguageStore((state) => state.language)
  const n = row.original
  const canExpand = row.getCanExpand()
  const expanded = row.getIsExpanded()
  const toggle = row.getToggleExpandedHandler()
  return (
    <div className="flex items-center gap-1 font-sans" style={{ paddingLeft: row.depth * 18 }}>
      {(canExpand ? (
        <button
          type="button"
          aria-label={localize(`${n.label}: ${expanded ? 'yopish' : 'ochish'}`)}
          aria-expanded={expanded}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-txt-muted hover:bg-elevated hover:text-txt-primary"
          onClick={(e) => {
            e.stopPropagation()
            toggle()
          }}
        >
          {(expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />)}
        </button>
      ) : (
        <span className="inline-block w-5 shrink-0" aria-hidden />
      ))}
      <span className={cn('truncate', n.kind === 'subtotal' && 'text-txt-primary')} title={localize(n.label)}>
        {localize(n.label)}
      </span>
      {(canExpand && n.children && (
        <span className="ml-1 text-[11px] text-txt-muted num" aria-hidden>
          ({(n.children.length)})
        </span>
      ))}
    </div>
  )
}

function varianceTone(n: PnLNode): string {
  if (Math.abs(fin(n.variance)) < 1) return 'text-txt-secondary'
  return n.favorable ? 'text-positive' : 'text-negative'
}

/** Var % katakcha: plan 0 bo'lsa — "—"; |Var %| ≥ 10% qalin. */
function variancePctText(n: PnLNode): string {
  const plan = fin(n.plan)
  if (plan === 0) return fin(n.fact) === 0 ? fmtPct(0) : DASH
  return fmtPct(n.variancePct, 1, true)
}

export interface PnLColumnOpts {
  money: (v: number, o?: { sign?: boolean }) => string
  moneyFull: (v: number) => string
  /** oldingi davr mavjud (24 oy diapazonida yo'q) */
  hasPrev: boolean
  /** o'tgan yil oynasi mavjud */
  hasPrevYear: boolean
}

export const BIG_VARIANCE_PCT = 10

/** Batafsil P&L jadval ustunlari. Saralash o'chirilgan — hisobot tartibi saqlanadi. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildPnLColumns(o: PnLColumnOpts): ColumnDef<PnLNode, any>[] {
  const right = { align: 'right' as const }
  const moneyCell = (v: number) => <span title={localize(o.moneyFull(fin(v)))}>{localize(o.money(fin(v)))}</span>
  return [
    {
      id: 'label',
      header: 'Modda',
      accessorFn: (n) => n.label,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => <ModdaCell row={row} />,
      meta: { className: 'min-w-[260px]' },
    },
    {
      id: 'fact',
      header: 'Fakt',
      accessorFn: (n) => n.fact,
      enableSorting: false,
      meta: right,
      cell: ({ row }) => <span className="text-txt-primary">{(moneyCell(row.original.fact))}</span>,
    },
    {
      id: 'plan',
      header: 'Plan',
      accessorFn: (n) => n.plan,
      enableSorting: false,
      meta: right,
      cell: ({ row }) => moneyCell(row.original.plan),
    },
    {
      id: 'variance',
      header: 'Variance',
      accessorFn: (n) => n.variance,
      enableSorting: false,
      meta: right,
      cell: ({ row }) => {
        const n = row.original
        return (
          <span className={varianceTone(n)} title={localize(o.moneyFull(fin(n.variance)))}>
            {localize(o.money(fin(n.variance), { sign: true }))}
          </span>
        )
      },
    },
    {
      id: 'variancePct',
      header: 'Var %',
      accessorFn: (n) => n.variancePct,
      enableSorting: false,
      meta: right,
      cell: ({ row }) => {
        const n = row.original
        const big = fin(n.plan) !== 0 && Math.abs(fin(n.variancePct)) >= BIG_VARIANCE_PCT
        return <span className={cn(varianceTone(n), big && 'font-semibold')}>{localize(variancePctText(n))}</span>
      },
    },
    {
      id: 'prev',
      header: "O'tgan davr",
      accessorFn: (n) => n.prev,
      enableSorting: false,
      meta: right,
      cell: ({ row }) => (o.hasPrev ? moneyCell(row.original.prev) : <span className="text-txt-muted">{localize(DASH)}</span>),
    },
    {
      id: 'prevYear',
      header: "O'tgan yil",
      accessorFn: (n) => n.prevYear,
      enableSorting: false,
      meta: right,
      cell: ({ row }) => (o.hasPrevYear ? moneyCell(row.original.prevYear) : <span className="text-txt-muted">{localize(DASH)}</span>),
    },
    {
      id: 'ytd',
      header: 'YTD',
      accessorFn: (n) => n.ytd,
      enableSorting: false,
      meta: right,
      cell: ({ row }) => moneyCell(row.original.ytd),
    },
    {
      id: 'pctOfRevenue',
      header: 'Tushumga %',
      accessorFn: (n) => n.pctOfRevenue,
      enableSorting: false,
      meta: right,
      cell: ({ row }) => <span className="text-txt-secondary">{localize(fmtPct(row.original.pctOfRevenue))}</span>,
    },
  ]
}

/** Excel eksport: o'zbekcha sarlavhalar, daraja prefiksi, joriy valyutada butun sonlar. */
export function makePnLExportRow(currency: Currency, hasPrev: boolean, hasPrevYear: boolean) {
  const m = (v: number) => Math.round(toCurrency(fin(v), currency))
  const cur = ` (${currency})`
  const prefix = (level: number) => (level === 0 ? '' : level === 1 ? '  › ' : '      » ')
  return (n: PnLNode): Record<string, unknown> => ({
    Daraja: KIND_LABELS[n.kind],
    Modda: `${prefix(n.level)}${n.label}`,
    [`Fakt${cur}`]: m(n.fact),
    [`Plan${cur}`]: m(n.plan),
    [`Variance${cur}`]: m(n.variance),
    'Var %': fin(n.plan) === 0 ? null : round(n.variancePct, 1),
    [`O'tgan davr${cur}`]: hasPrev ? m(n.prev) : null,
    [`O'tgan yil${cur}`]: hasPrevYear ? m(n.prevYear) : null,
    [`YTD${cur}`]: m(n.ytd),
    'Tushumga %': round(n.pctOfRevenue, 1),
  })
}
