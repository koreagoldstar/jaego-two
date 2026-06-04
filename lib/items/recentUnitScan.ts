const RECENT_MS = 120_000

const recentOutbound = new Map<string, number>()

function key(code: string): string {
  return code.trim().toLowerCase()
}

/** 출고 직후 같은 단위 QR 재스캔 방지 */
export function wasRecentlyOutboundScanned(code: string): boolean {
  const k = key(code)
  if (!k) return false
  const at = recentOutbound.get(k)
  if (!at) return false
  if (Date.now() - at > RECENT_MS) {
    recentOutbound.delete(k)
    return false
  }
  return true
}

export function markRecentlyOutboundScanned(code: string): void {
  const k = key(code)
  if (!k) return
  recentOutbound.set(k, Date.now())
}

export const DUPLICATE_UNIT_SCAN_MESSAGE = '방금 출고한 QR입니다. 잠시 후 다시 시도하세요.'
