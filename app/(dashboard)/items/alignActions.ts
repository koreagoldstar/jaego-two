'use server'

import { alignAllUserStockLots, alignItemStockLots, auditUserStockLots } from '@/lib/items/stockLotAlign'
import { revalidateInventoryViews } from '@/lib/projects/revalidateViews'
import { createClient } from '@/lib/supabase/server'
import { isMissingItemStockLotsTable } from '@/lib/supabase/missingTable'
import { revalidatePath } from 'next/cache'

function revalidateLotViews() {
  revalidateInventoryViews()
  revalidatePath('/barcode')
}

export async function auditStockLotsAction() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: '로그인이 필요합니다' }

  const probe = await supabase.from('item_stock_lots').select('id').eq('user_id', user.id).limit(1)
  if (probe.error && isMissingItemStockLotsTable(probe.error)) {
    return { ok: false as const, error: '입고 단위 DB(007·009)가 없습니다. Supabase 마이그레이션을 먼저 실행하세요.' }
  }

  const report = await auditUserStockLots(supabase, user.id)
  return { ok: true as const, report }
}

export async function alignAllStockLotsAction() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: '로그인이 필요합니다' }

  const probe = await supabase.from('item_stock_lots').select('id').eq('user_id', user.id).limit(1)
  if (probe.error && isMissingItemStockLotsTable(probe.error)) {
    return { ok: false as const, error: '입고 단위 DB(007·009)가 없습니다. Supabase 마이그레이션을 먼저 실행하세요.' }
  }

  const { alignedItems, results } = await alignAllUserStockLots(supabase, user.id)
  const filled = results.reduce((s, r) => s + r.filledCodes, 0)
  const split = results.reduce((s, r) => s + r.splitUnits, 0)
  const added = results.reduce((s, r) => s + r.addedLots, 0)
  const trimmed = results.reduce((s, r) => s + r.trimmedCodes, 0)

  revalidateLotViews()
  return {
    ok: true as const,
    alignedItems,
    filled,
    split,
    added,
    trimmed,
  }
}

export async function alignItemStockLotsAction(itemId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: '로그인이 필요합니다' }

  const probe = await supabase.from('item_stock_lots').select('id').eq('user_id', user.id).limit(1)
  if (probe.error && isMissingItemStockLotsTable(probe.error)) {
    return { ok: false as const, error: '입고 단위 DB(007·009)가 없습니다.' }
  }

  const { data: item, error } = await supabase
    .from('items')
    .select('id, name, quantity, barcode_code, created_at')
    .eq('id', itemId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) return { ok: false as const, error: error.message }
  if (!item) return { ok: false as const, error: '품목을 찾을 수 없습니다' }

  const result = await alignItemStockLots(supabase, user.id, item)
  revalidateLotViews()
  revalidatePath(`/items/${itemId}`)
  return { ok: true as const, result }
}
