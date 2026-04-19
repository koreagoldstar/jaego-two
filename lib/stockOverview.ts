export type PlanSumRow = {
  project_name: string
  install_date: string | null
  item_id: string
  planned_qty: number
}

export type StockOverviewItem = {
  id: string
  name: string
  quantity: number | null
  sh?: string | null
}

export type ItemSummaryRow = {
  id: string
  name: string
  sh: string
  currentQty: number
  plannedQty: number
  remainQty: number
}

export type ProjectColumn = { project: string; installDate: string | null }

export type ItemProjectRow = {
  id: string
  name: string
  sh: string
  currentQty: number
  byProject: Map<string, number>
  remainQty: number
}

export function buildStockOverview(
  items: StockOverviewItem[],
  plans: PlanSumRow[],
  selectedProject: string
) {
  const allProjects = Array.from(new Set(plans.map(p => p.project_name).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  )

  const filteredPlans = selectedProject ? plans.filter(row => row.project_name === selectedProject) : plans

  const plannedByItem = new Map<string, number>()
  for (const row of filteredPlans) {
    plannedByItem.set(row.item_id, (plannedByItem.get(row.item_id) ?? 0) + (row.planned_qty ?? 0))
  }

  const rows: ItemSummaryRow[] = items.map(item => {
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

  const projectColumns: ProjectColumn[] = Array.from(projectMetaMap.entries())
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

  const itemProjectRows: ItemProjectRow[] = items.map(item => {
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

  return {
    allProjects,
    rows,
    totalCurrent,
    totalPlanned,
    totalRemain,
    projectColumns,
    itemProjectRows,
  }
}
