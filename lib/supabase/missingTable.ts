/** PostgREST / Supabase: 테이블이 없거나 스키마 캐시에 없을 때 */
export function isMissingItemStockLotsTable(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false
  const m = (err.message ?? '').toLowerCase()
  const c = err.code ?? ''
  if (c === 'PGRST205' || c === '42P01') return true
  return m.includes('item_stock_lots') && (m.includes('does not exist') || m.includes('schema cache'))
}
