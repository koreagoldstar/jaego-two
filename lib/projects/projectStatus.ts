export type ProjectStatusRow = {
  project_name: string
  completed_at: string
}

export function buildCompletedProjectSet(rows: ProjectStatusRow[]): Set<string> {
  return new Set(rows.map(r => r.project_name.trim()).filter(Boolean))
}

export function isProjectCompleted(projectName: string, completed: Set<string>): boolean {
  return completed.has(projectName.trim())
}

export function filterActiveProjectPlans<T extends { project_name: string }>(
  plans: T[],
  completed: Set<string>,
): T[] {
  if (completed.size === 0) return plans
  return plans.filter(p => !completed.has((p.project_name ?? '').trim()))
}

export function splitProjectNames(
  names: string[],
  completed: Set<string>,
): { active: string[]; completed: string[] } {
  const active: string[] = []
  const done: string[] = []
  for (const name of names) {
    if (completed.has(name)) done.push(name)
    else active.push(name)
  }
  return { active, completed: done }
}
