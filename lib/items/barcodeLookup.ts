import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeBarcodePayload, to1DBarcodeSafeString } from '@/lib/items/barcodePayload'
import { parseUnitSuffixIndex, stripUnitSuffix } from '@/lib/items/lotCodes'

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(v => v.trim()).filter(Boolean)))
}

function parseLegacyBundledLotIndex(code: string): { base: string; index: number } | null {
  const m = /^(.*)-(\d{3,})$/.exec(code.trim())
  if (!m) return null
  const index = parseInt(m[2], 10)
  if (!Number.isFinite(index) || index < 1) return null
  return { base: m[1], index }
}

export type BarcodeLookupResult = {
  itemId: string
  lotId: string | null
  /** 재고(lot)에 없고 단위 QR(-001 등)만 스캔된 경우 */
  alreadyShipped?: boolean
}

export const ALREADY_SHIPPED_MESSAGE = '이미 출고된 제품입니다.'

function lotCodeListedInField(field: string | null | undefined, lotCode: string): boolean {
  const target = lotCode.trim().toLowerCase()
  if (!target) return false
  return (field ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .some(s => s === target)
}

async function findItemIdByBarcodeCandidates(
  supabase: SupabaseClient,
  userId: string,
  candidates: string[]
): Promise<string | null> {
  for (const candidate of candidates) {
    const { data: byBarcode } = await supabase
      .from('items')
      .select('id')
      .eq('user_id', userId)
      .eq('barcode_code', candidate)
      .maybeSingle()
    if (byBarcode?.id) return byBarcode.id
  }
  return null
}

async function wasUnitLotAlreadyShipped(
  supabase: SupabaseClient,
  userId: string,
  lotCode: string,
  itemId: string
): Promise<boolean> {
  const { data: activeLot } = await supabase
    .from('item_stock_lots')
    .select('id')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .eq('lot_code', lotCode)
    .limit(1)
    .maybeSingle()
  if (activeLot?.id) return false

  const { data: outs } = await supabase
    .from('stock_transactions')
    .select('lot_code')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .eq('direction', 'out')
    .not('lot_code', 'is', null)
    .neq('lot_code', '')
    .order('created_at', { ascending: false })
    .limit(200)

  if ((outs ?? []).some(row => lotCodeListedInField(row.lot_code, lotCode))) {
    return true
  }

  return parseUnitSuffixIndex(lotCode) !== null
}

/** 사용자 품목 중 스캔 문자열로 품목·입고 단위 조회 */
export async function findItemByBarcode(
  supabase: SupabaseClient,
  userId: string,
  rawCode: string
): Promise<BarcodeLookupResult | null> {
  const code = normalizeBarcodePayload(rawCode)
  if (!code) return null

  const safeCode = to1DBarcodeSafeString(code)
  const hasUnitSuffix = parseUnitSuffixIndex(code) !== null
  const lotCandidates = unique([code, safeCode, code.toUpperCase(), safeCode.toUpperCase()])
  const itemBarcodeCandidates = hasUnitSuffix
    ? lotCandidates.filter(c => parseUnitSuffixIndex(c) !== null)
    : unique([...lotCandidates, stripUnitSuffix(code), stripUnitSuffix(safeCode)])

  for (const candidate of lotCandidates) {
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

  for (const candidate of lotCandidates) {
    const parsed = parseLegacyBundledLotIndex(candidate)
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

  if (hasUnitSuffix) {
    const itemId = await findItemIdByBarcodeCandidates(supabase, userId, [
      stripUnitSuffix(code),
      stripUnitSuffix(safeCode),
      ...itemBarcodeCandidates,
    ])
    if (!itemId) return null

    const shipped = await wasUnitLotAlreadyShipped(supabase, userId, code, itemId)
    if (shipped) {
      return { itemId, lotId: null, alreadyShipped: true }
    }
    return null
  }

  const itemId = await findItemIdByBarcodeCandidates(supabase, userId, itemBarcodeCandidates)
  if (itemId) return { itemId, lotId: null }

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
  if (!hit || hit.alreadyShipped) return null
  return hit.itemId
}
