import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { mergeProjectNameOptions } from '@/lib/projects/projectOptions'
import {
  mapInventoryEventsToHistoryRows,
  mapStockTransactionsToHistoryRows,
  mergeHistoryRows,
} from '@/lib/transactions/mapHistoryRows'
import type { StockTransaction } from '@/lib/supabase/types'
import { TransactionsHistoryClient } from '@/components/transactions/TransactionsHistoryClient'

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

export default async function TransactionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [txRes, planRes] = await Promise.all([
    supabase
      .from('stock_transactions')
      .select('id, direction, amount, note, project, lot_code, created_at, items(name, barcode_code)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('project_usage_plans').select('project_name').eq('user_id', user.id),
  ])

  const list = (txRes.data ?? []) as unknown as Row[]
  const planNames = (planRes.data ?? []).map(r => (r.project_name ?? '').trim()).filter(Boolean)
  const txProjectNames = list.map(tx => (tx.project ?? '').trim()).filter(Boolean)
  const projectOptions = mergeProjectNameOptions(planNames, txProjectNames)
  const { data: eventRows, error: eventError } = await supabase
    .from('inventory_events')
    .select('id, event_type, item_name, quantity, detail, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  const inventoryEvents = eventError ? [] : ((eventRows ?? []) as InventoryEventRow[])

  const historyRows = mergeHistoryRows(
    mapStockTransactionsToHistoryRows(list),
    mapInventoryEventsToHistoryRows(inventoryEvents),
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">입출고 이력</h1>
          <p className="text-sm text-slate-500">
            최근 200건 · 프로젝트별로 묶어 보기 · 항목을 누르면 상세가 펼쳐집니다
          </p>
          <p className="text-sm mt-1">
            <Link href="/transactions/by-item" className="text-blue-600 font-medium hover:underline">
              제품별 입출고 이력 보기
            </Link>
          </p>
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
        <TransactionsHistoryClient rows={historyRows} projectOptions={projectOptions} />
      )}
    </div>
  )
}
