import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { mergeProjectNameOptions } from '@/lib/projects/projectOptions'
import {
  PROJECT_NONE_KEY,
  ProjectTransactionsClient,
} from '@/components/transactions/ProjectTransactionsClient'

export const dynamic = 'force-dynamic'

export default async function TransactionsByProjectPage({
  searchParams,
}: {
  searchParams?: { project?: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [planRes, txRes] = await Promise.all([
    supabase.from('project_usage_plans').select('project_name').eq('user_id', user.id),
    supabase.from('stock_transactions').select('project').eq('user_id', user.id).not('project', 'is', null),
  ])

  const planNames = (planRes.data ?? []).map(r => (r.project_name ?? '').trim()).filter(Boolean)
  const txProjectNames = (txRes.data ?? []).map(r => (r.project ?? '').trim()).filter(Boolean)
  const projectOptions = mergeProjectNameOptions(planNames, txProjectNames)

  const rawProject = searchParams?.project?.trim() ?? ''
  const validInitial =
    rawProject === PROJECT_NONE_KEY || projectOptions.includes(rawProject) ? rawProject : undefined

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
            <h1 className="text-xl font-bold text-slate-900">프로젝트별 입출고 이력</h1>
            <p className="text-sm text-slate-500">
              프로젝트·현장을 선택하면 해당 프로젝트로 기록된 입·출고만 모아서 볼 수 있습니다.
            </p>
            <p className="text-sm mt-1 flex flex-wrap gap-x-3 gap-y-1">
              <Link href="/transactions/by-item" className="text-blue-600 font-medium hover:underline">
                제품별 입출고 이력
              </Link>
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 flex flex-wrap items-center gap-2 shrink-0">
            <span className="text-sm font-medium text-slate-800">엑셀</span>
            <a
              href="/api/transactions/export"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              전체 이력
            </a>
          </div>
        </div>
      </div>

      <Suspense fallback={<div className="text-center text-slate-500 py-8">로딩…</div>}>
        <ProjectTransactionsClient projectOptions={projectOptions} initialProject={validInitial} />
      </Suspense>
    </div>
  )
}
