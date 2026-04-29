export function withUnitSuffix(base: string, index: number, total: number): string {
  if (!base) return ''
  if (total <= 1) return base
  return `${base}-${String(index).padStart(3, '0')}`
}

export function buildUnitLotCodes(baseCode: string, quantity: number): string[] {
  const qty = Math.max(0, Number(quantity) || 0)
  if (!baseCode || qty <= 0) return []
  if (qty === 1) return [baseCode]
  return Array.from({ length: qty }, (_, idx) => withUnitSuffix(baseCode, idx + 1, qty))
}
