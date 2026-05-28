/** 이력·엑셀에 표시할 QR(단위 lot_code 포함) 문자열 */
export function formatTransactionQrDisplay(
  lotCodeField: string | null | undefined,
  itemBarcode: string | null | undefined,
  amount: number
): string {
  const stored = (lotCodeField ?? '').trim()
  if (stored) {
    const codes = stored
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    if (codes.length === 1) return codes[0]
    if (codes.length > 1) return codes.join(', ')
  }

  const base = (itemBarcode ?? '').trim()
  if (!base) return ''
  const n = Math.max(1, amount)
  if (n === 1) return base
  return `${base}-001 ~ ${base}-${String(n).padStart(3, '0')}`
}

export function buildTransactionQrDetailLines(
  lotCodeField: string | null | undefined,
  itemBarcode: string | null | undefined,
  amount: number
): string[] {
  const display = formatTransactionQrDisplay(lotCodeField, itemBarcode, amount)
  if (!display) return []
  return [`QR 코드: ${display}`]
}
