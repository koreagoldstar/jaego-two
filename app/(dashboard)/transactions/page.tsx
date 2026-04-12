import { createClient } from '@/lib/supabase/server'
import type { StockTransaction } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

type Row = StockTransaction & { items: { name: string } | null }

export default async function TransactionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: rows } = await supabase
    .from('stock_transactions')
    .select('id, direction, amount, note, created_at, items(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  const list = (rows ?? []) as unknown as Row[]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">입출고 이력</h1>
        <p className="text-sm text-slate-500">최근 200건</p>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-slate-500 rounded-2xl border border-dashed border-slate-300 p-8 text-center bg-white">
          기록이 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map(tx => (
            <li
              key={tx.id}
              className="rounded-2xl bg-white border border-slate-200 px-4 py-3 shadow-sm flex justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900 truncate">{tx.items?.name ?? '품목'}</p>
                <p className="text-xs text-slate-400">
                  {new Date(tx.created_at).toLocaleString('ko-KR')}
                  {tx.note ? ` · ${tx.note}` : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span
                  className={`inline-block font-semibold tabular-nums ${
                    tx.direction === 'in' ? 'text-emerald-600' : 'text-orange-600'
                  }`}
                >
                  {tx.direction === 'in' ? '+' : '−'}
                  {tx.amount}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
