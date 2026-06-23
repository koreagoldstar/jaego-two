import { createClient } from '@/lib/supabase/server'
import type { Item } from '@/lib/supabase/types'
import { buildCompletedProjectSet } from '@/lib/projects/projectStatus'
import type { ProjectStatusRow } from '@/lib/projects/projectStatus'
import { buildStockOverview, type PlanSumRow, type ShippedTxRow } from '@/lib/stockOverview'

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

  const [itemsRes, plansRes, txRes, statusRes] = await Promise.all([
    supabase.from('items').select('id, name, quantity, sh').eq('user_id', user.id).order('name'),
    supabase
      .from('project_usage_plans')
      .select('project_name, install_date, item_id, planned_qty')
      .eq('user_id', user.id),
    supabase
      .from('stock_transactions')
      .select('id, project, item_id, direction, amount, created_at')
      .eq('user_id', user.id),
    supabase.from('project_status').select('project_name, completed_at').eq('user_id', user.id),
  ])

  const items = (itemsRes.data ?? []) as Item[]
  const plans = (plansRes.data ?? []) as PlanSumRow[]
  const allTxRows = txRes.data ?? []
  const transactions = allTxRows.filter(
    tx => (tx.project ?? '').trim() !== '',
  ) as ShippedTxRow[]
  const completedProjects = buildCompletedProjectSet((statusRes.data ?? []) as ProjectStatusRow[])
  const selectedProject = (searchParams?.project ?? '').trim()

  const { allProjects, rows, totalCurrent, totalPlanned, totalRemain, projectColumns, itemProjectRows } =
    buildStockOverview(items, plans, selectedProject, transactions, completedProjects)

  const exportQuery = selectedProject ? `?project=${encodeURIComponent(selectedProject)}` : ''

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">재고 요약표</h1>
        <p className="text-sm text-slate-500">
          품목별 현재재고 · 사용예정(출고 반영 잔여) · 잔여수량을 한 번에 확인합니다.
        </p>
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
          <p className="text-xs text-violet-700">전체 사용예정(잔)</p>
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
              <th className="py-2.5 px-3 text-right">사용예정(잔)</th>
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

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-3 pt-3 pb-2">
          <h2 className="text-base font-semibold text-slate-900">프로젝트 전체 요약 (설치일정 순)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            프로젝트별 사용예정(출고 반영 잔여)입니다. 가로·세로 스크롤로 전체를 볼 수 있습니다.
          </p>
        </div>
        <div className="overflow-auto max-h-[min(70vh,720px)] border-t border-slate-100">
          <table className="text-xs border-separate border-spacing-0">
            <thead className="sticky top-0 z-20 bg-white">
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="sticky left-0 z-30 bg-white py-2 px-2 w-32 border-b border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                  품목
                </th>
                <th className="sticky left-32 z-30 bg-white py-2 px-2 text-right w-14 border-b border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                  재고
                </th>
                {projectColumns.map(col => (
                  <th
                    key={col.project}
                    className="py-2 px-1 text-right align-bottom min-w-[2.75rem] max-w-[2.75rem] border-b border-slate-200"
                    title={`${col.project} (설치: ${col.installDate || '미정'})`}
                  >
                    <div className="mx-auto w-[2.5rem] overflow-hidden">
                      <span
                        className="block text-[10px] font-medium text-slate-700 leading-none"
                        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', maxHeight: '4.5rem' }}
                      >
                        {col.project}
                      </span>
                    </div>
                    <span className="block text-[9px] text-slate-400 mt-1 tabular-nums">
                      {col.installDate ? col.installDate.slice(5) : '미정'}
                    </span>
                  </th>
                ))}
                <th className="sticky right-0 z-30 bg-emerald-50 py-2 px-2 text-right min-w-[3.25rem] border-b border-slate-200 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                  잔여
                </th>
              </tr>
            </thead>
            <tbody>
              {itemProjectRows.map(row => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="sticky left-0 z-10 bg-white py-1.5 px-2 w-32 text-slate-900 border-b border-slate-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                    <span className="block truncate" title={row.name}>
                      {row.name}
                    </span>
                    {row.sh ? <span className="text-slate-400 text-[10px]">{row.sh}</span> : null}
                  </td>
                  <td className="sticky left-32 z-10 bg-white py-1.5 px-2 w-14 text-right tabular-nums border-b border-slate-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                    {row.currentQty}
                  </td>
                  {projectColumns.map(col => {
                    const qty = row.byProject.get(col.project) ?? 0
                    return (
                      <td
                        key={`${row.id}-${col.project}`}
                        className={`py-1.5 px-1 text-center tabular-nums border-b border-slate-100 ${qty > 0 ? 'text-violet-700' : 'text-slate-300'}`}
                      >
                        {qty > 0 ? qty : '·'}
                      </td>
                    )
                  })}
                  <td
                    className={`sticky right-0 z-10 py-1.5 px-2 text-right tabular-nums font-medium border-b border-slate-100 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.06)] ${
                      row.remainQty < 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
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
    </div>
  )
}
