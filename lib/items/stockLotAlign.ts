import type { SupabaseClient } from '@supabase/supabase-js'
import { allocateNextUnitLotCodes, parseUnitSuffixIndex } from '@/lib/items/lotCodes'
import {
  expandLotCodeField,
  fetchAllKnownLotCodesForItem,
  resolveItemLotBase,
} from '@/lib/items/knownLotCodes'

export type StockLotAlignIssue =
  | 'qty_mismatch'
  | 'empty_lot_code'
  | 'bundled_lot'
  | 'no_item_barcode'

export type ItemStockLotAudit = {
  itemId: string
  itemName: string
  itemQty: number
  lotQtySum: number
  issues: StockLotAlignIssue[]
  emptyCodeLots: number
  bundledLots: number
}

export type StockLotAlignReport = {
  items: ItemStockLotAudit[]
  issueItemCount: number
}

type LotRow = {
  id: string
  quantity: number
  lot_code: string | null
  created_at: string
}

type ItemRow = {
  id: string
  name: string
  quantity: number | null
  barcode_code: string | null
  created_at: string
}

function uniqueLower(codes: string[]): Set<string> {
  return new Set(codes.map(c => c.trim().toLowerCase()).filter(Boolean))
}

function nextUniqueCodes(
  itemBase: string,
  knownCodes: string[],
  usedLower: Set<string>,
  count: number,
): string[] {
  const pool = [...knownCodes, ...Array.from(usedLower)]
  const out: string[] = []
  let batch = allocateNextUnitLotCodes(itemBase, pool, count)
  while (out.length < count) {
    if (batch.length === 0) break
    for (const code of batch) {
      const key = code.toLowerCase()
      if (!usedLower.has(key)) {
        usedLower.add(key)
        out.push(code)
        if (out.length >= count) break
      }
    }
    if (out.length >= count) break
    batch = allocateNextUnitLotCodes(itemBase, [...pool, ...out], count - out.length)
    if (batch.length === 0) break
  }
  return out
}

export async function auditUserStockLots(
  supabase: SupabaseClient,
  userId: string,
): Promise<StockLotAlignReport> {
  const [{ data: items }, { data: lots }] = await Promise.all([
    supabase
      .from('items')
      .select('id, name, quantity, barcode_code, created_at')
      .eq('user_id', userId)
      .order('name'),
    supabase
      .from('item_stock_lots')
      .select('id, item_id, quantity, lot_code, created_at')
      .eq('user_id', userId),
  ])

  const lotsByItem = new Map<string, LotRow[]>()
  for (const row of lots ?? []) {
    const itemId = String(row.item_id ?? '')
    if (!itemId) continue
    const list = lotsByItem.get(itemId) ?? []
    list.push({
      id: String(row.id),
      quantity: Math.max(0, Math.floor(Number(row.quantity) || 0)),
      lot_code: row.lot_code ?? null,
      created_at: row.created_at ?? '',
    })
    lotsByItem.set(itemId, list)
  }

  const audits: ItemStockLotAudit[] = []
  for (const item of (items ?? []) as ItemRow[]) {
    const itemQty = Math.max(0, Math.floor(Number(item.quantity) || 0))
    const itemLots = lotsByItem.get(item.id) ?? []
    const activeLots = itemLots.filter(l => l.quantity > 0)
    const lotQtySum = activeLots.reduce((s, l) => s + l.quantity, 0)
    const emptyCodeLots = activeLots.filter(l => !(l.lot_code ?? '').trim()).length
    const bundledLots = activeLots.filter(l => l.quantity > 1).length

    const issues: StockLotAlignIssue[] = []
    if (itemQty !== lotQtySum) issues.push('qty_mismatch')
    if (emptyCodeLots > 0) issues.push('empty_lot_code')
    if (bundledLots > 0) issues.push('bundled_lot')
    if (itemQty > 0 && !(item.barcode_code ?? '').trim()) issues.push('no_item_barcode')

    if (issues.length === 0) continue

    audits.push({
      itemId: item.id,
      itemName: item.name,
      itemQty,
      lotQtySum,
      issues,
      emptyCodeLots,
      bundledLots,
    })
  }

  return { items: audits, issueItemCount: audits.length }
}

export type AlignItemResult = {
  itemId: string
  filledCodes: number
  splitUnits: number
  addedLots: number
  trimmedCodes: number
}

/** 품목 1개: 빈 QR·묶음 lot·수량 부족을 DB 기준으로 정합 (기존 번호는 이력 포함해 재사용 안 함) */
export async function alignItemStockLots(
  supabase: SupabaseClient,
  userId: string,
  item: ItemRow,
): Promise<AlignItemResult> {
  const result: AlignItemResult = {
    itemId: item.id,
    filledCodes: 0,
    splitUnits: 0,
    addedLots: 0,
    trimmedCodes: 0,
  }

  const itemBase = resolveItemLotBase(item.barcode_code, item.id)
  const { knownCodes } = await fetchAllKnownLotCodesForItem(supabase, userId, item.id)
  const usedLower = uniqueLower(knownCodes)

  const { data: lotRows } = await supabase
    .from('item_stock_lots')
    .select('id, quantity, lot_code, created_at')
    .eq('user_id', userId)
    .eq('item_id', item.id)
    .order('created_at', { ascending: true })

  const lots = (lotRows ?? []) as LotRow[]

  for (const lot of lots) {
    const trimmed = (lot.lot_code ?? '').trim()
    if (lot.lot_code && trimmed !== lot.lot_code) {
      await supabase.from('item_stock_lots').update({ lot_code: trimmed }).eq('id', lot.id).eq('user_id', userId)
      result.trimmedCodes += 1
      lot.lot_code = trimmed
      if (trimmed) usedLower.add(trimmed.toLowerCase())
    }
  }

  const activeLots = lots.filter(l => l.quantity > 0)

  for (const lot of [...activeLots]) {
    if (lot.quantity <= 1) continue
    const qty = lot.quantity
    const codes = nextUniqueCodes(itemBase, knownCodes, usedLower, qty)
    await supabase.from('item_stock_lots').delete().eq('id', lot.id).eq('user_id', userId)
    const inserts = codes.map(code => ({
      user_id: userId,
      item_id: item.id,
      quantity: 1,
      lot_code: code,
      note: '[QR정합]',
      created_at: lot.created_at || new Date().toISOString(),
    }))
    if (inserts.length > 0) {
      await supabase.from('item_stock_lots').insert(inserts)
      result.splitUnits += qty
    }
  }

  const { data: lotsAfterSplit } = await supabase
    .from('item_stock_lots')
    .select('id, quantity, lot_code, created_at')
    .eq('user_id', userId)
    .eq('item_id', item.id)
    .order('created_at', { ascending: true })

  for (const lot of (lotsAfterSplit ?? []) as LotRow[]) {
    if (lot.quantity <= 0) continue
    const code = (lot.lot_code ?? '').trim()
    if (code) {
      usedLower.add(code.toLowerCase())
      continue
    }
    const [next] = nextUniqueCodes(itemBase, knownCodes, usedLower, 1)
    if (!next) continue
    await supabase.from('item_stock_lots').update({ lot_code: next, note: '[QR정합]' }).eq('id', lot.id).eq('user_id', userId)
    knownCodes.push(next)
    result.filledCodes += 1
  }

  const targetQty = Math.max(0, Math.floor(Number(item.quantity) || 0))
  const { data: lotsNow } = await supabase
    .from('item_stock_lots')
    .select('quantity')
    .eq('user_id', userId)
    .eq('item_id', item.id)
    .gt('quantity', 0)

  const lotQtySum = (lotsNow ?? []).reduce((s, r) => s + Math.max(0, Number(r.quantity) || 0), 0)
  const need = targetQty - lotQtySum
  if (need > 0 && itemBase) {
    const codes = nextUniqueCodes(itemBase, knownCodes, usedLower, need)
    const now = new Date().toISOString()
    const inserts = codes.map(code => ({
      user_id: userId,
      item_id: item.id,
      quantity: 1,
      lot_code: code,
      note: '[QR정합]',
      created_at: now,
    }))
    if (inserts.length > 0) {
      await supabase.from('item_stock_lots').insert(inserts)
      result.addedLots += inserts.length
    }
  }

  const { data: finalLots } = await supabase
    .from('item_stock_lots')
    .select('quantity')
    .eq('user_id', userId)
    .eq('item_id', item.id)

  const syncedQty = (finalLots ?? []).reduce((s, r) => s + Math.max(0, Number(r.quantity) || 0), 0)
  await supabase.from('items').update({ quantity: syncedQty, updated_at: new Date().toISOString() }).eq('id', item.id).eq('user_id', userId)

  return result
}

export async function alignAllUserStockLots(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ alignedItems: number; results: AlignItemResult[] }> {
  const { data: items } = await supabase
    .from('items')
    .select('id, name, quantity, barcode_code, created_at')
    .eq('user_id', userId)

  const results: AlignItemResult[] = []
  for (const item of (items ?? []) as ItemRow[]) {
    const r = await alignItemStockLots(supabase, userId, item)
    if (r.filledCodes + r.splitUnits + r.addedLots + r.trimmedCodes > 0) {
      results.push(r)
    }
  }
  return { alignedItems: results.length, results }
}

/** 라벨 #번호가 lot 목록과 맞는지 (스캔 없이 DB만 점검) */
export function lotIndicesFromRows(lots: Array<{ lot_code: string | null; quantity: number }>): number[] {
  const indices: number[] = []
  for (const lot of lots) {
    const qty = Math.max(0, Math.floor(Number(lot.quantity) || 0))
    if (qty <= 0) continue
    const code = (lot.lot_code ?? '').trim()
    if (!code) continue
    const n = parseUnitSuffixIndex(code)
    if (n !== null) indices.push(n)
  }
  return indices.sort((a, b) => a - b)
}

export function expandKnownCodesFromTransactions(
  lotCodes: string[],
  txFields: Array<string | null | undefined>,
): string[] {
  const set = new Set(lotCodes)
  for (const field of txFields) {
    for (const c of expandLotCodeField(field)) set.add(c)
  }
  return Array.from(set)
}
