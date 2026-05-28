const UNIT_SUFFIX_RE = /-(\d{3})(?:-r\d+)?$/i

export function withUnitSuffix(base: string, index: number, total: number): string {
  if (!base) return ''
  if (total <= 1) return base
  return `${base}-${String(index).padStart(3, '0')}`
}

/** 표시·할당용: -001 / -001-r2 등 단위 접미사 제거 */
export function stripUnitSuffix(code: string): string {
  const trimmed = code.trim()
  if (!trimmed) return ''
  return trimmed.replace(UNIT_SUFFIX_RE, '') || trimmed
}

export function parseUnitSuffixIndex(code: string): number | null {
  const m = UNIT_SUFFIX_RE.exec(code.trim())
  if (!m) return null
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function maxUnitSuffixIndex(codes: string[]): number {
  let max = 0
  for (const raw of codes) {
    const n = parseUnitSuffixIndex(raw)
    if (n !== null && n > max) max = n
  }
  return max
}

function uniqueLotCode(base: string, index: number, used: Set<string>): string {
  let candidate = `${base}-${String(index).padStart(3, '0')}`
  let retry = 1
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base}-${String(index).padStart(3, '0')}-r${retry}`
    retry += 1
  }
  used.add(candidate.toLowerCase())
  return candidate
}

/** @deprecated 신규 재고는 allocateNextUnitLotCodes 사용 */
export function buildUnitLotCodes(baseCode: string, quantity: number): string[] {
  return allocateNextUnitLotCodes(baseCode, [], quantity)
}

/**
 * 기존 lot_code 중 가장 큰 뒷번호 다음부터 count개를 발급합니다.
 * 출고로 lot가 삭제돼도 이미 쓴 번호는 재사용하지 않습니다.
 */
export function allocateNextUnitLotCodes(
  baseCode: string,
  existingLotCodes: string[],
  count: number,
): string[] {
  const base = baseCode.trim()
  if (!base || count <= 0) return []

  const used = new Set(
    existingLotCodes.map(c => c.trim().toLowerCase()).filter(Boolean),
  )
  let nextIndex = maxUnitSuffixIndex(existingLotCodes) + 1
  if (nextIndex < 1) nextIndex = 1

  const out: string[] = []
  while (out.length < count) {
    out.push(uniqueLotCode(base, nextIndex, used))
    nextIndex += 1
  }
  return out
}
