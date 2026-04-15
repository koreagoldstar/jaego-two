'use server'

import { createClient } from '@/lib/supabase/server'
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

  if (error) return { ok: false as const, error: error.message }
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

  if (error) return { ok: false as const, error: error.message }
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

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/items/${itemId}`)
  revalidatePath('/items')
  return { ok: true as const }
}
