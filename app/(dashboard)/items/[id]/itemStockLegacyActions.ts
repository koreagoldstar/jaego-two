'use server'

import { createClient } from '@/lib/supabase/server'
import { allocateUnitLotCodesForItem, fetchAllKnownLotCodesForItem } from '@/lib/items/knownLotCodes'
import { isMissingItemStockLotsTable } from '@/lib/supabase/missingTable'
import { revalidatePath } from 'next/cache'

export async function addItemQuantityLegacy(itemId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: '로그인이 필요합니다' }

  const n = Math.max(1, parseInt(String(formData.get('add_qty') ?? '1'), 10) || 1)
  const { data: cur, error: selErr } = await supabase
    .from('items')
    .select('quantity, barcode_code')
    .eq('id', itemId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (selErr) return { ok: false as const, error: selErr.message }
  if (!cur) return { ok: false as const, error: '품목을 찾을 수 없습니다' }

  const { itemBase, knownCodes } = await fetchAllKnownLotCodesForItem(supabase, user.id, itemId)
  const codes = allocateUnitLotCodesForItem(itemBase, knownCodes, n)
  const now = new Date().toISOString()
  const { error: lotErr } = await supabase.from('item_stock_lots').insert(
    codes.map(code => ({
      user_id: user.id,
      item_id: itemId,
      quantity: 1,
      lot_code: code,
      note: '',
      created_at: now,
    }))
  )

  if (!lotErr) {
    const next = (cur.quantity ?? 0) + n
    await supabase
      .from('items')
      .update({ quantity: next, updated_at: now })
      .eq('id', itemId)
      .eq('user_id', user.id)
    revalidatePath(`/items/${itemId}`)
    revalidatePath('/items')
    revalidatePath('/barcode')
    return { ok: true as const }
  }

  if (!isMissingItemStockLotsTable(lotErr)) {
    return { ok: false as const, error: lotErr.message }
  }

  const next = (cur.quantity ?? 0) + n
  const { error } = await supabase
    .from('items')
    .update({ quantity: next, updated_at: now })
    .eq('id', itemId)
    .eq('user_id', user.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/items/${itemId}`)
  revalidatePath('/items')
  return { ok: true as const }
}

export async function clearItemQuantityLegacy(itemId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: '로그인이 필요합니다' }

  const { error } = await supabase
    .from('items')
    .update({ quantity: 0, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('user_id', user.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/items/${itemId}`)
  revalidatePath('/items')
  return { ok: true as const }
}
