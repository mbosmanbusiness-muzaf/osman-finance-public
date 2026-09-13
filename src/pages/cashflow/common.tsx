import { translate as localize, useLanguageStore } from "@/i18n"
import { cn } from '@/lib/utils'
import type { Granularity } from '@/lib/finance'

/** Bo'sh kesim uchun qisqa izoh (bo'sh grafik o'rniga). */
export function EmptyNote({ text = "Ma'lumot yo'q", className }: { text?: string; className?: string }) {
  useLanguageStore((state) => state.language)
  return <div className={cn('h-full w-full flex items-center justify-center text-sm text-txt-muted', className)}>{localize(text)}</div>
}

const OPTIONS: { key: Granularity; label: string }[] = [
  { key: 'day', label: 'Kunlik' },
  { key: 'week', label: 'Haftalik' },
  { key: 'month', label: 'Oylik' },
]

/** Kunlik | Haftalik | Oylik segment filtri (FilterBar valyuta tugmasi uslubida). */
export function GranularityToggle({ value, onChange }: { value: Granularity; onChange: (g: Granularity) => void }) {
  useLanguageStore((state) => state.language)
  return (
    <div className="segmented" role="group" aria-label={localize("Kesim")}>
      {(OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className={cn('segmented-item', value === o.key && 'segmented-item-active')}
        >
          {localize(o.label)}
        </button>
      )))}
    </div>
  )
}

/** To'g'ri usul moddalarining o'zbekcha nomlari (dialog va eksport). */
export const CF_ITEM_LABELS = {
  receiptsFromCustomers: 'Mijozlardan tushum',
  otherOperatingReceipts: 'Boshqa operatsion tushumlar',
  paidToSuppliers: "Yetkazib beruvchilarga to'lovlar",
  salariesPaid: "Ish haqi to'lovlari",
  opexPaid: "Operatsion xarajatlar to'lovi",
  taxesPaid: "Soliq to'lovlari",
  interestPaid: "Foiz to'lovlari",
  capex: 'Kapital xarajatlar (CapEx)',
  assetSales: 'Aktivlar sotuvi',
  loansReceived: 'Olingan kreditlar',
  loansRepaid: 'Qaytarilgan kreditlar',
  dividendsPaid: "To'langan dividendlar",
} as const

export type CfItemKey = keyof typeof CF_ITEM_LABELS
