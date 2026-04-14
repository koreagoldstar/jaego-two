/** 보이지 않는 문자 제거 — DB/복사 시 섞인 ZWSP 등이 심볼로 깨질 수 있음 */
export function normalizeBarcodePayload(payload: string): string {
  return payload.replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
}

/**
 * 1D 바코드(CODE128/CODE39)는 UTF-8 한글 등이 들어가면 JsBarcode·스캐너 모두 불안정해질 수 있음.
 * 인쇄/미리보기에는 표시 가능 ASCII(U+0020–U+007E)만 남긴다.
 */
export function to1DBarcodeSafeString(payload: string): string {
  const n = normalizeBarcodePayload(payload)
  return n.replace(/[^\x20-\x7E]/g, '')
}

export function is1DBarcodePayloadLossy(original: string, safe: string): boolean {
  return normalizeBarcodePayload(original) !== safe
}
