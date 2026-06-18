import { parseUnitSuffixIndex } from '@/lib/items/lotCodes'
import type { StockUnitOption } from '@/lib/items/stockUnits'

/** 화면에 로드된 재고 단위 목록에서 스캔 QR과 lot 매칭 */
export function resolveScanLotId(code: string, units: StockUnitOption[]): string | null {
  const trimmed = code.trim()
  if (!trimmed || units.length === 0) return null

  const lower = trimmed.toLowerCase()
  const byExact = units.find(u => (u.lotCode ?? '').toLowerCase() === lower)
  if (byExact) return byExact.lotId

  const suffix = parseUnitSuffixIndex(trimmed)
  if (suffix === null) return null

  const byIndex = units.filter(u => u.labelIndex === suffix)
  if (byIndex.length === 1) return byIndex[0].lotId

  return null
}

/** 스캔한 #번호가 재고 목록에 없을 때 안내 문구 */
export function formatMissingUnitScanMessage(code: string, units: StockUnitOption[]): string | null {
  const suffix = parseUnitSuffixIndex(code.trim())
  if (suffix === null) return null
  if (units.some(u => u.labelIndex === suffix)) return null

  const indices = units.map(u => u.labelIndex).sort((a, b) => a - b)
  const range =
    indices.length > 0
      ? `현재 재고 단위: #${indices[0]}${indices.length > 1 ? ` ~ #${indices[indices.length - 1]}` : ''} (${indices.length}개)`
      : '현재 재고 단위가 없습니다.'

  return (
    `QR #${suffix}번은 DB 재고에 없습니다. ` +
    `라벨이 오래됐거나 이미 출고됐을 수 있습니다. ${range} ` +
    `아래 목록에서 실물에 붙은 번호와 맞는 단위를 선택하세요.`
  )
}
