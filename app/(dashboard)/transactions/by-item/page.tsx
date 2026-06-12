import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { mergeProjectNameOptions } from '@/lib/projects/projectOptions'
import { ItemTransactionsClient } from '@/components/transactions/ItemTransactionsClient'

export const dynamic = 'force-dynamic'

export default async function TransactionsByItemPage({
  searchParams,
}: {
  searchParams?: { item?: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [itemsRes, planRes, txRes] = await Promise.all([
    supabase.from('items').select('id, name, barcode_code, quantity').eq('user_id', user.id).order('name'),
    supabase.from('project_usage_plans').select('project_name').eq('user_id', user.id),
    supabase.from('stock_transactions').select('project').eq('user_id', user.id).not('project', 'is', null),
  ])

  const items = (itemsRes.data ?? []).map(row => ({
    id: row.id,
    name: row.name,
    barcode_code: row.barcode_code,
    quantity: row.quantity ?? 0,
  }))

  const planNames = (planRes.data ?? []).map(r => (r.project_name ?? '').trim()).filter(Boolean)
  const txProjectNames = (txRes.data ?? []).map(r => (r.project ?? '').trim()).filter(Boolean)
  const projectOptions = mergeProjectNameOptions(planNames, txProjectNames)

  const initialItemId = searchParams?.item?.trim() ?? ''
  const validInitial = items.some(i => i.id === initialItemId) ? initialItemId : undefined

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm mb-1">
          <Link href="/transactions" className="text-blue-600 hover:underline">
            ← 전체 입출고 이력
          </Link>
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">제품별 입출고 이력</h1>
            <p className="text-sm text-slate-500">제품을 검색·선택하면 해당 품목의 입·출고 내역만 모아서 볼 수 있습니다.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 flex flex-wrap items-center gap-2 shrink-0">
            <span className="text-sm font-medium text-slate-800">엑셀</span>
            <a
              href="/api/transactions/export"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              전체 이력
            </a>
            <a
              href="/api/transactions/export?mode=by-item"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              제품별 시트
            </a>
          </div>
        </div>
      </div>

      <Suspense fallback={<div className="text-center text-slate-500 py-8">로딩…</div>}>
        <ItemTransactionsClient items={items} projectOptions={projectOptions} initialItemId={validInitial} />
      </Suspense>
    </div>
  )
}
