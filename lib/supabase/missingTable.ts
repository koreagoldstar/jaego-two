/** PostgREST / Supabase: 테이블이 없거나 스키마 캐시에 없을 때 */
export function isMissingTableError(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false
  const m = (err.message ?? '').toLowerCase()
  const c = err.code ?? ''
  if (c === 'PGRST205') return true
  if (c === '42P01') return true
  if (m.includes('schema cache') && m.includes('could not find the table')) return true
  if (m.includes('relation') && m.includes('does not exist')) return true
  return false
}

export function isMissingItemStockLotsTable(err: { message?: string; code?: string } | null): boolean {
  return isMissingTableError(err)
}
