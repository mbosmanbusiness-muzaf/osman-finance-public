import { downloadBlob } from './utils'

/** Ob'ektlar ro'yxatini XLSX sifatida yuklab beradi. */
export async function exportToXlsx(rows: Record<string, unknown>[], filename: string, sheetName = 'Sheet1') {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '(bo\'sh)': '' }])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

export function exportToCsv(rows: Record<string, unknown>[], filename: string) {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  const escape = (value: unknown) => {
    const text = String(value ?? '')
    // Neutralize spreadsheet formulas in text cells while keeping numeric values numeric.
    const safe = typeof value === 'string' && /^[=+@\-\t\r]/.test(text) ? "'" + text : text
    return '"' + safe.replace(/"/g, '""') + '"'
  }
  const csv = [headers.map(escape).join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))].join('\r\n')
  downloadBlob(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }), filename.endsWith('.csv') ? filename : `${filename}.csv`)
}

/** Fayl (xlsx/csv) → qatorlar (ob'ektlar), birinchi varaq. */
export async function parseSpreadsheet(file: File): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return { headers: [], rows: [] }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: true })
  const headers = rows.length ? Object.keys(rows[0]) : (XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })[0] as string[] | undefined) ?? []
  return { headers, rows }
}

/** Clipboard'dan (Excel) kelgan TSV matnni 2D massivga aylantiradi. */
export function parseClipboardGrid(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  if (lines.length && lines[lines.length - 1] === '') lines.pop()
  return lines.map((l) => l.split('\t'))
}
