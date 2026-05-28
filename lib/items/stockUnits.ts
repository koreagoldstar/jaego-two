import { labelIndexFromLotCode } from '@/lib/items/labelVariants'
import type { ItemStockLot } from '@/lib/supabase/types'

export type StockUnitOption = {
  lotId: string
  lotCode: string | null
  labelIndex: number
  quantity: number
  createdAt: string
}

/** 입고 단위 목록 → 출고 선택용 (번호 순 정렬) */
export function buildStockUnitOptions(lots: ItemStockLot[]): StockUnitOption[] {
  const rows: StockUnitOption[] = []
  for (const lot of lots) {
    const qty = Math.max(0, Math.floor(Number(lot.quantity) || 0))
    if (qty <= 0) continue
    const lotCode = (lot.lot_code ?? '').trim() || null
    rows.push({
      lotId: lot.id,
      lotCode,
      labelIndex: lotCode ? labelIndexFromLotCode(lotCode) : 1,
      quantity: qty,
      createdAt: lot.created_at,
    })
  }
  rows.sort(
    (a, b) =>
      a.labelIndex - b.labelIndex ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.lotId.localeCompare(b.lotId)
  )
  return rows
}

export function formatStockUnitLabel(unit: StockUnitOption): string {
  const code = unit.lotCode ? ` · ${unit.lotCode}` : ''
  const qtyNote = unit.quantity > 1 ? ` (수량 ${unit.quantity})` : ''
  return `#${unit.labelIndex}${code}${qtyNote}`
}
