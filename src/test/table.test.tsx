import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DataTable } from '@/components/shared/DataTable'
import { useLanguageStore } from '@/i18n'
const columns = [{ accessorKey: 'name', header: 'Name' }, { accessorKey: 'amount', header: 'Amount' }]
const data = Array.from({ length: 620 }, (_, i) => ({ name: 'Row ' + i, amount: 620 - i }))
beforeEach(() => useLanguageStore.getState().setLanguage('en'))
afterEach(cleanup)
it('bounds rendered rows and supports page size and numeric keyboard sorting', () => {
  render(<DataTable columns={columns} data={data} />)
  expect(screen.getAllByRole('row')).toHaveLength(51)
  // Radix Select: ro'yxat klaviatura bilan ochiladi va tanlanadi — tugmaga `change` yuborish hech nima qilmaydi
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Rows per page' }), { key: 'ArrowDown' })
  fireEvent.keyDown(screen.getByRole('option', { name: '25' }), { key: 'Enter' })
  expect(screen.getAllByRole('row')).toHaveLength(26)
  fireEvent.click(screen.getByRole('button', { name: 'Amount' }))
  expect(screen.getByRole('columnheader', { name: 'Amount' })).toHaveAttribute('aria-sort', 'descending')
  fireEvent.click(screen.getByRole('button', { name: 'Amount' }))
  expect(within(screen.getAllByRole('row')[1]).getByText('1')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  expect(within(screen.getAllByRole('row')[1]).getByText('26')).toBeInTheDocument()
})
it('loading, empty search and retry states are distinct', () => {
  const retry = vi.fn()
  const { rerender } = render(<DataTable columns={columns} data={[]} loading />)
  expect(document.querySelector('[aria-busy=true]')).toBeInTheDocument()
  rerender(<DataTable columns={columns} data={[]} error="Failed" onRetry={retry} />)
  fireEvent.click(screen.getByRole('button', { name: 'Retry' })); expect(retry).toHaveBeenCalledOnce()
  rerender(<DataTable columns={columns} data={data.slice(0, 2)} searchable />)
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'missing' } })
  expect(screen.getByText('No matching rows. Clear the search.')).toBeInTheDocument()
})
it('keeps totals aligned when columns are hidden', async () => {
  const { visibleFooter } = await import('@/components/shared/DataTable')
  render(<table><tfoot>{visibleFooter(<tr><td colSpan={2}>Total</td><td>42</td><td>70</td></tr>, [true, false, false, true])}</tfoot></table>)
  expect(screen.getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Total','70'])
  expect(screen.getAllByRole('cell')[0]).toHaveAttribute('colspan','1')
})
