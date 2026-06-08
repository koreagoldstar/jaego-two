export const NO_PROJECT_LABEL = '프로젝트 없음'

export function normalizeProjectGroupKey(project: string | null | undefined): string {
  const trimmed = (project ?? '').trim()
  return trimmed || NO_PROJECT_LABEL
}

export type ProjectHistoryGroup<T> = {
  projectKey: string
  items: T[]
  latestAt: string
}

export function groupHistoryByProject<T>(
  items: T[],
  getProject: (item: T) => string | null | undefined,
  getCreatedAt: (item: T) => string,
): ProjectHistoryGroup<T>[] {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = normalizeProjectGroupKey(getProject(item))
    const list = map.get(key) ?? []
    list.push(item)
    map.set(key, list)
  }

  const groups: ProjectHistoryGroup<T>[] = []
  for (const [projectKey, groupItems] of Array.from(map.entries())) {
    const sorted = [...groupItems].sort((a, b) => getCreatedAt(b).localeCompare(getCreatedAt(a)))
    groups.push({
      projectKey,
      items: sorted,
      latestAt: sorted[0] ? getCreatedAt(sorted[0]) : '',
    })
  }

  groups.sort((a, b) => {
    if (a.projectKey === NO_PROJECT_LABEL && b.projectKey !== NO_PROJECT_LABEL) return 1
    if (b.projectKey === NO_PROJECT_LABEL && a.projectKey !== NO_PROJECT_LABEL) return -1
    return b.latestAt.localeCompare(a.latestAt) || a.projectKey.localeCompare(b.projectKey, 'ko')
  })

  return groups
}
