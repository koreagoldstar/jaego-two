import type { SupabaseClient } from '@supabase/supabase-js'
import { isMissingItemStockLotsTable } from '@/lib/supabase/missingTable'

/** created_at 오름차순(FIFO)으로 실물 1개 단위 lot를 unitsToRemove개 제거 */
export async function deleteUnitLotsFifo(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
  unitsToRemove: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const n = Math.max(0, unitsToRemove)
  if (n <= 0) return { ok: true }

  const lotProbe = await supabase
    .from('item_stock_lots')
    .select('id, quantity, created_at')
    .eq('item_id', itemId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (lotProbe.error) {
    if (isMissingItemStockLotsTable(lotProbe.error)) {
      return { ok: false, error: '입고 단위 테이블이 없습니다.' }
    }
    return { ok: false, error: lotProbe.error.message }
  }

  const lots = lotProbe.data ?? []
  const total = lots.reduce((s, r) => s + (r.quantity ?? 0), 0)
  if (n > total) {
    return { ok: false, error: '삭제할 재고가 부족합니다.' }
  }

  let remaining = n
  for (const row of lots) {
    if (remaining <= 0) break
    const q = row.quantity ?? 0
    if (remaining > q) {
      remaining -= q
      const { error } = await supabase
        .from('item_stock_lots')
        .delete()
        .eq('id', row.id)
        .eq('user_id', userId)
        .eq('item_id', itemId)
      if (error) return { ok: false, error: error.message }
      continue
    }
    if (q <= 1) {
      const { error } = await supabase
        .from('item_stock_lots')
        .delete()
        .eq('id', row.id)
        .eq('user_id', userId)
        .eq('item_id', itemId)
      if (error) return { ok: false, error: error.message }
    } else {
      const { error } = await supabase
        .from('item_stock_lots')
        .update({ quantity: q - remaining })
        .eq('id', row.id)
        .eq('user_id', userId)
        .eq('item_id', itemId)
      if (error) return { ok: false, error: error.message }
    }
    remaining = 0
  }

  return { ok: true }
}
