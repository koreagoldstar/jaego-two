'use server'

import { createClient } from '@/lib/supabase/server'
import { buildUnitLotCodes } from '@/lib/items/lotCodes'
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
        '이 입고의 QR(스캔 코드)를 입력하세요. 라벨에 찍힌 값과 같게 넣어 주세요.',
    }
  }
  const createdRaw = String(formData.get('created_at') ?? '').trim()
  const created_at = parseDatetimeLocalToIso(createdRaw) ?? new Date().toISOString()

  const insertRows = qty === 1
    ? [{ user_id: user.id, item_id: itemId, quantity: 1, lot_code, note, created_at }]
    : buildUnitLotCodes(lot_code, qty).map(code => ({
        user_id: user.id,
        item_id: itemId,
        quantity: 1,
        lot_code: code,
        note,
        created_at,
      }))

  const { error } = await supabase.from('item_stock_lots').insert(insertRows)

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
      error: 'QR(스캔 코드)를 비울 수 없습니다. 재고 1개만 줄이려면 아래「재고 수량 기준 라벨」에서 삭제하세요.',
    }
  }
  const createdRaw = String(formData.get('created_at') ?? '').trim()
  const created_at = parseDatetimeLocalToIso(createdRaw)
  if (!created_at) return { ok: false as const, error: '날짜·시간을 확인하세요' }

  const unitCodes = qty === 1 ? [lot_code] : buildUnitLotCodes(lot_code, qty)

  const { error } = await supabase
    .from('item_stock_lots')
    .update({ quantity: 1, lot_code: unitCodes[0], note, created_at })
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

  if (unitCodes.length > 1) {
    const extraRows = unitCodes.slice(1).map(code => ({
      user_id: user.id,
      item_id: itemId,
      quantity: 1,
      lot_code: code,
      note,
      created_at,
    }))
    const { error: extraError } = await supabase.from('item_stock_lots').insert(extraRows)
    if (extraError) {
      if (pgUniqueViolation(extraError)) {
        return { ok: false as const, error: '이 품목에 동일한 QR 입고가 이미 있습니다.' }
      }
      const msg = isMissingItemStockLotsTable(extraError)
        ? '입고 단위 테이블이 없습니다. Supabase에서 007·009 마이그레이션을 실행하세요.'
        : extraError.message
      return { ok: false as const, error: msg }
    }
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
    .select('id')
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
