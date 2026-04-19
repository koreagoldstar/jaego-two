import { createClient } from '@/lib/supabase/server'
import type { Item } from '@/lib/supabase/types'
import { buildStockOverview, type PlanSumRow } from '@/lib/stockOverview'

export const dynamic = 'force-dynamic'

export default async function StockOverviewPage({
  searchParams,
}: {
  searchParams?: { project?: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [itemsRes, plansRes] = await Promise.all([
    supabase.from('items').select('id, name, quantity, sh').eq('user_id', user.id).order('name'),
    supabase
      .from('project_usage_plans')
      .select('project_name, install_date, item_id, planned_qty')
      .eq('user_id', user.id),
  ])

  const items = (itemsRes.data ?? []) as Item[]
  const plans = (plansRes.data ?? []) as PlanSumRow[]
  const selectedProject = (searchParams?.project ?? '').trim()

  const { allProjects, rows, totalCurrent, totalPlanned, totalRemain, projectColumns, itemProjectRows } =
    buildStockOverview(items, plans, selectedProject)

  const exportQuery = selectedProject ? `?project=${encodeURIComponent(selectedProject)}` : ''

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">재고 요약표</h1>
        <p className="text-sm text-slate-500">품목별 현재재고 · 사용예정 · 잔여수량을 한 번에 확인합니다.</p>
      </div>

      <form method="get" className="rounded-xl border border-slate-200 bg-white p-3 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">프로젝트 필터</label>
          <select
            name="project"
            defaultValue={selectedProject}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white min-w-56"
          >
            <option value="">전체 프로젝트(합산)</option>
            {allProjects.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-lg bg-slate-900 text-white px-3 py-2 text-sm font-medium">
          적용
        </button>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-slate-800 mr-1">엑셀 다운로드</p>
        <a
          href={`/api/stock-overview/export${exportQuery}${exportQuery ? '&' : '?'}type=items`}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          품목 요약
        </a>
        <a
          href={`/api/stock-overview/export${exportQuery}${exportQuery ? '&' : '?'}type=matrix`}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          프로젝트 전체 요약
        </a>
        <span className="text-xs text-slate-500">현재 필터(프로젝트)와 동일한 데이터가 내려갑니다.</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">전체 현재재고</p>
          <p className="text-xl font-semibold text-slate-900 tabular-nums">{totalCurrent}</p>
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
          <p className="text-xs text-violet-700">전체 사용예정</p>
          <p className="text-xl font-semibold text-violet-700 tabular-nums">{totalPlanned}</p>
        </div>
        <div className={`rounded-xl border p-3 ${totalRemain < 0 ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <p className={`text-xs ${totalRemain < 0 ? 'text-red-700' : 'text-emerald-700'}`}>전체 잔여수량</p>
          <p className={`text-xl font-semibold tabular-nums ${totalRemain < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{totalRemain}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2.5 px-3">품목</th>
              <th className="py-2.5 px-3">SH</th>
              <th className="py-2.5 px-3 text-right">현재재고</th>
              <th className="py-2.5 px-3 text-right">사용예정</th>
              <th className="py-2.5 px-3 text-right">잔여수량</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2.5 px-3 text-slate-900">{row.name}</td>
                <td className="py-2.5 px-3 text-slate-500">{row.sh || '-'}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{row.currentQty}</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-violet-700">{row.plannedQty}</td>
                <td className={`py-2.5 px-3 text-right tabular-nums font-medium ${row.remainQty < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {row.remainQty}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  품목 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
        <div className="px-3 pt-3">
          <h2 className="text-base font-semibold text-slate-900">프로젝트 전체 요약 (설치일정 순)</h2>
          <p className="text-xs text-slate-500 mt-0.5">품목별 현재수량과 프로젝트별 사용예정, 잔여수량을 한 번에 보여줍니다.</p>
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2.5 px-3">품목</th>
              <th className="py-2.5 px-3 text-right">현재재고</th>
              {projectColumns.map(col => (
                <th key={col.project} className="py-2.5 px-3 text-right whitespace-nowrap">
                  <div className="flex flex-col items-end leading-tight">
                    <span>{col.project}</span>
                    <span className="text-[11px] text-slate-400">{col.installDate || '미정'}</span>
                  </div>
                </th>
              ))}
              <th className="py-2.5 px-3 text-right">잔여수량</th>
            </tr>
          </thead>
          <tbody>
            {itemProjectRows.map(row => (
              <tr key={row.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2.5 px-3 text-slate-900 whitespace-nowrap">
                  {row.name}
                  {row.sh ? <span className="text-slate-400 text-xs ml-1">({row.sh})</span> : null}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums">{row.currentQty}</td>
                {projectColumns.map(col => (
                  <td key={`${row.id}-${col.project}`} className="py-2.5 px-3 text-right tabular-nums text-violet-700">
                    {row.byProject.get(col.project) ?? 0}
                  </td>
                ))}
                <td className={`py-2.5 px-3 text-right tabular-nums font-medium ${row.remainQty < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {row.remainQty}
                </td>
              </tr>
            ))}
            {itemProjectRows.length === 0 && (
              <tr>
                <td colSpan={projectColumns.length + 3} className="py-8 text-center text-slate-500">
                  프로젝트 예정 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
