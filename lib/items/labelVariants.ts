import type { Item } from '@/lib/supabase/types'

export type ItemLabelVariant = {
  index: number
  barcode: string | null
  serial: string | null
  payload: string | null
}

function withUnitSuffix(base: string, index: number, total: number) {
  if (!base) return ''
  if (total <= 1) return base
  return `${base}-${String(index).padStart(3, '0')}`
}

export function buildItemLabelVariants(item: Item, separator: string): ItemLabelVariant[] {
  const qty = Math.max(0, Number(item.quantity) || 0)
  if (qty <= 0) return []

  const sep = separator || '|'
  const baseBarcode = item.barcode_code?.trim() ?? ''
  const baseSerial = item.serial_number?.trim() ?? ''
  const baseSh = item.sh?.trim() ?? ''
  const rows: ItemLabelVariant[] = []

  for (let i = 1; i <= qty; i++) {
    const barcode = withUnitSuffix(baseBarcode, i, qty) || null
    const serial = withUnitSuffix(baseSerial, i, qty) || null
    const sh = withUnitSuffix(baseSh, i, qty)

    const payload =
      barcode ||
      (sh && serial ? `${sh}${sep}${serial}` : null) ||
      sh ||
      serial ||
      null

    rows.push({
      index: i,
      barcode,
      serial,
      payload,
    })
  }

  return rows
}
