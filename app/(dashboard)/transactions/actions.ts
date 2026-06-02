'use server'

import { createClient } from '@/lib/supabase/server'
import { allocateUnitLotCodesForItem, fetchAllKnownLotCodesForItem } from '@/lib/items/knownLotCodes'
import { deleteUnitLotsFifo } from '@/lib/items/stockLotFifo'
import { isMissingItemStockLotsTable } from '@/lib/supabase/missingTable'
import { revalidatePath } from 'next/cache'

function parseDatetimeLocalToIso(s: string): string | null {
  const t = s.trim()
  if (!t) return null
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(t)
  if (m) {
    const d = new Date(`${m[1]}T${m[2]}:${m[3]}:00+09:00`)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export async function updateStockTransactionAction(id: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: '로그인이 필요합니다' }

  const note = String(formData.get('note') ?? '').trim()
  const project = String(formData.get('project') ?? '').trim()
  const amountRaw = String(formData.get('amount') ?? '').trim()
  const parsedAmount = parseInt(amountRaw || '0', 10)
  const createdRaw = String(formData.get('created_at') ?? '').trim()
  const created_at = parseDatetimeLocalToIso(createdRaw)
  if (!created_at) return { ok: false as const, error: '날짜·시간을 확인하세요' }

  const { data: tx, error: txError } = await supabase
    .from('stock_transactions')
    .select('direction, amount, item_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (txError) return { ok: false as const, error: txError.message }
  if (!tx) return { ok: false as const, error: '대상을 찾을 수 없습니다' }

  const nextAmount =
    tx.direction === 'out' ? Math.max(1, Number.isFinite(parsedAmount) ? parsedAmount : tx.amount) : tx.amount

  if (tx.direction === 'out' && nextAmount !== tx.amount) {
    const delta = nextAmount - tx.amount
    const correctionDirection = delta > 0 ? 'out' : 'in'
    const correctionAmount = Math.abs(delta)
    const { error: correctionError } = await supabase.rpc('apply_stock_move', {
      p_item_id: tx.item_id,
      p_direction: correctionDirection,
      p_amount: correctionAmount,
      p_note: '[이력수정보정]',
      p_project: project || null,
    })
    if (correctionError) {
      return { ok: false as const, error: `재고 보정 실패: ${correctionError.message}` }
    }
  }

  const { error } = await supabase
    .from('stock_transactions')
    .update({ note, project, created_at, amount: nextAmount })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/transactions')
  return { ok: true as const }
}

export async function updateInventoryEventAction(id: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: '로그인이 필요합니다' }

  const item_name = String(formData.get('item_name') ?? '').trim()
  if (!item_name) return { ok: false as const, error: '품목명을 입력하세요' }

  const detail = String(formData.get('detail') ?? '').trim()
  const quantity = Math.max(0, parseInt(String(formData.get('quantity') ?? '0'), 10) || 0)
  const createdRaw = String(formData.get('created_at') ?? '').trim()
  const created_at = parseDatetimeLocalToIso(createdRaw)
  if (!created_at) return { ok: false as const, error: '날짜·시간을 확인하세요' }

  const { error } = await supabase
    .from('inventory_events')
    .update({ item_name, detail, quantity, created_at })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/transactions')
  return { ok: true as const }
}

export async function deleteStockTransactionAction(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: '로그인이 필요합니다' }

  const { data: tx, error: txError } = await supabase
    .from('stock_transactions')
    .select('id, item_id, direction, amount')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (txError) return { ok: false as const, error: txError.message }
  if (!tx) return { ok: false as const, error: '이력을 찾을 수 없습니다' }

  if (tx.direction === 'out') {
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('barcode_code')
      .eq('id', tx.item_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (itemError) return { ok: false as const, error: itemError.message }
    if (!item) return { ok: false as const, error: '품목을 찾을 수 없습니다' }

    const { itemBase, knownCodes } = await fetchAllKnownLotCodesForItem(supabase, user.id, tx.item_id)

    const { error: lotError } = await supabase
      .from('item_stock_lots')
      .select('lot_code')
      .eq('item_id', tx.item_id)
      .eq('user_id', user.id)
      .limit(1)

    if (lotError && !isMissingItemStockLotsTable(lotError)) {
      return { ok: false as const, error: lotError.message }
    }

    if (lotError && isMissingItemStockLotsTable(lotError)) {
      const { error: reverseError } = await supabase.rpc('apply_stock_move', {
        p_item_id: tx.item_id,
        p_direction: 'in',
        p_amount: tx.amount,
        p_note: '[이력삭제보정]',
        p_project: null,
      })
      if (reverseError) {
        return { ok: false as const, error: `재고 되돌리기 실패: ${reverseError.message}` }
      }
    } else {
      const codes = allocateUnitLotCodesForItem(itemBase, knownCodes, tx.amount)
      const { error: insError } = await supabase.from('item_stock_lots').insert(
        codes.map(code => ({
          user_id: user.id,
          item_id: tx.item_id,
          quantity: 1,
          lot_code: code,
          note: '[이력삭제복구]',
        })),
      )
      if (insError) {
        return { ok: false as const, error: `재고 되돌리기 실패: ${insError.message}` }
      }
    }
  } else {
    const fifo = await deleteUnitLotsFifo(supabase, user.id, tx.item_id, tx.amount)
    if (!fifo.ok) return fifo
  }

  const { error: delError } = await supabase
    .from('stock_transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (delError) return { ok: false as const, error: delError.message }

  revalidatePath('/transactions')
  revalidatePath('/items')
  revalidatePath('/stock-overview')
  return { ok: true as const }
}

export async function deleteInventoryEventAction(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: '로그인이 필요합니다' }

  const { error } = await supabase.from('inventory_events').delete().eq('id', id).eq('user_id', user.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/transactions')
  return { ok: true as const }
}
