'use server'

import { createClient } from '@/lib/supabase/server'
import { isMissingItemStockLotsTable } from '@/lib/supabase/missingTable'
import { revalidatePath } from 'next/cache'

/** `<input type="datetime-local">` 값 (타임존 없음) → ISO. 앱 기본 KST(+09:00)로 저장 */
function parseDatetimeLocalToIso(s: string): string | null {
  const t = s.trim()
  if (!t) return null
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(t)
  if (m) {
    const iso = `${m[1]}T${m[2]}:${m[3]}:00+09:00`
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export async function addItemStockLotAction(itemId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: '로그인이 필요합니다' }

  const qty = Math.max(1, parseInt(String(formData.get('quantity') ?? '1'), 10) || 1)
  const note = String(formData.get('note') ?? '').trim()
  const createdRaw = String(formData.get('created_at') ?? '').trim()
  const created_at = parseDatetimeLocalToIso(createdRaw) ?? new Date().toISOString()

  const { error } = await supabase.from('item_stock_lots').insert({
    user_id: user.id,
    item_id: itemId,
    quantity: qty,
    note,
    created_at,
  })

  if (error) {
    const msg = isMissingItemStockLotsTable(error)
      ? '입고 단위 테이블이 없습니다. Supabase SQL Editor에서 supabase/migrations/007_item_stock_lots.sql 을 실행하세요.'
      : error.message
    return { ok: false as const, error: msg }
  }
  revalidatePath(`/items/${itemId}`)
  revalidatePath('/items')
  return { ok: true as const }
}

export async function updateItemStockLotAction(
  itemId: string,
  lotId: string,
  formData: FormData
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: '로그인이 필요합니다' }

  const qty = Math.max(1, parseInt(String(formData.get('quantity') ?? '1'), 10) || 1)
  const note = String(formData.get('note') ?? '').trim()
  const createdRaw = String(formData.get('created_at') ?? '').trim()
  const created_at = parseDatetimeLocalToIso(createdRaw)
  if (!created_at) return { ok: false as const, error: '날짜·시간을 확인하세요' }

  const { error } = await supabase
    .from('item_stock_lots')
    .update({ quantity: qty, note, created_at })
    .eq('id', lotId)
    .eq('item_id', itemId)
    .eq('user_id', user.id)

  if (error) {
    const msg = isMissingItemStockLotsTable(error)
      ? '입고 단위 테이블이 없습니다. Supabase에서 007 마이그레이션을 실행하세요.'
      : error.message
    return { ok: false as const, error: msg }
  }
  revalidatePath(`/items/${itemId}`)
  revalidatePath('/items')
  return { ok: true as const }
}

export async function deleteItemStockLotAction(itemId: string, lotId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: '로그인이 필요합니다' }

  const { error } = await supabase
    .from('item_stock_lots')
    .delete()
    .eq('id', lotId)
    .eq('item_id', itemId)
    .eq('user_id', user.id)

  if (error) {
    const msg = isMissingItemStockLotsTable(error)
      ? '입고 단위 테이블이 없습니다. Supabase에서 007 마이그레이션을 실행하세요.'
      : error.message
    return { ok: false as const, error: msg }
  }
  revalidatePath(`/items/${itemId}`)
  revalidatePath('/items')
  return { ok: true as const }
}

/** 이 입고 줄에서만 수량만큼 빼기(전부 빼면 행 삭제) */
export async function subtractItemStockLotAction(itemId: string, lotId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: '로그인이 필요합니다' }

  const raw = String(formData.get('subtract_qty') ?? '').trim()
  const n = Math.max(1, parseInt(raw, 10) || 0)
  if (!Number.isFinite(n) || n < 1) {
    return { ok: false as const, error: '차감 수량을 입력하세요' }
  }

  const { data: row, error: selErr } = await supabase
    .from('item_stock_lots')
    .select('id, quantity')
    .eq('id', lotId)
    .eq('item_id', itemId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (selErr) {
    const msg = isMissingItemStockLotsTable(selErr)
      ? '입고 단위 테이블이 없습니다. Supabase에서 007 마이그레이션을 실행하세요.'
      : selErr.message
    return { ok: false as const, error: msg }
  }
  if (!row) return { ok: false as const, error: '입고 단위를 찾을 수 없습니다' }

  const q = row.quantity ?? 0
  if (n > q) return { ok: false as const, error: `이 입고에는 ${q}개만 있습니다` }

  if (n === q) {
    const { error } = await supabase
      .from('item_stock_lots')
      .delete()
      .eq('id', lotId)
      .eq('user_id', user.id)
    if (error) return { ok: false as const, error: error.message }
  } else {
    const { error } = await supabase
      .from('item_stock_lots')
      .update({ quantity: q - n })
      .eq('id', lotId)
      .eq('user_id', user.id)
    if (error) return { ok: false as const, error: error.message }
  }

  revalidatePath(`/items/${itemId}`)
  revalidatePath('/items')
  return { ok: true as const }
}
