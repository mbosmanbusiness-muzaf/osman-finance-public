import { fmtNum } from '@/lib/format'
import { translate as localize, useLanguageStore } from "@/i18n"
import { Children, cloneElement, isValidElement, useMemo, useState, type ReactNode } from 'react'
import {
  flexRender, getCoreRowModel, getExpandedRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type ExpandedState, type SortingState, type VisibilityState, type Row,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, FileSpreadsheet, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { exportToCsv, exportToXlsx } from '@/lib/export'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    align?: 'left' | 'right' | 'center'
    className?: string
    /** eksportda ustun nomi */
    exportLabel?: string
  }
}

export interface DataTableProps<T> {
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  columns: ColumnDef<T, any>[] // eslint-disable-line @typescript-eslint/no-explicit-any
  data: T[]
  /** undefined → sahifalash yo'q */
  pageSize?: number
  enableColumnVisibility?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  onRowClick?: (row: T) => void
  rowClassName?: (row: T) => string
  getSubRows?: (row: T) => T[] | undefined
  initialExpanded?: ExpandedState
  /** tashqaridan boshqariladigan expand holati ("Hammasini ochish" jadvalni qayta yaratmasdan) */
  expanded?: ExpandedState
  onExpandedChange?: (e: ExpandedState) => void
  initialSorting?: SortingState
  /** eksport tugmasi (nomi) */
  exportName?: string
  exportRow?: (row: T) => Record<string, unknown>
  toolbar?: ReactNode
  emptyText?: string
  dense?: boolean
  maxHeight?: number
  footer?: ReactNode
  className?: string
  getRowId?: (row: T, index: number) => string
}

/** Keep caller-supplied totals aligned when columns are hidden (including colspan cells). */
export function visibleFooter(node: ReactNode, visible: boolean[]): ReactNode {
  return Children.map(node, (child) => {
    if (!isValidElement<{ children?: ReactNode; colSpan?: number }>(child)) return child
    if (child.type !== 'tr') return child.props.children ? cloneElement(child, {}, visibleFooter(child.props.children, visible)) : child
    let index = 0
    const cells = Children.map(child.props.children, (cell) => {
      if (!isValidElement<{ colSpan?: number }>(cell)) return cell
      const span = cell.props.colSpan ?? 1
      const count = visible.slice(index, index + span).filter(Boolean).length
      index += span
      return count ? cloneElement(cell, { colSpan: count }) : null
    })
    return cloneElement(child, {}, cells)
  })
}

/** TanStack Table v8 asosidagi umumiy jadval: saralash, sahifalash, ustun tanlash, eksport, expand, qator bosish. */
export function DataTable<T>({
  columns, data, loading = false, error, onRetry, pageSize: requestedPageSize, enableColumnVisibility = true, searchable = false, searchPlaceholder = 'Qidirish…', onRowClick, rowClassName, getSubRows,
  initialExpanded, expanded: expandedProp, onExpandedChange, initialSorting = [], exportName, exportRow, toolbar, emptyText = 'Tanlangan davr va filtrlar uchun qatorlar yo‘q.', dense = false, maxHeight, footer, className, getRowId,
}: DataTableProps<T>) {
  useLanguageStore((state) => state.language)
  const pageSize = requestedPageSize ?? (data.length > 500 ? 50 : undefined)
  const [compact, setCompact] = useState(dense)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(false)
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [innerExpanded, setInnerExpanded] = useState<ExpandedState>(initialExpanded ?? {})
  const expanded = expandedProp ?? innerExpanded
  const [globalFilter, setGlobalFilter] = useState('')

  const table = useReactTable({
    data, columns,
    state: { sorting, columnVisibility, expanded, globalFilter },
    onSortingChange: setSorting, onColumnVisibilityChange: setColumnVisibility, onGlobalFilterChange: setGlobalFilter,
    onExpandedChange: (u) => { const next = typeof u === 'function' ? u(expanded) : u; if (onExpandedChange) onExpandedChange(next); else setInnerExpanded(next) },
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(), getSubRows, getRowId,
    ...(pageSize ? { getPaginationRowModel: getPaginationRowModel(), initialState: { pagination: { pageSize } } } : {}),
    globalFilterFn: 'includesString',
  })

  const rows = table.getRowModel().rows
  const showToolbar = true
  const exportAll = useMemo(() => async (format: 'xlsx' | 'csv') => {
    const flat: Row<T>[] = table.getPrePaginationRowModel().flatRows
    const out = flat.map((r) => {
      if (exportRow) return exportRow(r.original)
      const o: Record<string, unknown> = {}
      for (const cell of r.getVisibleCells()) {
        const h = cell.column.columnDef.header
        const label = cell.column.columnDef.meta?.exportLabel ?? (typeof h === 'string' ? h : cell.column.id)
        o[label] = cell.getValue()
      }
      return o
    })
    setExporting(true); setExportError(false)
    try { if (format === 'xlsx') await exportToXlsx(out, exportName ?? 'jadval'); else exportToCsv(out, exportName ?? 'jadval') } catch { setExportError(true) } finally { setExporting(false) }
  }, [table, exportRow, exportName])

  return (
    <div className={cn('flex flex-col gap-2 min-w-0', className)}>
      {(showToolbar && (
        <div data-no-print className="flex flex-wrap items-center gap-2">
          {(searchable && (
            <div className="relative">
              <Search className="absolute left-3 top-2 h-4 w-4 text-txt-muted" />
              <Input aria-label={localize(searchPlaceholder)} value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder={localize(searchPlaceholder)} className="pl-9 h-8 w-56 rounded-full font-sans" />
            </div>
          ))}
          {localize(toolbar)}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" aria-pressed={compact} onClick={() => setCompact((v) => !v)}>{localize(compact ? 'Ixcham' : 'Oddiy zichlik')}</Button>
            {(enableColumnVisibility && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Columns3 />{localize(" Ustunlar")}</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-80 overflow-auto">
                  <DropdownMenuLabel>{localize("Ko'rinadigan ustunlar")}</DropdownMenuLabel>
                  {(table.getAllLeafColumns().filter((c) => c.getCanHide()).map((c) => (
                    <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} disabled={c.getIsVisible() && table.getVisibleLeafColumns().length === 1} onCheckedChange={(v) => c.toggleVisibility(!!v)} onSelect={(e) => e.preventDefault()}>
                      {localize(typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id)}
                    </DropdownMenuCheckboxItem>
                  )))}
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
            {exportName && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={exporting}><FileSpreadsheet />{localize(exporting ? 'Eksport qilinmoqda…' : 'Eksport')}</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => { void exportAll('xlsx') }}>Excel</DropdownMenuItem><DropdownMenuItem onSelect={() => { void exportAll('csv') }}>CSV</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
          </div>
        </div>
      ))}
      {exportError && <p role="alert" className="text-xs text-negative">{localize('Eksport bajarilmadi. Qayta urinib ko‘ring.')}</p>}
      {error && <div role="alert" className="rounded-xl border border-border p-6 text-center"><p>{localize(error)}</p>{onRetry && <Button variant="outline" onClick={onRetry}>{localize('Qayta urinish')}</Button>}</div>}
      <div className="table-scroll rounded-xl border border-border overflow-auto" style={{ maxHeight: maxHeight ?? 560 }} aria-busy={loading} hidden={!!error}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-elevated/95 backdrop-blur">
            {(table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border">
                {(hg.headers.map((h) => {
                  const align = h.column.columnDef.meta?.align ?? (typeof table.getCoreRowModel().flatRows[0]?.getValue(h.column.id) === 'number' ? 'right' : 'left')
                  const canSort = h.column.getCanSort()
                  const dir = h.column.getIsSorted()
                  return (
                    <th
                      key={h.id}
                      className={cn('table-head px-3 h-9 whitespace-nowrap select-none', align === 'right' && 'text-right', align === 'center' && 'text-center', canSort && 'cursor-pointer hover:text-txt-primary', h.column.columnDef.meta?.className)}
                      aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}
                      style={{ width: h.getSize() !== 150 ? h.getSize() : undefined }}
                    >
                      <button type="button" disabled={!canSort} onClick={h.column.getToggleSortingHandler()} className={cn('inline-flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-gold', align === 'right' && 'flex-row-reverse')}>
                        {localize(h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext()))}
                        {(canSort && (dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : dir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />))}
                      </button>
                    </th>
                  )
                }))}
              </tr>
            )))}
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }, (_, index) => <tr key={'loading-' + index}><td colSpan={table.getVisibleLeafColumns().length} className="p-3"><div className="h-5 animate-pulse rounded bg-elevated" /></td></tr>)}
            {(!loading && rows.length === 0 && (
              <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-txt-muted">{localize(globalFilter ? 'Qidiruvga mos qatorlar yo‘q. Qidiruvni tozalang.' : emptyText)}</td></tr>
            ))}
            {(!loading && rows.map((row) => (
              <tr
                key={row.id}
                className={cn('border-b border-border/60 last:border-0 transition-colors', onRowClick && 'cursor-pointer', 'hover:bg-elevated/50', rowClassName?.(row.original))}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onRowClick(row.original) } } : undefined}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {(row.getVisibleCells().map((cell) => {
                  const align = cell.column.columnDef.meta?.align ?? (typeof cell.getValue() === 'number' ? 'right' : 'left')
                  return (
                    <td key={cell.id} className={cn('px-3 num tabular-nums whitespace-nowrap', compact ? 'py-1' : 'py-2', align === 'right' && 'text-right', align === 'center' && 'text-center', cell.column.columnDef.meta?.className)}>
                      {localize(flexRender(cell.column.columnDef.cell, cell.getContext()))}
                    </td>
                  )
                }))}
              </tr>
            )))}
          </tbody>
          {localize(footer && <tfoot className="bg-elevated/60 font-medium border-t border-border">{visibleFooter(footer, table.getAllLeafColumns().map((c) => c.getIsVisible()))}</tfoot>)}
        </table>
      </div>
      {!!pageSize && !error && !loading && <div data-no-print className="flex flex-wrap items-center justify-between gap-2 text-xs text-txt-muted">
        {/* sahifa hajmi: brauzerning o'z ro'yxati o'rniga umumiy Select — ro'yxat doim tugma tagida ochiladi */}
        <span className="flex items-center gap-2">{localize('Sahifadagi qatorlar')}
          <Select value={String(table.getState().pagination.pageSize)} onValueChange={(value) => table.setPageSize(Number(value))}>
            <SelectTrigger aria-label={localize('Sahifadagi qatorlar')} title={localize('Sahifadagi qatorlar')} className="h-8 w-auto gap-1.5 px-2.5 text-xs num"><SelectValue /></SelectTrigger>
            <SelectContent align="start">
              {[...new Set([10, 25, 50, 100, pageSize])].sort((a, b) => a - b).map((size) => <SelectItem key={size} value={String(size)} className="text-xs num">{fmtNum(size)}</SelectItem>)}
            </SelectContent>
          </Select>
        </span>
        <span>{fmtNum(table.getPrePaginationRowModel().rows.length)} {localize('qator')}</span>
        <div className="flex items-center gap-1"><Button variant="ghost" size="icon" aria-label={localize('Oldingi sahifa')} title={localize('Oldingi sahifa')} onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><ChevronLeft /></Button><span>{fmtNum(table.getState().pagination.pageIndex + 1)} / {fmtNum(Math.max(1, table.getPageCount()))}</span><Button variant="ghost" size="icon" aria-label={localize('Keyingi sahifa')} title={localize('Keyingi sahifa')} onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}><ChevronRight /></Button></div>
      </div>}
    </div>
  )
}
