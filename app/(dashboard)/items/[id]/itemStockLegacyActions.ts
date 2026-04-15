'use server'

import { createClient } from '@/lib/supabase/server'
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
    .select('quantity')
    .eq('id', itemId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (selErr) return { ok: false as const, error: selErr.message }
  if (!cur) return { ok: false as const, error: '품목을 찾을 수 없습니다' }

  const next = (cur.quantity ?? 0) + n
  const { error } = await supabase
    .from('items')
    .update({ quantity: next, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('user_id', user.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/items/${itemId}`)
  revalidatePath('/items')
  return { ok: true as const }
}

/** 품목에 등록된 QR과 일치하면 재고 전부 삭제(입고 단위 DB 없을 때) */
export async function deleteItemStockByItemQrLegacy(itemId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: '로그인이 필요합니다' }

  const raw = String(formData.get('delete_qr') ?? '').trim()
  if (!raw) return { ok: false as const, error: 'QR(스캔 코드)를 입력하세요' }

  const { data: item, error: selErr } = await supabase
    .from('items')
    .select('barcode_code, quantity')
    .eq('id', itemId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (selErr) return { ok: false as const, error: selErr.message }
  if (!item) return { ok: false as const, error: '품목을 찾을 수 없습니다' }

  const registered = (item.barcode_code ?? '').trim()
  if (!registered) {
    return { ok: false as const, error: '품목에 등록된 QR이 없습니다. 품목 수정에서 QR을 넣거나 입고 단위(009) DB를 쓰세요.' }
  }
  if (raw.toLowerCase() !== registered.toLowerCase()) {
    return { ok: false as const, error: '입력한 QR이 이 품목의 QR과 다릅니다.' }
  }

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
