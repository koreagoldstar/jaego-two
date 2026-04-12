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

  const { error } = await supabase.from('items').delete().in('id', clean).eq('user_id', user.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/items')
  return { ok: true }
}
