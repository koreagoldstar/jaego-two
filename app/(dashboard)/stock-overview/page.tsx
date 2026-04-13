import { createClient } from '@/lib/supabase/server'
import type { Item } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

type PlanSumRow = {
  project_name: string
  install_date: string | null
  item_id: string
  planned_qty: number
}

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
  const allProjects = Array.from(new Set(plans.map(p => p.project_name).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  )

  const selectedProject = (searchParams?.project ?? '').trim()
  const filteredPlans = selectedProject
    ? plans.filter(row => row.project_name === selectedProject)
    : plans

  const plannedByItem = new Map<string, number>()
  for (const row of filteredPlans) {
    plannedByItem.set(row.item_id, (plannedByItem.get(row.item_id) ?? 0) + (row.planned_qty ?? 0))
  }

  const rows = items.map(item => {
    const currentQty = item.quantity ?? 0
    const plannedQty = plannedByItem.get(item.id) ?? 0
    const remainQty = currentQty - plannedQty
    return {
      id: item.id,
      name: item.name,
      sh: item.sh ?? '',
      currentQty,
      plannedQty,
      remainQty,
    }
  })

  const totalCurrent = rows.reduce((s, r) => s + r.currentQty, 0)
  const totalPlanned = rows.reduce((s, r) => s + r.plannedQty, 0)
  const totalRemain = rows.reduce((s, r) => s + r.remainQty, 0)

  const projectMetaMap = new Map<string, string | null>()
  for (const plan of filteredPlans) {
    const existing = projectMetaMap.get(plan.project_name)
    if (!existing && plan.install_date) {
      projectMetaMap.set(plan.project_name, plan.install_date)
    } else if (!projectMetaMap.has(plan.project_name)) {
      projectMetaMap.set(plan.project_name, plan.install_date ?? null)
    }
  }

  const projectColumns = Array.from(projectMetaMap.entries())
    .map(([project, installDate]) => ({ project, installDate }))
    .sort((a, b) => {
      if (a.installDate && b.installDate) return a.installDate.localeCompare(b.installDate) || a.project.localeCompare(b.project)
      if (a.installDate) return -1
      if (b.installDate) return 1
      return a.project.localeCompare(b.project)
    })

  const plannedMatrix = new Map<string, Map<string, number>>()
  for (const plan of filteredPlans) {
    const byProject = plannedMatrix.get(plan.item_id) ?? new Map<string, number>()
    byProject.set(plan.project_name, (byProject.get(plan.project_name) ?? 0) + (plan.planned_qty ?? 0))
    plannedMatrix.set(plan.item_id, byProject)
  }

  const itemProjectRows = items.map(item => {
    const byProject = plannedMatrix.get(item.id) ?? new Map<string, number>()
    const plannedTotal = Array.from(byProject.values()).reduce((s, v) => s + v, 0)
    return {
      id: item.id,
      name: item.name,
      sh: item.sh ?? '',
      currentQty: item.quantity ?? 0,
      byProject,
      remainQty: (item.quantity ?? 0) - plannedTotal,
    }
  })

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
