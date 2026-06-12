import { formatTransactionQrDisplay } from '@/lib/items/transactionQrDisplay'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { StockTransaction } from '@/lib/supabase/types'
import * as XLSX from 'xlsx'

export const EXPORT_LIMIT = 5000

export const EXPORT_HEADERS = ['일시', '구분', '품목', '변동수량', '프로젝트·현장', '메모', 'QR코드'] as const

export type ExportLine = {
  created_at: string
  category: string
  itemName: string
  qtySigned: number
  project: string
  note: string
  qr: string
}

type TxRow = StockTransaction & {
  items: { name: string; barcode_code: string | null } | null
}

type InventoryEventRow = {
  id: string
  event_type: 'item_create' | 'item_delete'
  item_name: string
  quantity: number
  detail: string | null
  created_at: string
}

type ItemRow = { id: string; name: string }

export function linesToAoa(lines: ExportLine[]): unknown[][] {
  return [
    [...EXPORT_HEADERS],
    ...lines.map(l => [
      new Date(l.created_at).toLocaleString('ko-KR'),
      l.category,
      l.itemName,
      l.qtySigned,
      l.project,
      l.note,
      l.qr,
    ]),
  ]
}

export function sortExportLines(lines: ExportLine[]): ExportLine[] {
  return [...lines].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

function stockRowsToLines(list: TxRow[]): ExportLine[] {
  return list.map(tx => ({
    created_at: tx.created_at,
    category: tx.direction === 'in' ? '입고' : '출고',
    itemName: tx.items?.name ?? '품목',
    qtySigned: tx.direction === 'in' ? tx.amount : -tx.amount,
    project: tx.project ?? '',
    note: tx.note ?? '',
    qr: formatTransactionQrDisplay(tx.lot_code, tx.items?.barcode_code ?? null, tx.amount),
  }))
}

function inventoryRowsToLines(events: InventoryEventRow[]): ExportLine[] {
  return events.map(ev => ({
    created_at: ev.created_at,
    category: ev.event_type === 'item_create' ? '품목 등록' : '품목 삭제',
    itemName: ev.item_name,
    qtySigned: ev.event_type === 'item_create' ? ev.quantity : -ev.quantity,
    project: '',
    note: ev.detail ?? '',
    qr: '',
  }))
}

export async function fetchStockTransactionRows(
  supabase: SupabaseClient,
  userId: string,
  options: { itemId?: string } = {},
): Promise<TxRow[]> {
  let query = supabase
    .from('stock_transactions')
    .select('id, direction, amount, note, project, lot_code, created_at, item_id, items(name, barcode_code)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(EXPORT_LIMIT)

  if (options.itemId) {
    query = query.eq('item_id', options.itemId)
  }

  const { data } = await query
  return (data ?? []) as unknown as TxRow[]
}

export async function fetchInventoryEventRows(
  supabase: SupabaseClient,
  userId: string,
  options: { itemName?: string } = {},
): Promise<InventoryEventRow[]> {
  let query = supabase
    .from('inventory_events')
    .select('id, event_type, item_name, quantity, detail, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(EXPORT_LIMIT)

  if (options.itemName) {
    query = query.eq('item_name', options.itemName)
  }

  const { data, error } = await query
  if (error) return []
  return (data ?? []) as InventoryEventRow[]
}

export async function buildExportLines(
  supabase: SupabaseClient,
  userId: string,
  options: { itemId?: string; itemName?: string } = {},
): Promise<ExportLine[]> {
  const [stockRows, invRows] = await Promise.all([
    fetchStockTransactionRows(supabase, userId, { itemId: options.itemId }),
    fetchInventoryEventRows(supabase, userId, { itemName: options.itemName }),
  ])
  return sortExportLines([...stockRowsToLines(stockRows), ...inventoryRowsToLines(invRows)])
}

export function sanitizeSheetName(raw: string): string {
  const cleaned = raw.replace(/[\\/?*[\]:]/g, '-').trim() || '품목'
  return cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned
}

export function uniqueSheetName(base: string, used: Set<string>): string {
  const name = sanitizeSheetName(base)
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  for (let i = 2; i < 100; i++) {
    const suffix = `-${i}`
    const trimmed = sanitizeSheetName(base).slice(0, Math.max(1, 31 - suffix.length)) + suffix
    if (!used.has(trimmed)) {
      used.add(trimmed)
      return trimmed
    }
  }
  const fallback = `품목-${used.size + 1}`
  used.add(fallback)
  return fallback
}

export function workbookToBuffer(wb: XLSX.WorkBook): Buffer {
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

export function buildSingleSheetWorkbook(lines: ExportLine[], sheetName: string): Buffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(linesToAoa(lines))
  XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(sheetName))
  return workbookToBuffer(wb)
}

export async function buildByItemWorkbook(supabase: SupabaseClient, userId: string): Promise<Buffer> {
  const [{ data: items }, stockRows, invRows] = await Promise.all([
    supabase.from('items').select('id, name').eq('user_id', userId).order('name'),
    fetchStockTransactionRows(supabase, userId),
    fetchInventoryEventRows(supabase, userId),
  ])

  const itemList = (items ?? []) as ItemRow[]
  const itemNameById = new Map(itemList.map(i => [i.id, i.name]))
  const linesByItem = new Map<string, ExportLine[]>()

  const ensure = (key: string) => {
    if (!linesByItem.has(key)) linesByItem.set(key, [])
    return linesByItem.get(key)!
  }

  for (const tx of stockRows) {
    const name = tx.items?.name ?? itemNameById.get(tx.item_id) ?? '품목'
    ensure(name).push(...stockRowsToLines([tx]))
  }

  for (const ev of invRows) {
    ensure(ev.item_name).push(...inventoryRowsToLines([ev]))
  }

  const wb = XLSX.utils.book_new()
  const usedNames = new Set<string>()

  const sortedKeys = Array.from(linesByItem.keys()).sort((a, b) => a.localeCompare(b, 'ko'))
  for (const itemName of sortedKeys) {
    const lines = sortExportLines(linesByItem.get(itemName) ?? [])
    if (lines.length === 0) continue
    const sheetName = uniqueSheetName(itemName, usedNames)
    const ws = XLSX.utils.aoa_to_sheet(linesToAoa(lines))
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }

  if (wb.SheetNames.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([['이력 없음']])
    XLSX.utils.book_append_sheet(wb, ws, '이력없음')
  }

  return workbookToBuffer(wb)
}

export function sanitizeFilenamePart(raw: string): string {
  return raw.replace(/[/\\?%*:|"<>]/g, '-').trim().slice(0, 48) || 'item'
}
