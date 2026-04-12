/** 클라이언트 컴포넌트에서만 import (버튼으로 필드 채우기) */
export function generateBarcodeValue(): string {
  const u = new Uint8Array(8)
  crypto.getRandomValues(u)
  return 'B' + Array.from(u, x => x.toString(16).padStart(2, '0')).join('').toUpperCase()
}

export function generateSerialValue(): string {
  const u = new Uint8Array(6)
  crypto.getRandomValues(u)
  return 'SN-' + Array.from(u, x => x.toString(16).padStart(2, '0')).join('').toUpperCase()
}
