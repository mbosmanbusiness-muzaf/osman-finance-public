import { translate as localize, useLanguageStore } from "@/i18n"
import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared'
import { useCurrency } from '@/hooks'
import type { InventoryProductRow } from '@/lib/finance'
import { fmtDays, fmtNum, fmtPct } from '@/lib/format'
import { cn, safeDiv } from '@/lib/utils'

/** Zaxira — mahsulotlar ro'yxati: qiymat, ulush, aylanish, harakatsizlik (90+ kun qizil). */
export function InventoryTable({ rows }: { rows: InventoryProductRow[] }) {
  useLanguageStore((state) => state.language)
  const { money } = useCurrency()
  const total = useMemo(() => rows.reduce((a, r) => a + r.value, 0), [rows])
  const idleCount = useMemo(() => rows.filter((r) => r.idleDays > 90).length, [rows])

  const columns = useMemo<ColumnDef<InventoryProductRow>[]>(() => {
    const right = { align: 'right' as const }
    return [
      { accessorKey: 'name', header: 'Mahsulot', cell: ({ row }) => <span className="font-sans text-txt-primary">{localize(row.original.name)}</span> },
      { accessorKey: 'category', header: 'Kategoriya', cell: ({ row }) => <span className="font-sans text-txt-secondary">{localize(row.original.category)}</span> },
      { accessorKey: 'qty', header: 'Miqdor', meta: right, cell: ({ row }) => fmtNum(row.original.qty) },
      { accessorKey: 'unitCost', header: 'Tannarx', meta: right, cell: ({ row }) => money(row.original.unitCost) },
      { accessorKey: 'value', header: 'Qiymat', meta: right, cell: ({ row }) => <span className="font-semibold text-txt-primary">{localize(money(row.original.value))}</span> },
      { id: 'share', accessorFn: (r) => safeDiv(r.value, total) * 100, header: 'Ulush %', meta: right, cell: ({ getValue }) => fmtPct(getValue<number>()) },
      { accessorKey: 'turnoverDays', header: 'Aylanish (kun)', meta: right, cell: ({ row }) => <span className={cn(row.original.turnoverDays > 90 && 'text-warning')}>{row.original.turnoverDays > 0 ? fmtDays(row.original.turnoverDays) : '—'}</span> },
      { accessorKey: 'idleDays', header: 'Harakatsiz (kun)', meta: right, cell: ({ row }) => <span className="inline-flex items-center gap-1.5 justify-end">{(row.original.idleDays > 90 && <Badge variant="negative">90+</Badge>)}<span className={cn(row.original.idleDays > 90 ? 'text-negative font-semibold' : row.original.idleDays > 30 ? 'text-warning' : '')}>{(Math.round(row.original.idleDays))}</span></span> },
    ]
  }, [money, total])

  const exportRow = (r: InventoryProductRow) => ({
    Mahsulot: r.name, Kategoriya: r.category, Miqdor: r.qty, Tannarx: r.unitCost, Qiymat: r.value,
    'Ulush %': Number((safeDiv(r.value, total) * 100).toFixed(1)), 'Aylanish (kun)': Math.round(r.turnoverDays), 'Harakatsiz (kun)': r.idleDays,
  })

  return (
    <DataTable columns={columns} data={rows} searchable searchPlaceholder={localize("Mahsulot qidirish…")} dense pageSize={20} exportName="Zaxira" exportRow={exportRow}
      initialSorting={[{ id: 'value', desc: true }]} rowClassName={(r) => (r.idleDays > 90 ? 'bg-negative/10' : '')}
      toolbar={<div className="flex items-baseline gap-2"><h3 className="section-title">{localize("Zaxira — mahsulotlar")}</h3><span className="text-xs text-txt-muted num">{(rows.length)}{localize(" ta · harakatsiz 90+:")} {(idleCount)}{localize(" ta")}</span></div>} />
  )
}
