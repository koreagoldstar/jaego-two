/** 보이지 않는 문자 제거 — DB/복사 시 섞인 ZWSP 등이 심볼로 깨질 수 있음 */
export function normalizeBarcodePayload(payload: string): string {
  return payload.replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
}
