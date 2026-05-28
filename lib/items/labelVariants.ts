import type { Item } from '@/lib/supabase/types'
import { allocateNextUnitLotCodes } from '@/lib/items/lotCodes'

export type ItemLabelVariant = {
  index: number
  barcode: string | null
  payload: string | null
}

export type StockLotForLabel = {
  lot_code: string | null
  quantity: number
}

/** DB lot_code 기준(실물 1개 = QR 1개). 없으면 수량·기본코드로 폴백 */
export function buildItemLabelVariantsFromLots(
  item: Item,
  lots: StockLotForLabel[],
): ItemLabelVariant[] {
  const rows: ItemLabelVariant[] = []
  let index = 0

  for (const lot of lots) {
    const code = (lot.lot_code ?? '').trim()
    const qty = Math.max(0, Number(lot.quantity) || 0)
    if (!code || qty <= 0) continue
    for (let u = 0; u < qty; u++) {
      index += 1
      rows.push({ index, barcode: code, payload: code })
    }
  }

  if (rows.length > 0) return rows
  return buildItemLabelVariants(item)
}

/** lot 테이블 없을 때만: 현재 재고 수량만큼 신규 번호로 임시 생성 */
export function buildItemLabelVariants(item: Item): ItemLabelVariant[] {
  const qty = Math.max(0, Number(item.quantity) || 0)
  if (qty <= 0) return []

  const baseBarcode = item.barcode_code?.trim() ?? ''
  if (!baseBarcode) return []

  const codes = allocateNextUnitLotCodes(baseBarcode, [], qty)
  return codes.map((payload, i) => ({
    index: i + 1,
    barcode: payload,
    payload,
  }))
}
