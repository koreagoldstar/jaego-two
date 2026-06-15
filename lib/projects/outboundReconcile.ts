import { buildShippedMap, type ShippedTxRow } from '@/lib/stockOverview'

export type ReconcilePlanRow = {
  project_name: string
  item_id: string
  planned_qty: number
  install_date?: string | null
}

export type ReconcileTxRow = {
  id: string
  item_id: string
  direction: 'in' | 'out'
  amount: number
  project: string | null
  created_at: string
}

export type OutboundAssignment = { txId: string; project: string }

export type OutboundReconcileReport = {
  orphanCount: number
  misassignedCount: number
  noPlanCount: number
  assignableCount: number
  /** 품목 예정 없음 — 프로젝트 지정만으로 강제 연결 가능한 건수 */
  forceAssignableCount: number
}

export function projectItemKey(project: string, itemId: string): string {
  return `${project.trim()}::${itemId}`
}

export function buildPlanKeySet(plans: ReconcilePlanRow[]): Set<string> {
  const keys = new Set<string>()
  for (const plan of plans) {
    const name = (plan.project_name ?? '').trim()
    if (!name) continue
    keys.add(projectItemKey(name, plan.item_id))
  }
  return keys
}

/** 출고인데 프로젝트가 없거나, 해당 프로젝트·품목 예정이 없는 건 */
export function isOutboundUnmatched(tx: ReconcileTxRow, planKeys: Set<string>): boolean {
  if (tx.direction !== 'out') return false
  const project = (tx.project ?? '').trim()
  if (!project) return true
  return !planKeys.has(projectItemKey(project, tx.item_id))
}

function countsForShippedMap(tx: ReconcileTxRow, planKeys: Set<string>): boolean {
  const project = (tx.project ?? '').trim()
  if (!project) return false
  const key = projectItemKey(project, tx.item_id)
  if (!planKeys.has(key)) return false
  if (tx.direction === 'out' && isOutboundUnmatched(tx, planKeys)) return false
  return true
}

function pickProject(
  candidates: ReconcilePlanRow[],
  shippedMap: Map<string, number>,
  completedProjects: Set<string>,
): string | null {
  if (candidates.length === 0) return null

  const scored = candidates.map(plan => {
    const name = (plan.project_name ?? '').trim()
    const key = projectItemKey(name, plan.item_id)
    const shipped = Math.max(0, shippedMap.get(key) ?? 0)
    const remaining = plan.planned_qty - shipped
    const active = !completedProjects.has(name)
    return {
      project: name,
      remaining,
      active,
      planned: plan.planned_qty,
      install: plan.install_date ?? '',
    }
  })

  const byRemaining = (list: typeof scored) =>
    list.sort((a, b) => b.remaining - a.remaining || a.install.localeCompare(b.install) || a.project.localeCompare(b.project))

  const activeWithRoom = byRemaining(scored.filter(s => s.active && s.remaining > 0))
  if (activeWithRoom.length) return activeWithRoom[0].project

  const completedWithRoom = byRemaining(scored.filter(s => !s.active && s.remaining > 0))
  if (completedWithRoom.length) return completedWithRoom[0].project

  if (scored.length === 1) return scored[0].project

  const byPlanned = (list: typeof scored) =>
    list.sort((a, b) => b.planned - a.planned || a.install.localeCompare(b.install) || a.project.localeCompare(b.project))

  const active = byPlanned(scored.filter(s => s.active))
  if (active.length) return active[0].project

  return byPlanned(scored)[0].project
}

/** 프로젝트 없음·예정 불일치 출고를 사용예정에 맞게 배정 (완료 프로젝트 포함) */
export function computeOutboundAssignments(
  plans: ReconcilePlanRow[],
  transactions: ReconcileTxRow[],
  completedProjects: Set<string> = new Set(),
): OutboundAssignment[] {
  const planKeys = buildPlanKeySet(plans)
  const planByItem = new Map<string, ReconcilePlanRow[]>()

  for (const plan of plans) {
    const name = (plan.project_name ?? '').trim()
    if (!name) continue
    const list = planByItem.get(plan.item_id) ?? []
    list.push({ ...plan, project_name: name })
    planByItem.set(plan.item_id, list)
  }

  const shippedMap = buildShippedMap(
    transactions.filter(tx => countsForShippedMap(tx, planKeys)) as ShippedTxRow[],
  )

  const unmatched = transactions
    .filter(tx => isOutboundUnmatched(tx, planKeys))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  const assignments: OutboundAssignment[] = []

  for (const tx of unmatched) {
    const candidates = planByItem.get(tx.item_id) ?? []
    const project = pickProject(candidates, shippedMap, completedProjects)
    if (!project) continue

    assignments.push({ txId: tx.id, project })
    const key = projectItemKey(project, tx.item_id)
    shippedMap.set(key, (shippedMap.get(key) ?? 0) + tx.amount)
  }

  return assignments
}

/** 품목 예정이 없는 출고를 지정 프로젝트에 강제 연결 */
export function computeForceOutboundAssignments(
  plans: ReconcilePlanRow[],
  transactions: ReconcileTxRow[],
  targetProject: string,
): OutboundAssignment[] {
  const planKeys = buildPlanKeySet(plans)
  const target = targetProject.trim()
  if (!target) return []

  const planByItem = new Map<string, ReconcilePlanRow[]>()
  for (const plan of plans) {
    const name = (plan.project_name ?? '').trim()
    if (!name) continue
    const list = planByItem.get(plan.item_id) ?? []
    list.push({ ...plan, project_name: name })
    planByItem.set(plan.item_id, list)
  }

  const assignments: OutboundAssignment[] = []
  for (const tx of transactions) {
    if (!isOutboundUnmatched(tx, planKeys)) continue
    if ((planByItem.get(tx.item_id) ?? []).length > 0) continue
    const current = (tx.project ?? '').trim()
    if (current === target) continue
    assignments.push({ txId: tx.id, project: target })
  }
  return assignments
}

export function buildOutboundReconcileReport(
  plans: ReconcilePlanRow[],
  transactions: ReconcileTxRow[],
  completedProjects: Set<string> = new Set(),
): OutboundReconcileReport {
  const planKeys = buildPlanKeySet(plans)
  const unmatched = transactions.filter(tx => isOutboundUnmatched(tx, planKeys))
  const assignments = computeOutboundAssignments(plans, transactions, completedProjects)
  const assignableIds = new Set(assignments.map(a => a.txId))
  const noPlanTxs = unmatched.filter(tx => !assignableIds.has(tx.id))
  const byItem = planByItemFromPlans(plans)
  const forceAssignableCount = noPlanTxs.filter(tx => (byItem.get(tx.item_id) ?? []).length === 0).length

  return {
    orphanCount: unmatched.filter(tx => !(tx.project ?? '').trim()).length,
    misassignedCount: unmatched.filter(tx => (tx.project ?? '').trim()).length,
    noPlanCount: noPlanTxs.length,
    assignableCount: assignments.length,
    forceAssignableCount,
  }
}

function planByItemFromPlans(plans: ReconcilePlanRow[]): Map<string, ReconcilePlanRow[]> {
  const map = new Map<string, ReconcilePlanRow[]>()
  for (const plan of plans) {
    const name = (plan.project_name ?? '').trim()
    if (!name) continue
    const list = map.get(plan.item_id) ?? []
    list.push({ ...plan, project_name: name })
    map.set(plan.item_id, list)
  }
  return map
}
