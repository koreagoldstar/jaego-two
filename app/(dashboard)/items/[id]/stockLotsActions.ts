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

function pgUniqueViolation(err: { code?: string } | null) {
  return err?.code === '23505'
}

export async function addItemStockLotAction(itemId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: '로그인이 필요합니다' }

  const qty = Math.max(1, parseInt(String(formData.get('quantity') ?? '1'), 10) || 1)
  const note = String(formData.get('note') ?? '').trim()
  const lot_code = String(formData.get('lot_code') ?? '').trim()
  if (!lot_code) {
    return {
      ok: false as const,
      error:
        '이 입고의 QR(스캔 코드)를 입력하세요. 라벨에 찍힌 값과 같게 넣어야 나중에 QR로 이 재고를 통째로 삭제할 수 있습니다.',
    }
  }
  const createdRaw = String(formData.get('created_at') ?? '').trim()
  const created_at = parseDatetimeLocalToIso(createdRaw) ?? new Date().toISOString()

  const { error } = await supabase.from('item_stock_lots').insert({
    user_id: user.id,
    item_id: itemId,
    quantity: qty,
    lot_code,
    note,
    created_at,
  })

  if (error) {
    if (pgUniqueViolation(error)) {
      return { ok: false as const, error: '이 품목에 동일한 QR 입고가 이미 있습니다. 다른 코드를 쓰세요.' }
    }
    const msg = isMissingItemStockLotsTable(error)
      ? '입고 단위 테이블이 없거나 lot_code 컬럼이 없습니다. Supabase에서 007·009 마이그레이션을 실행하세요.'
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
  const lot_code = String(formData.get('lot_code') ?? '').trim()
  if (!lot_code) {
    return {
      ok: false as const,
      error: 'QR(스캔 코드)를 비울 수 없습니다. 삭제만 하려면 상단「QR로 재고 삭제」를 쓰세요.',
    }
  }
  const createdRaw = String(formData.get('created_at') ?? '').trim()
  const created_at = parseDatetimeLocalToIso(createdRaw)
  if (!created_at) return { ok: false as const, error: '날짜·시간을 확인하세요' }

  const { error } = await supabase
    .from('item_stock_lots')
    .update({ quantity: qty, lot_code, note, created_at })
    .eq('id', lotId)
    .eq('item_id', itemId)
    .eq('user_id', user.id)

  if (error) {
    if (pgUniqueViolation(error)) {
      return { ok: false as const, error: '이 품목에 동일한 QR 입고가 이미 있습니다.' }
    }
    const msg = isMissingItemStockLotsTable(error)
      ? '입고 단위 테이블이 없습니다. Supabase에서 007·009 마이그레이션을 실행하세요.'
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

  const { data: row, error: selErr } = await supabase
    .from('item_stock_lots')
    .select('id, lot_code')
    .eq('id', lotId)
    .eq('item_id', itemId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (selErr) {
    const msg = isMissingItemStockLotsTable(selErr)
      ? '입고 단위 테이블이 없습니다.'
      : selErr.message
    return { ok: false as const, error: msg }
  }
  if (!row) return { ok: false as const, error: '입고를 찾을 수 없습니다' }
  if ((row.lot_code ?? '').trim() !== '') {
    return {
      ok: false as const,
      error: 'QR이 등록된 입고는「QR로 재고 삭제」에 코드를 입력해 삭제하세요.',
    }
  }

  const { error } = await supabase
    .from('item_stock_lots')
    .delete()
    .eq('id', lotId)
    .eq('item_id', itemId)
    .eq('user_id', user.id)

  if (error) {
    const msg = isMissingItemStockLotsTable(error)
      ? '입고 단위 테이블이 없습니다.'
      : error.message
    return { ok: false as const, error: msg }
  }
  revalidatePath(`/items/${itemId}`)
  revalidatePath('/items')
  return { ok: true as const }
}

/** 입력한 QR과 일치하는 입고 한 줄 전체 삭제 */
export async function deleteItemStockLotByQrAction(itemId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: '로그인이 필요합니다' }

  const raw = String(formData.get('delete_qr') ?? '').trim()
  if (!raw) return { ok: false as const, error: '삭제할 QR(스캔 코드)를 입력하세요' }

  const needle = raw.toLowerCase()
  const { data: rows, error: selErr } = await supabase
    .from('item_stock_lots')
    .select('id, lot_code')
    .eq('item_id', itemId)
    .eq('user_id', user.id)

  if (selErr) {
    const msg = isMissingItemStockLotsTable(selErr)
      ? '입고 단위 테이블이 없습니다.'
      : selErr.message
    return { ok: false as const, error: msg }
  }

  const match = (rows ?? []).find(r => (r.lot_code ?? '').trim().toLowerCase() === needle)
  if (!match) {
    return { ok: false as const, error: '이 품목에 해당 QR로 등록된 입고가 없습니다.' }
  }

  const { error } = await supabase
    .from('item_stock_lots')
    .delete()
    .eq('id', match.id)
    .eq('user_id', user.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/items/${itemId}`)
  revalidatePath('/items')
  return { ok: true as const }
}
