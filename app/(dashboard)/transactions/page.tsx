import { createClient } from '@/lib/supabase/server'
import type { StockTransaction } from '@/lib/supabase/types'
import { TransactionsHistoryClient, type HistoryRow } from '@/components/transactions/TransactionsHistoryClient'

export const dynamic = 'force-dynamic'

type Row = StockTransaction & {
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

function formatPrintValue(baseBarcode: string, amount: number) {
  const safeAmount = Math.max(1, amount)
  if (safeAmount === 1) return baseBarcode
  return `${baseBarcode}-001 ~ ${baseBarcode}-${String(safeAmount).padStart(3, '0')}`
}

export default async function TransactionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: rows } = await supabase
    .from('stock_transactions')
    .select('id, direction, amount, note, project, created_at, items(name, barcode_code)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  const list = (rows ?? []) as unknown as Row[]
  const { data: eventRows, error: eventError } = await supabase
    .from('inventory_events')
    .select('id, event_type, item_name, quantity, detail, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  const inventoryEvents = eventError ? [] : ((eventRows ?? []) as InventoryEventRow[])

  const historyRows: HistoryRow[] = [
    ...list.map(tx => ({
      kind: 'stock' as const,
      key: `tx-${tx.id}`,
      rawId: tx.id,
      created_at: tx.created_at,
      title: tx.items?.name ?? '품목',
      subtitle: [tx.project, tx.note].filter(Boolean).join(' · '),
      detailLines: [
        `구분: ${tx.direction === 'in' ? '입고' : '출고'}`,
        tx.direction === 'out' && tx.items?.barcode_code ? `QR 코드: ${tx.items.barcode_code}` : '',
        tx.direction === 'out' && tx.items?.barcode_code ? `QR 옆 숫자: ${tx.amount}` : '',
        tx.direction === 'out' && tx.items?.barcode_code
          ? `인쇄값: ${formatPrintValue(tx.items.barcode_code, tx.amount)}`
          : '',
      ].filter(Boolean),
      amountText: `${tx.direction === 'in' ? '+' : '−'}${tx.amount}`,
      amountClass: tx.direction === 'in' ? 'text-emerald-600' : 'text-orange-600',
      direction: tx.direction,
      amount: tx.amount,
      note: tx.note ?? '',
      project: tx.project ?? '',
    })),
    ...inventoryEvents.map(ev => ({
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
    })),
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">입출고 이력</h1>
          <p className="text-sm text-slate-500">최근 200건 · 카드에서 수정 가능 (입출고 금액/구분은 기록 참고용)</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 flex flex-wrap items-center gap-2 shrink-0">
          <span className="text-sm font-medium text-slate-800">엑셀</span>
          <a
            href="/api/transactions/export"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            입출고 이력 다운로드
          </a>
          <span className="text-xs text-slate-500">화면은 200건, 엑셀은 유형별 최대 5,000건까지.</span>
        </div>
      </div>

      {historyRows.length === 0 ? (
        <p className="text-sm text-slate-500 rounded-2xl border border-dashed border-slate-300 p-8 text-center bg-white">
          기록이 없습니다.
        </p>
      ) : (
        <TransactionsHistoryClient rows={historyRows} />
      )}
    </div>
  )
}
