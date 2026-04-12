import type { SupabaseClient } from '@supabase/supabase-js'

/** 사용자 품목 중 바코드 문자열로 id 조회 (정확 일치 → 부분 일치 1건) */
export async function findItemIdByBarcode(
  supabase: SupabaseClient,
  userId: string,
  rawCode: string
): Promise<string | null> {
  const code = rawCode.trim()
  if (!code) return null

  const { data } = await supabase
    .from('items')
    .select('id')
    .eq('user_id', userId)
    .eq('barcode_code', code)
    .maybeSingle()

  if (data?.id) return data.id

  const { data: loose } = await supabase
    .from('items')
    .select('id')
    .eq('user_id', userId)
    .ilike('barcode_code', `%${code}%`)
    .limit(1)
    .maybeSingle()

  return loose?.id ?? null
}
