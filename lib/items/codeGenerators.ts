/** 클라이언트 컴포넌트에서만 import (버튼으로 필드 채우기) — 랜덤 16진 길이는 서버와 동일 */
export function generateBarcodeValue(): string {
  const u = new Uint8Array(7)
  crypto.getRandomValues(u)
  return 'B' + Array.from(u, x => x.toString(16).padStart(2, '0')).join('').toUpperCase()
}

export function generateSerialValue(): string {
  const u = new Uint8Array(5)
  crypto.getRandomValues(u)
  return 'SN-' + Array.from(u, x => x.toString(16).padStart(2, '0')).join('').toUpperCase()
}
