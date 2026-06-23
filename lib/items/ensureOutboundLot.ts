import type { SupabaseClient } from '@supabase/supabase-js'
import { lotCodeBelongsToItemBase, resolveItemLotBase } from '@/lib/items/knownLotCodes'

async function findActiveLotIdByCode(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
  lotCode: string,
): Promise<string | null> {
  const trimmed = lotCode.trim()
  if (!trimmed) return null

  const { data: exact } = await supabase
    .from('item_stock_lots')
    .select('id')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .eq('lot_code', trimmed)
    .gt('quantity', 0)
    .limit(1)
    .maybeSingle()
  if (exact?.id) return exact.id

  if (!/[%_]/.test(trimmed)) {
    const { data: ilike } = await supabase
      .from('item_stock_lots')
      .select('id')
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .ilike('lot_code', trimmed)
      .gt('quantity', 0)
      .limit(1)
      .maybeSingle()
    if (ilike?.id) return ilike.id
  }

  return null
}

async function fetchShippedLotCodesLower(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
): Promise<Set<string>> {
  const { data: outs } = await supabase
    .from('stock_transactions')
    .select('lot_code')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .eq('direction', 'out')
    .not('lot_code', 'is', null)
    .neq('lot_code', '')
    .order('created_at', { ascending: false })
    .limit(2000)

  const shipped = new Set<string>()
  for (const row of outs ?? []) {
    for (const part of (row.lot_code ?? '').split(',')) {
      const trimmed = part.trim().toLowerCase()
      if (trimmed) shipped.add(trimmed)
    }
  }
  return shipped
}

async function wasCodeAlreadyShipped(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
  lotCode: string,
  shippedCodesLower?: Set<string>,
): Promise<boolean> {
  const active = await findActiveLotIdByCode(supabase, userId, itemId, lotCode)
  if (active) return false

  const shipped = shippedCodesLower ?? (await fetchShippedLotCodesLower(supabase, userId, itemId))
  return shipped.has(lotCode.trim().toLowerCase())
}

type ActiveLotRow = {
  id: string
  lot_code: string | null
  quantity: number
  created_at: string
}

/** 이미 출고된 QR 번호는 제외하고, 남은 재고 lot 중 라벨에 맞출 대상 선택 */
function pickLotToRelabelForScan(
  rows: ActiveLotRow[],
  scannedLower: string,
  shippedCodesLower: Set<string>,
): ActiveLotRow | null {
  if (rows.length === 0) return null

  const candidates = rows.filter(r => (r.lot_code ?? '').trim().toLowerCase() !== scannedLower)
  if (candidates.length === 0) return rows[0]

  const empty = candidates.find(r => !(r.lot_code ?? '').trim())
  if (empty) return empty

  const orphaned = candidates.find(r => {
    const code = (r.lot_code ?? '').trim().toLowerCase()
    return code && shippedCodesLower.has(code)
  })
  if (orphaned) return orphaned

  return candidates[0]
}

/**
 * 실물 라벨 QR 기준 출고: 해당 lot_code가 없으면 재고 1건의 lot_code를 스캔값으로 맞춘 뒤 lot id 반환
 */
export async function ensureOutboundLotForScan(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
  scannedCode: string,
): Promise<{ ok: true; lotId: string; adjusted: boolean } | { ok: false; error: string }> {
  const code = scannedCode.trim()
  if (!code) return { ok: false, error: 'QR 코드가 비어 있습니다.' }

  const { data: item } = await supabase
    .from('items')
    .select('barcode_code, quantity')
    .eq('id', itemId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!item) return { ok: false, error: '품목을 찾을 수 없습니다.' }

  const itemBase = resolveItemLotBase(item.barcode_code, itemId)
  if (!lotCodeBelongsToItemBase(code, itemBase)) {
    return { ok: false, error: `QR 코드는 품목 코드「${itemBase}」와 같아야 합니다.` }
  }

  const existingId = await findActiveLotIdByCode(supabase, userId, itemId, code)
  if (existingId) return { ok: true, lotId: existingId, adjusted: false }

  const shippedCodesLower = await fetchShippedLotCodesLower(supabase, userId, itemId)
  if (await wasCodeAlreadyShipped(supabase, userId, itemId, code, shippedCodesLower)) {
    return { ok: false, error: '이미 출고된 QR 번호입니다.' }
  }

  const { data: lots } = await supabase
    .from('item_stock_lots')
    .select('id, lot_code, quantity, created_at')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .gt('quantity', 0)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  const rows = (lots ?? []) as ActiveLotRow[]
  if (rows.length === 0) {
    return { ok: false, error: '현재 재고에 출고할 단위가 없습니다.' }
  }

  const codeLower = code.toLowerCase()
  const duplicate = rows.find(r => (r.lot_code ?? '').trim().toLowerCase() === codeLower)
  if (duplicate?.id) return { ok: true, lotId: duplicate.id, adjusted: false }

  const target = pickLotToRelabelForScan(rows, codeLower, shippedCodesLower)
  if (!target?.id) {
    return { ok: false, error: '현재 재고에 출고할 단위가 없습니다.' }
  }

  const prev = (target.lot_code ?? '').trim()
  if (prev.toLowerCase() === codeLower) {
    return { ok: true, lotId: target.id, adjusted: false }
  }

  const { error: updError } = await supabase
    .from('item_stock_lots')
    .update({ lot_code: code, note: '[라벨출고정합]' })
    .eq('id', target.id)
    .eq('user_id', userId)
    .eq('item_id', itemId)

  if (updError) {
    if (updError.code === '23505') {
      return { ok: false, error: '동일한 QR 번호가 이미 다른 재고에 있습니다.' }
    }
    return { ok: false, error: updError.message }
  }

  return { ok: true, lotId: target.id, adjusted: true }
}
