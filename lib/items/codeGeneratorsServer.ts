import { randomBytes } from 'crypto'

/** 서버 액션(일괄 등록) 전용 — 형식은 codeGenerators.ts 와 동일 */
export function generateBarcodeValue(): string {
  return 'B' + randomBytes(7).toString('hex').toUpperCase()
}

export function generateSerialValue(): string {
  return 'SN-' + randomBytes(5).toString('hex').toUpperCase()
}
