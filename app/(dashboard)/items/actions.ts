'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteItemsAction(ids: string[]): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다' }

  const clean = Array.from(new Set(ids.map(id => id.trim()).filter(Boolean)))
  if (clean.length === 0) return { ok: false, error: '삭제할 품목을 선택하세요' }

  const { data: snapshots, error: snapshotError } = await supabase
    .from('items')
    .select('id, name, quantity')
    .eq('user_id', user.id)
    .in('id', clean)
  if (snapshotError) return { ok: false, error: snapshotError.message }

  const { error } = await supabase.from('items').delete().in('id', clean).eq('user_id', user.id)

  if (error) return { ok: false, error: error.message }

  if ((snapshots ?? []).length > 0) {
    const { error: logError } = await supabase.from('inventory_events').insert(
      (snapshots ?? []).map(item => ({
        user_id: user.id,
        item_id: null,
        event_type: 'item_delete',
        item_name: item.name,
        quantity: item.quantity,
        detail: '품목 삭제',
      }))
    )
    if (logError && !logError.message.toLowerCase().includes('relation "inventory_events" does not exist')) {
      console.error('[inventory_events] delete log skipped:', logError.message)
    }
  }

  revalidatePath('/items')
  revalidatePath('/transactions')
  return { ok: true }
}
