import { createClient } from '@/lib/supabase/server'
import { buildOutboundReconcileReport } from '@/lib/projects/outboundReconcile'
import { buildCompletedProjectSet, splitProjectNames } from '@/lib/projects/projectStatus'
import type { ProjectStatusRow } from '@/lib/projects/projectStatus'
import { buildShippedMap } from '@/lib/stockOverview'
import type { Item } from '@/lib/supabase/types'
import { ProjectOutboundHistory } from '@/components/projects/ProjectOutboundHistory'
import { ProjectOutboundReconcilePanel } from '@/components/projects/ProjectOutboundReconcilePanel'
import { ProjectPlanMultiForm } from '@/components/projects/ProjectPlanMultiForm'
import { ProjectPlanSection } from '@/components/projects/ProjectPlanSection'
import { normalizeProjectGroupKey } from '@/lib/history/groupByProject'

export const dynamic = 'force-dynamic'

type PlanRow = {
  project_name: string
  install_date: string | null
  item_id: string
  planned_qty: number
}

type TxRow = {
  created_at: string
  project: string | null
  item_id: string
  direction: 'in' | 'out'
  amount: number
  items: { name: string }[] | null
}

export default async function ProjectsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [itemsRes, planRes, txDisplayRes, txAggRes, statusRes] = await Promise.all([
    supabase.from('items').select('id, name, quantity').eq('user_id', user.id).order('name'),
    supabase
      .from('project_usage_plans')
      .select('project_name, install_date, item_id, planned_qty')
      .eq('user_id', user.id)
      .order('project_name')
      .order('created_at', { ascending: true }),
    supabase
      .from('stock_transactions')
      .select('created_at, project, item_id, direction, amount, items(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('stock_transactions')
      .select('id, created_at, project, item_id, direction, amount')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('project_status')
      .select('project_name, completed_at')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false }),
  ])

  const items = (itemsRes.data ?? []) as Item[]
  const plans = (planRes.data ?? []) as unknown as PlanRow[]
  const txRows = (txDisplayRes.data ?? []) as TxRow[]
  const txAggRows = txAggRes.data ?? []
  const statusRows = (statusRes.data ?? []) as ProjectStatusRow[]
  const itemById = new Map(items.map(item => [item.id, item] as const))
  const completedSet = buildCompletedProjectSet(statusRows)
  const completedAtByProject = new Map(statusRows.map(r => [r.project_name, r.completed_at] as const))

  const planError = planRes.error
  const statusMissing = statusRes.error?.message?.toLowerCase().includes('project_status')

  if (itemsRes.error || planError || txDisplayRes.error || txAggRes.error) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">프로젝트 사용예정 재고</h1>
          <p className="text-sm text-red-600">데이터를 불러오는 중 오류가 발생했습니다.</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {planError?.message?.includes('project_usage_plans')
            ? 'DB 마이그레이션(005_project_usage_plans.sql)이 아직 적용되지 않았습니다. Supabase SQL Editor에서 먼저 실행해주세요.'
            : planError?.message ??
              itemsRes.error?.message ??
              txDisplayRes.error?.message ??
              txAggRes.error?.message ??
              '알 수 없는 오류'}
        </div>
      </div>
    )
  }

  const shippedMap = buildShippedMap(txAggRows)
  const reconcileReport = buildOutboundReconcileReport(plans, txAggRows, completedSet)

  const grouped = new Map<string, Array<PlanRow & { shipped: number; remaining: number }>>()
  const projectInstallDate = new Map<string, string | null>()
  for (const row of plans) {
    const k = `${row.project_name}::${row.item_id}`
    const shipped = Math.max(0, shippedMap.get(k) ?? 0)
    const remaining = row.planned_qty - shipped
    const list = grouped.get(row.project_name) ?? []
    list.push({ ...row, shipped, remaining })
    grouped.set(row.project_name, list)
    if (!projectInstallDate.has(row.project_name)) {
      projectInstallDate.set(row.project_name, row.install_date ?? null)
    } else if (!projectInstallDate.get(row.project_name) && row.install_date) {
      projectInstallDate.set(row.project_name, row.install_date)
    }
  }

  const allProjectNames = Array.from(grouped.keys()).sort((a, b) => {
    const da = projectInstallDate.get(a) ?? ''
    const db = projectInstallDate.get(b) ?? ''
    if (da && db) return da.localeCompare(db) || a.localeCompare(b)
    if (da) return -1
    if (db) return 1
    return a.localeCompare(b)
  })

  const { active: activeProjectNames, completed: completedProjectNames } = splitProjectNames(
    allProjectNames,
    completedSet,
  )

  const completedOutRows = txRows
    .filter(tx => tx.direction === 'out')
    .map(tx => {
      const project = normalizeProjectGroupKey(tx.project)
      const rawProject = (tx.project ?? '').trim()
      return {
        created_at: tx.created_at,
        project,
        install_date: rawProject ? (projectInstallDate.get(rawProject) ?? null) : null,
        item_name: tx.items?.[0]?.name ?? (itemById.get(tx.item_id)?.name ?? '품목'),
        amount: tx.amount,
      }
    })

  const itemOptions = items.map(item => ({ id: item.id, name: item.name, quantity: item.quantity ?? 0 }))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">프로젝트 사용예정 재고</h1>
        <p className="text-sm text-slate-500">
          진행 중 프로젝트는 사용예정·재고요약·출고에 반영됩니다. 완료 처리하면 완료 섹션으로 이동하고 예정 집계에서 제외됩니다.
        </p>
      </div>

      {statusMissing && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          프로젝트 완료 기능 DB(017_project_completion.sql)가 아직 없습니다. Supabase SQL Editor에서 실행해주세요.
        </div>
      )}

      <ProjectOutboundReconcilePanel report={reconcileReport} projectOptions={allProjectNames} />

      <ProjectPlanMultiForm
        items={itemOptions}
        projects={activeProjectNames.map(projectName => ({
          project_name: projectName,
          install_date: projectInstallDate.get(projectName) ?? null,
          rows: (grouped.get(projectName) ?? []).map(row => ({
            item_id: row.item_id,
            planned_qty: row.planned_qty,
          })),
        }))}
      />

      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-slate-800 mr-1">엑셀 다운로드</p>
        <a
          href="/api/projects/export?type=plans"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          사용예정 재고 (진행 중)
        </a>
        <a
          href="/api/projects/export?type=history"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          프로젝트 출고 이력
        </a>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">진행 중 프로젝트</h2>
        {activeProjectNames.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 bg-white">
            진행 중인 프로젝트가 없습니다.
          </p>
        ) : (
          <div className="space-y-4">
            {activeProjectNames.map(projectName => (
              <ProjectPlanSection
                key={projectName}
                mode="active"
                projectName={projectName}
                installDate={projectInstallDate.get(projectName) ?? null}
                items={itemOptions}
                rows={grouped.get(projectName) ?? []}
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">완료된 프로젝트</h2>
        {completedProjectNames.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 bg-slate-50">
            완료 처리된 프로젝트가 없습니다.
          </p>
        ) : (
          <div className="space-y-4">
            {completedProjectNames.map(projectName => (
              <ProjectPlanSection
                key={projectName}
                mode="completed"
                projectName={projectName}
                installDate={projectInstallDate.get(projectName) ?? null}
                completedAt={completedAtByProject.get(projectName) ?? null}
                items={itemOptions}
                rows={grouped.get(projectName) ?? []}
              />
            ))}
          </div>
        )}
      </div>

      <section className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">프로젝트 출고 완료 이력</h2>
          <p className="text-xs text-slate-500 mt-0.5">프로젝트별로 묶어 보기 · 항목을 누르면 상세 목록이 펼쳐집니다.</p>
        </div>
        <ProjectOutboundHistory
          rows={completedOutRows}
          installDateByProject={Object.fromEntries(projectInstallDate)}
        />
      </section>
    </div>
  )
}
