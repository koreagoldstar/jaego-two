'use server'

import { parseUnitSuffixIndex } from '@/lib/items/lotCodes'
import { createClient } from '@/lib/supabase/server'
import { isMissingItemStockLotsTable } from '@/lib/supabase/missingTable'
import { revalidatePath } from 'next/cache'

/**
 * 라벨 #N = lot_code 끝 순번(-00N)에 해당하는 입고 단위 1개를 삭제합니다.
 * 순번이 없는 구데이터만 FIFO(입고 순)로 처리합니다.
 */
export async function deleteItemLabelUnitAction(itemId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: '로그인이 필요합니다' }

  const raw = String(formData.get('label_index') ?? '').trim()
  const labelIndex = parseInt(raw, 10)
  if (!Number.isFinite(labelIndex) || labelIndex < 1) {
    return { ok: false as const, error: '라벨 번호가 올바르지 않습니다.' }
  }

  const lotProbe = await supabase
    .from('item_stock_lots')
    .select('id, quantity, lot_code, created_at')
    .eq('item_id', itemId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (lotProbe.error && isMissingItemStockLotsTable(lotProbe.error)) {
    const { data: item, error: selErr } = await supabase
      .from('items')
      .select('quantity')
      .eq('id', itemId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (selErr) return { ok: false as const, error: selErr.message }
    if (!item) return { ok: false as const, error: '품목을 찾을 수 없습니다' }

    const q = Math.max(0, item.quantity ?? 0)
    if (labelIndex > q) {
      return { ok: false as const, error: '이미 반영되었습니다. 페이지를 새로고침 하세요.' }
    }
    if (q < 1) return { ok: false as const, error: '삭제할 재고가 없습니다.' }

    const { error } = await supabase
      .from('items')
      .update({ quantity: q - 1, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .eq('user_id', user.id)

    if (error) return { ok: false as const, error: error.message }
    revalidatePath(`/items/${itemId}`)
    revalidatePath('/items')
    return { ok: true as const }
  }

  if (lotProbe.error) {
    return { ok: false as const, error: lotProbe.error.message }
  }

  const lots = lotProbe.data ?? []
  const total = lots.reduce((s, r) => s + (r.quantity ?? 0), 0)
  if (total < 1) return { ok: false as const, error: '삭제할 재고가 없습니다.' }

  const hasNumberedLots = lots.some(r => parseUnitSuffixIndex(r.lot_code ?? '') !== null)

  async function removeLotRow(row: { id: string; quantity: number | null }) {
    const q = row.quantity ?? 0
    if (q <= 1) {
      const { error } = await supabase
        .from('item_stock_lots')
        .delete()
        .eq('id', row.id)
        .eq('user_id', user.id)
        .eq('item_id', itemId)
      if (error) {
        const msg = isMissingItemStockLotsTable(error) ? '입고 단위 테이블을 확인하세요.' : error.message
        return { ok: false as const, error: msg }
      }
    } else {
      const { error } = await supabase
        .from('item_stock_lots')
        .update({ quantity: q - 1 })
        .eq('id', row.id)
        .eq('user_id', user.id)
        .eq('item_id', itemId)
      if (error) {
        const msg = isMissingItemStockLotsTable(error) ? '입고 단위 테이블을 확인하세요.' : error.message
        return { ok: false as const, error: msg }
      }
    }
    revalidatePath(`/items/${itemId}`)
    revalidatePath('/items')
    return { ok: true as const }
  }

  if (hasNumberedLots) {
    const target = lots.find(r => parseUnitSuffixIndex(r.lot_code ?? '') === labelIndex)
    if (!target) {
      return { ok: false as const, error: `#${labelIndex}에 해당하는 재고가 없습니다.` }
    }
    return removeLotRow(target)
  }

  if (labelIndex > total) {
    return { ok: false as const, error: '이미 반영되었습니다. 페이지를 새로고침 하세요.' }
  }

  let remaining = labelIndex
  for (const row of lots) {
    const q = row.quantity ?? 0
    if (remaining > q) {
      remaining -= q
      continue
    }
    return removeLotRow(row)
  }

  return { ok: false as const, error: '삭제할 위치를 찾지 못했습니다.' }
}
