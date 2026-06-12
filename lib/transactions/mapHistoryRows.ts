import { buildTransactionQrDetailLines } from '@/lib/items/transactionQrDisplay'
import type { HistoryRow } from '@/components/transactions/TransactionsHistoryClient'

type StockTxRow = {
  id: string
  direction: 'in' | 'out'
  amount: number
  note: string | null
  project: string | null
  lot_code: string | null
  created_at: string
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

export function mapStockTransactionsToHistoryRows(list: StockTxRow[]): HistoryRow[] {
  return list.map(tx => ({
    kind: 'stock' as const,
    key: `tx-${tx.id}`,
    rawId: tx.id,
    created_at: tx.created_at,
    title: tx.items?.name ?? '품목',
    subtitle: [tx.project, tx.note].filter(Boolean).join(' · '),
    detailLines: [
      `구분: ${tx.direction === 'in' ? '입고' : '출고'}`,
      ...buildTransactionQrDetailLines(tx.lot_code, tx.items?.barcode_code ?? null, tx.amount),
    ],
    amountText: `${tx.direction === 'in' ? '+' : '−'}${tx.amount}`,
    amountClass: tx.direction === 'in' ? 'text-emerald-600' : 'text-orange-600',
    direction: tx.direction,
    amount: tx.amount,
    note: tx.note ?? '',
    project: tx.project ?? '',
  }))
}

export function mapInventoryEventsToHistoryRows(events: InventoryEventRow[]): HistoryRow[] {
  return events.map(ev => ({
    kind: 'inventory' as const,
    key: `ev-${ev.id}`,
    rawId: ev.id,
    created_at: ev.created_at,
    title: ev.item_name,
    subtitle: ev.detail ?? '',
    detailLines: [`구분: ${ev.event_type === 'item_create' ? '품목 등록' : '품목 삭제'}`],
    amountText: ev.event_type === 'item_create' ? `+등록 ${ev.quantity}` : `-삭제 ${ev.quantity}`,
    amountClass: ev.event_type === 'item_create' ? 'text-blue-600' : 'text-rose-600',
    event_type: ev.event_type,
    item_name: ev.item_name,
    quantity: ev.quantity,
    detail: ev.detail ?? '',
    kindLabel:
      ev.event_type === 'item_create'
        ? '유형: 품목 등록 (표시용 이력)'
        : '유형: 품목 삭제 (표시용 이력)',
  }))
}

export function mergeHistoryRows(stock: HistoryRow[], inventory: HistoryRow[]): HistoryRow[] {
  return [...stock, ...inventory].sort((a, b) => b.created_at.localeCompare(a.created_at))
}
