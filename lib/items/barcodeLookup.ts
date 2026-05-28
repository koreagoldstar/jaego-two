import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeBarcodePayload, to1DBarcodeSafeString } from '@/lib/items/barcodePayload'

function stripUnitSuffix(code: string): string {
  return code.replace(/-(\d{3})$/, '')
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(v => v.trim()).filter(Boolean)))
}

function parseUnitSuffix(code: string): { base: string; index: number } | null {
  const m = /^(.*)-(\d{3})$/.exec(code)
  if (!m) return null
  const index = parseInt(m[2], 10)
  if (!Number.isFinite(index) || index < 1) return null
  return { base: m[1], index }
}

export type BarcodeLookupResult = {
  itemId: string
  lotId: string | null
}

/** 사용자 품목 중 스캔 문자열로 품목·입고 단위 조회 */
export async function findItemByBarcode(
  supabase: SupabaseClient,
  userId: string,
  rawCode: string
): Promise<BarcodeLookupResult | null> {
  const code = normalizeBarcodePayload(rawCode)
  if (!code) return null

  const base = () =>
    supabase.from('items').select('id').eq('user_id', userId)

  const safeCode = to1DBarcodeSafeString(code)
  const rawCandidates = unique([
    code,
    safeCode,
    code.toUpperCase(),
    safeCode.toUpperCase(),
    stripUnitSuffix(code),
    stripUnitSuffix(safeCode),
  ])
  const barcodeCandidates = rawCandidates

  for (const candidate of barcodeCandidates) {
    const { data: byLot, error: lotError } = await supabase
      .from('item_stock_lots')
      .select('item_id, id')
      .eq('user_id', userId)
      .eq('lot_code', candidate)
      .limit(1)
      .maybeSingle()
    if (!lotError && byLot?.item_id) {
      return { itemId: byLot.item_id, lotId: byLot.id ?? null }
    }
  }

  for (const candidate of barcodeCandidates) {
    const parsed = parseUnitSuffix(candidate)
    if (!parsed) continue
    const { data: byBaseLot, error: baseLotError } = await supabase
      .from('item_stock_lots')
      .select('item_id, quantity')
      .eq('user_id', userId)
      .eq('lot_code', parsed.base)
      .gte('quantity', parsed.index)
      .limit(1)
      .maybeSingle()
    if (!baseLotError && byBaseLot?.item_id) {
      return { itemId: byBaseLot.item_id, lotId: null }
    }
  }

  for (const candidate of barcodeCandidates) {
    const { data: byBarcode } = await base().eq('barcode_code', candidate).maybeSingle()
    if (byBarcode?.id) return { itemId: byBarcode.id, lotId: null }
  }

  /* 부분 일치는 와일드카드 문자가 섞이면 쿼리가 깨질 수 있어 제한 */
  if (code.length >= 2 && !/[%_]/.test(code)) {
    const { data: loose } = await supabase
      .from('items')
      .select('id')
      .eq('user_id', userId)
      .ilike('barcode_code', `%${code}%`)
      .limit(1)
      .maybeSingle()

    if (loose?.id) return { itemId: loose.id, lotId: null }
  }

  return null
}

/** @deprecated findItemByBarcode 사용 */
export async function findItemIdByBarcode(
  supabase: SupabaseClient,
  userId: string,
  rawCode: string
): Promise<string | null> {
  const hit = await findItemByBarcode(supabase, userId, rawCode)
  return hit?.itemId ?? null
}
