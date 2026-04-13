import { createClient } from '@/lib/supabase/server'
import type { StockTransaction } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

type Row = StockTransaction & {
  items: { name: string; sh: string | null; serial_number: string | null; barcode_code: string | null } | null
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

  const { data: rows } = await supabase
    .from('stock_transactions')
    .select('id, direction, amount, note, project, created_at, items(name, sh, serial_number, barcode_code)')
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
  const merged = [
    ...list.map(tx => ({
      id: `tx-${tx.id}`,
      created_at: tx.created_at,
      title: tx.items?.name ?? '품목',
      subtitle: [tx.project, tx.note].filter(Boolean).join(' · '),
      detailLines: [
        `구분: ${tx.direction === 'in' ? '입고' : '출고'}`,
        tx.items?.sh ? `SH: ${tx.items.sh}` : '',
        tx.items?.serial_number ? `시리얼: ${tx.items.serial_number}` : '',
        tx.items?.barcode_code ? `바코드: ${tx.items.barcode_code}` : '',
      ].filter(Boolean),
      amountText: `${tx.direction === 'in' ? '+' : '−'}${tx.amount}`,
      amountClass: tx.direction === 'in' ? 'text-emerald-600' : 'text-orange-600',
    })),
    ...inventoryEvents.map(ev => ({
      id: `ev-${ev.id}`,
      created_at: ev.created_at,
      title: ev.item_name,
      subtitle: ev.detail ?? '',
      detailLines: [`구분: ${ev.event_type === 'item_create' ? '품목 등록' : '품목 삭제'}`],
      amountText: ev.event_type === 'item_create' ? `+등록 ${ev.quantity}` : `-삭제 ${ev.quantity}`,
      amountClass: ev.event_type === 'item_create' ? 'text-blue-600' : 'text-rose-600',
    })),
  ]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 200)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">입출고 이력</h1>
        <p className="text-sm text-slate-500">최근 200건</p>
      </div>

      {merged.length === 0 ? (
        <p className="text-sm text-slate-500 rounded-2xl border border-dashed border-slate-300 p-8 text-center bg-white">
          기록이 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {merged.map(tx => (
            <li
              key={tx.id}
              className="rounded-2xl bg-white border border-slate-200 px-4 py-3 shadow-sm flex justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900 truncate">{tx.title}</p>
                <p className="text-xs text-slate-400">
                  {new Date(tx.created_at).toLocaleString('ko-KR')}
                  {tx.subtitle ? ` · ${tx.subtitle}` : ''}
                </p>
                {tx.detailLines.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {tx.detailLines.map(line => (
                      <p key={`${tx.id}-${line}`} className="text-[11px] text-slate-500 break-all">
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <span className={`inline-block font-semibold tabular-nums ${tx.amountClass}`}>{tx.amountText}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
