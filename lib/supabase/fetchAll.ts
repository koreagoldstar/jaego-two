import type { PostgrestError } from '@supabase/supabase-js'

const PAGE = 1000

type PageResult<T> = {
  data: T[] | null
  error: PostgrestError | null
}

/** Supabase 기본 1000행 제한을 넘어 전량 조회 (타임아웃·누락 완화) */
export async function fetchAllPaged<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<{ data: T[]; error: string | null }> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1
    const { data, error } = await fetchPage(from, to)
    if (error) return { data: all, error: error.message }
    const rows = data ?? []
    all.push(...rows)
    if (rows.length < PAGE) break
  }
  return { data: all, error: null }
}
