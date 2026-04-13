import { createClient } from '@/lib/supabase/server'
import { deleteProjectPlanAction, saveProjectPlanAction } from '@/app/(dashboard)/projects/actions'
import type { Item } from '@/lib/supabase/types'
import { ProjectPlanMultiForm } from '@/components/projects/ProjectPlanMultiForm'

export const dynamic = 'force-dynamic'

type PlanRow = {
  project_name: string
  install_date: string | null
  item_id: string
  planned_qty: number
}

type TxRow = {
  project: string | null
  item_id: string
  direction: 'in' | 'out'
  amount: number
}

export default async function ProjectsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [itemsRes, planRes, txRes] = await Promise.all([
    supabase.from('items').select('id, name, quantity').eq('user_id', user.id).order('name'),
    supabase
      .from('project_usage_plans')
      .select('project_name, install_date, item_id, planned_qty')
      .eq('user_id', user.id)
      .order('project_name')
      .order('created_at', { ascending: true }),
    supabase
      .from('stock_transactions')
      .select('project, item_id, direction, amount')
      .eq('user_id', user.id)
      .not('project', 'is', null)
      .neq('project', ''),
  ])

  const itemsData = itemsRes.data
  const planData = planRes.data
  const txData = txRes.data

  const items = (itemsData ?? []) as Item[]
  const itemById = new Map(items.map(item => [item.id, item] as const))
  const plans = (planData ?? []) as unknown as PlanRow[]
  const txRows = (txData ?? []) as TxRow[]

  if (itemsRes.error || planRes.error || txRes.error) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">프로젝트 사용예정 재고</h1>
          <p className="text-sm text-red-600">데이터를 불러오는 중 오류가 발생했습니다.</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {planRes.error?.message?.includes('project_usage_plans')
            ? 'DB 마이그레이션(005_project_usage_plans.sql)이 아직 적용되지 않았습니다. Supabase SQL Editor에서 먼저 실행해주세요.'
            : planRes.error?.message ?? itemsRes.error?.message ?? txRes.error?.message ?? '알 수 없는 오류'}
        </div>
      </div>
    )
  }

  const shippedMap = new Map<string, number>()
  for (const tx of txRows) {
    const project = (tx.project ?? '').trim()
    if (!project) continue
    const k = `${project}::${tx.item_id}`
    const delta = tx.direction === 'out' ? tx.amount : -tx.amount
    shippedMap.set(k, (shippedMap.get(k) ?? 0) + delta)
  }

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

  const projectNames = Array.from(grouped.keys()).sort((a, b) => {
    const da = projectInstallDate.get(a) ?? ''
    const db = projectInstallDate.get(b) ?? ''
    if (da && db) return da.localeCompare(db) || a.localeCompare(b)
    if (da) return -1
    if (db) return 1
    return a.localeCompare(b)
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">프로젝트 사용예정 재고</h1>
        <p className="text-sm text-slate-500">품목별 예정수량·현재재고·출고완료·잔여 예정수량을 한눈에 확인합니다.</p>
      </div>

      <ProjectPlanMultiForm
        items={items.map(item => ({ id: item.id, name: item.name, quantity: item.quantity ?? 0 }))}
      />

      {projectNames.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 bg-white">
          등록된 프로젝트 예정 수량이 없습니다.
        </p>
      ) : (
        <div className="space-y-4">
          {projectNames.map(projectName => {
            const rows = grouped.get(projectName) ?? []
            return (
              <section key={projectName} className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-slate-900">{projectName}</h2>
                  <span className="text-xs text-slate-500">
                    설치 일정: {projectInstallDate.get(projectName) || '미정'}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b border-slate-200">
                        <th className="py-2 pr-3">품목</th>
                        <th className="py-2 pr-3 text-right">현재 재고</th>
                        <th className="py-2 pr-3 text-right">사용예정</th>
                        <th className="py-2 pr-3 text-right">출고완료</th>
                        <th className="py-2 text-right">예정 잔여</th>
                        <th className="py-2 pl-3 text-right">수정/삭제</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(row => (
                        <tr key={`${row.project_name}-${row.item_id}`} className="border-b border-slate-100 last:border-0">
                          <td className="py-2 pr-3 text-slate-900">{itemById.get(row.item_id)?.name ?? '품목'}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{itemById.get(row.item_id)?.quantity ?? 0}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{row.planned_qty}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{row.shipped}</td>
                          <td className={`py-2 text-right tabular-nums ${row.remaining <= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                            {row.remaining}
                          </td>
                          <td className="py-2 pl-3">
                            <div className="flex justify-end gap-2">
                              <form action={saveProjectPlanAction} className="flex items-center gap-1.5">
                                <input type="hidden" name="project_name" value={row.project_name} />
                                <input type="hidden" name="install_date" value={row.install_date ?? ''} />
                                <input type="hidden" name="item_id" value={row.item_id} />
                                <input
                                  name="planned_qty"
                                  type="number"
                                  min={0}
                                  defaultValue={row.planned_qty}
                                  className="w-20 rounded-md border border-slate-200 px-2 py-1 text-xs text-right tabular-nums"
                                />
                                <button
                                  type="submit"
                                  className="rounded-md bg-blue-600 text-white px-2 py-1 text-xs font-medium whitespace-nowrap"
                                >
                                  수정
                                </button>
                              </form>
                              <form action={deleteProjectPlanAction}>
                                <input type="hidden" name="project_name" value={row.project_name} />
                                <input type="hidden" name="item_id" value={row.item_id} />
                                <button
                                  type="submit"
                                  className="rounded-md border border-red-200 bg-red-50 text-red-700 px-2 py-1 text-xs font-medium whitespace-nowrap"
                                >
                                  삭제
                                </button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
