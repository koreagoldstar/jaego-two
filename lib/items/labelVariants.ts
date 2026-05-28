import type { Item } from '@/lib/supabase/types'
import { allocateNextUnitLotCodes, parseUnitSuffixIndex, stripUnitSuffix } from '@/lib/items/lotCodes'

/** QR lot_code 끝 순번(-003)과 라벨 #3 표시를 맞춥니다. */
export function labelIndexFromLotCode(code: string): number {
  return parseUnitSuffixIndex(code) ?? 1
}

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
  const allLotCodes = lots.map(l => (l.lot_code ?? '').trim()).filter(Boolean)

  for (const lot of lots) {
    const code = (lot.lot_code ?? '').trim()
    const qty = Math.max(0, Math.floor(Number(lot.quantity) || 0))
    if (!code || qty <= 0) continue

    // 정상: lot 1행 = 실물 1개 = QR 1개 (quantity 1, lot_code 고유)
    if (qty === 1) {
      rows.push({ index: labelIndexFromLotCode(code), barcode: code, payload: code })
      continue
    }

    // 구데이터: 한 행에 수량만 여러 개인 경우 — 인쇄용으로만 접미사 분리
    const base = stripUnitSuffix(code) || code
    const payloads = allocateNextUnitLotCodes(base, allLotCodes, qty)
    for (const payload of payloads) {
      rows.push({
        index: labelIndexFromLotCode(payload),
        barcode: payload,
        payload,
      })
    }
  }

  rows.sort((a, b) => a.index - b.index || (a.barcode ?? '').localeCompare(b.barcode ?? ''))

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
  return codes
    .map(payload => ({
      index: labelIndexFromLotCode(payload),
      barcode: payload,
      payload,
    }))
    .sort((a, b) => a.index - b.index)
}
