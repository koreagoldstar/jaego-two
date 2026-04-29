import type { Item } from '@/lib/supabase/types'
import { withUnitSuffix } from '@/lib/items/lotCodes'

export type ItemLabelVariant = {
  index: number
  barcode: string | null
  payload: string | null
}

export function buildItemLabelVariants(item: Item, separator: string): ItemLabelVariant[] {
  const qty = Math.max(0, Number(item.quantity) || 0)
  if (qty <= 0) return []
  void separator

  const baseBarcode = item.barcode_code?.trim() ?? ''
  const rows: ItemLabelVariant[] = []

  for (let i = 1; i <= qty; i++) {
    const barcode = withUnitSuffix(baseBarcode, i, qty) || null
    const payload = barcode

    rows.push({
      index: i,
      barcode,
      payload,
    })
  }

  return rows
}
