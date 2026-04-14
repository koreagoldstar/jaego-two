import type { SupabaseClient } from '@supabase/supabase-js'

/** 사용자 품목 중 `SH-숫자` 패턴의 최대 번호 다음 값부터 연속 코드 생성 */
const SH_NUMERIC = /^SH-(\d+)$/i

export function formatShSequential(n: number): string {
  return `SH-${String(n).padStart(7, '0')}`
}

export async function getNextShSequenceStart(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data, error } = await supabase.from('items').select('sh').eq('user_id', userId)
  if (error) {
    console.error('[getNextShSequenceStart]', error.message)
    return 1
  }

  let max = 0
  for (const row of data ?? []) {
    const s = typeof row.sh === 'string' ? row.sh.trim() : ''
    if (!s) continue
    const m = s.match(SH_NUMERIC)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return max + 1
}

export async function allocateSequentialShCodes(
  supabase: SupabaseClient,
  userId: string,
  count: number
): Promise<string[]> {
  const start = await getNextShSequenceStart(supabase, userId)
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    out.push(formatShSequential(start + i))
  }
  return out
}
