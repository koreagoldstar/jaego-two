'use server'

import { createClient } from '@/lib/supabase/server'
import { isMissingItemStockLotsTable } from '@/lib/supabase/missingTable'
import { revalidatePath } from 'next/cache'

function uniqueCodes(raw: string): string[] {
  const rows = raw
    .split(/\r?\n/)
    .map(v => v.trim())
    .filter(Boolean)
  return Array.from(new Set(rows))
}

export async function reconcileItemLotsByScannedCodesAction(itemId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: '로그인이 필요합니다' }

  const codes = uniqueCodes(String(formData.get('codes') ?? ''))
  if (codes.length === 0) {
    return { ok: false as const, error: '스캔 코드가 없습니다.' }
  }

  const { error: delError } = await supabase
    .from('item_stock_lots')
    .delete()
    .eq('item_id', itemId)
    .eq('user_id', user.id)
  if (delError) {
    const msg = isMissingItemStockLotsTable(delError)
      ? '입고 단위 테이블이 없습니다. Supabase에서 007·009 마이그레이션을 실행하세요.'
      : delError.message
    return { ok: false as const, error: msg }
  }

  const now = new Date().toISOString()
  const rows = codes.map(code => ({
    user_id: user.id,
    item_id: itemId,
    quantity: 1,
    lot_code: code,
    note: '[재고대사보정]',
    created_at: now,
  }))

  const { error: insError } = await supabase.from('item_stock_lots').insert(rows)
  if (insError) {
    const msg = isMissingItemStockLotsTable(insError)
      ? '입고 단위 테이블이 없습니다. Supabase에서 007·009 마이그레이션을 실행하세요.'
      : insError.message
    return { ok: false as const, error: msg }
  }

  revalidatePath(`/items/${itemId}`)
  revalidatePath('/items')
  revalidatePath('/stock-overview')
  return { ok: true as const, count: codes.length }
}
