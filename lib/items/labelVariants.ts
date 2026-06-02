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

  // 출고로 lot가 없으면 라벨 없음 (수량 폴백 시 -001 등이 다시 보이는 문제 방지)
  return rows
}

/** lot 테이블 없을 때만: 현재 재고 수량만큼 번호 발급 (기존 번호는 재사용하지 않음) */
export function buildItemLabelVariants(item: Item, existingLotCodes: string[] = []): ItemLabelVariant[] {
  const qty = Math.max(0, Number(item.quantity) || 0)
  if (qty <= 0) return []

  const baseBarcode = item.barcode_code?.trim() ?? ''
  if (!baseBarcode) return []

  const codes = allocateNextUnitLotCodes(baseBarcode, existingLotCodes, qty)
  return codes
    .map(payload => ({
      index: labelIndexFromLotCode(payload),
      barcode: payload,
      payload,
    }))
    .sort((a, b) => a.index - b.index)
}
