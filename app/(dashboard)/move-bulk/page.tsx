import { BulkOutClient } from '@/components/BulkOutClient'
import { BulkOutUndoPanel, type UndoOutboundRow } from '@/components/BulkOutUndoPanel'
import { kstTodayRangeIso } from '@/lib/time/kstDayRange'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type TxRow = {
  id: string
  created_at: string
  project: string | null
  amount: number
  lot_code: string | null
  item_id: string
  items: { name: string; barcode_code: string | null } | null
}

export default async function MoveBulkPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let undoRows: UndoOutboundRow[] = []
  const { label: dayLabel, start, end } = kstTodayRangeIso()

  if (user) {
    const { data } = await supabase
      .from('stock_transactions')
      .select('id, created_at, project, amount, lot_code, item_id, items(name, barcode_code)')
      .eq('user_id', user.id)
      .eq('direction', 'out')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: false })

    undoRows = ((data ?? []) as unknown as TxRow[]).map(row => ({
      id: row.id,
      created_at: row.created_at,
      project: row.project ?? '',
      amount: row.amount,
      lot_code: row.lot_code,
      item_name: row.items?.name ?? '품목',
      item_barcode: row.items?.barcode_code ?? null,
    }))
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">다중 스캔 일괄 출고</h1>
        <p className="text-sm text-slate-500">
          스캔한 QR 번호가 출고 이력에 그대로 기록됩니다. 잘못 출고한 건은 아래에서 되돌린 뒤 다시 스캔하세요.
        </p>
      </div>

      <BulkOutUndoPanel dayLabel={dayLabel} rows={undoRows} />

      <BulkOutClient />
    </div>
  )
}
