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
