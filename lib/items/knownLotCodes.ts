import type { SupabaseClient } from '@supabase/supabase-js'
import { allocateNextUnitLotCodes, stripUnitSuffix } from '@/lib/items/lotCodes'

export function resolveItemLotBase(barcodeCode: string | null | undefined, itemId?: string): string {
  const trimmed = (barcodeCode ?? '').trim()
  if (trimmed) return trimmed
  if (itemId) return `item-${itemId.slice(0, 8)}`
  return ''
}

export function expandLotCodeField(field: string | null | undefined): string[] {
  return (field ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

/** lot_code 앞부분이 품목 barcode_code와 같은지 */
export function lotCodeBelongsToItemBase(lotCode: string, itemBase: string): boolean {
  const base = itemBase.trim()
  if (!base) return false
  const code = lotCode.trim()
  if (!code) return false
  if (code.toLowerCase() === base.toLowerCase()) return true
  return stripUnitSuffix(code).toLowerCase() === base.toLowerCase()
}

export async function fetchAllKnownLotCodesForItem(
  supabase: SupabaseClient,
  userId: string,
  itemId: string
): Promise<{ itemBase: string; knownCodes: string[] }> {
  const { data: item } = await supabase
    .from('items')
    .select('barcode_code')
    .eq('id', itemId)
    .eq('user_id', userId)
    .maybeSingle()

  const itemBase = resolveItemLotBase(item?.barcode_code, itemId)
  const codes = new Set<string>()

  const [lotsRes, txRes] = await Promise.all([
    supabase.from('item_stock_lots').select('lot_code').eq('item_id', itemId).eq('user_id', userId),
    supabase
      .from('stock_transactions')
      .select('lot_code')
      .eq('item_id', itemId)
      .eq('user_id', userId)
      .not('lot_code', 'is', null)
      .neq('lot_code', ''),
  ])

  for (const row of lotsRes.data ?? []) {
    for (const c of expandLotCodeField(row.lot_code)) codes.add(c)
  }
  for (const row of txRes.data ?? []) {
    for (const c of expandLotCodeField(row.lot_code)) codes.add(c)
  }

  return { itemBase, knownCodes: Array.from(codes) }
}

export function allocateUnitLotCodesForItem(
  itemBase: string,
  knownCodes: string[],
  count: number
): string[] {
  return allocateNextUnitLotCodes(itemBase.trim(), knownCodes, count)
}

export function resolveSingleUnitLotCode(
  manualInput: string,
  itemBase: string,
  knownCodes: string[]
): { ok: true; code: string } | { ok: false; error: string } {
  const base = itemBase.trim()
  if (!base) {
    return { ok: false, error: '품목 QR 스캔 코드가 없습니다. 품목 수정에서 코드를 먼저 등록하세요.' }
  }

  const trimmed = manualInput.trim()
  if (!trimmed) {
    const [code] = allocateUnitLotCodesForItem(base, knownCodes, 1)
    if (!code) return { ok: false, error: 'QR 코드를 발급하지 못했습니다.' }
    return { ok: true, code }
  }

  if (!lotCodeBelongsToItemBase(trimmed, base)) {
    return {
      ok: false,
      error: `QR 코드는 품목 코드「${base}」와 같아야 합니다. 예: ${base}-001`,
    }
  }

  if (knownCodes.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
    return {
      ok: false,
      error: '이미 사용한 QR 번호입니다. 비워 두면 다음 번호가 자동으로 붙습니다.',
    }
  }

  return { ok: true, code: trimmed }
}
