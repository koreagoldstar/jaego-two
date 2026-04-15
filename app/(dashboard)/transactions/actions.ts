'use server'

import { createClient } from '@/lib/supabase/server'
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
  const createdRaw = String(formData.get('created_at') ?? '').trim()
  const created_at = parseDatetimeLocalToIso(createdRaw)
  if (!created_at) return { ok: false as const, error: '날짜·시간을 확인하세요' }

  const { error } = await supabase
    .from('stock_transactions')
    .update({ note, project, created_at })
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
