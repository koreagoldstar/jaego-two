/** 사용예정·이력에 등장하는 프로젝트명 목록 (중복 제거, 가나다순) */
export function mergeProjectNameOptions(
  planNames: string[],
  transactionNames: string[],
  extraNames: string[] = [],
): string[] {
  const set = new Set<string>()
  for (const name of [...planNames, ...transactionNames, ...extraNames]) {
    const trimmed = (name ?? '').trim()
    if (trimmed) set.add(trimmed)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'))
}
