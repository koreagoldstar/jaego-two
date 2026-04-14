import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeBarcodePayload } from '@/lib/items/barcodePayload'

/** 사용자 품목 중 스캔 문자열로 id 조회 (인쇄 라벨 payload와 동일 규칙에 맞춤) */
export async function findItemIdByBarcode(
  supabase: SupabaseClient,
  userId: string,
  rawCode: string
): Promise<string | null> {
  const code = normalizeBarcodePayload(rawCode)
  if (!code) return null

  const base = () =>
    supabase.from('items').select('id').eq('user_id', userId)

  const { data: byBarcode } = await base().eq('barcode_code', code).maybeSingle()
  if (byBarcode?.id) return byBarcode.id

  const { data: bySerial } = await base().eq('serial_number', code).maybeSingle()
  if (bySerial?.id) return bySerial.id

  const { data: byShRows } = await base().eq('sh', code).limit(1)
  const bySh = byShRows?.[0]
  if (bySh?.id) return bySh.id

  /* 다수량 라벨: 인쇄는 BASE-001 형태, DB는 BASE만 있는 경우 */
  const stripped = code.replace(/-(\d{3})$/, '')
  if (stripped !== code) {
    const { data: byBase } = await base().eq('barcode_code', stripped).maybeSingle()
    if (byBase?.id) return byBase.id
  }

  /* sh+구분자+serial 복합 (라벨 설정과 동일하게 인쇄된 경우) */
  for (const sep of ['|', '/', ':'] as const) {
    const idx = code.indexOf(sep)
    if (idx <= 0) continue
    const left = code.slice(0, idx).trim()
    const right = code.slice(idx + 1).trim()
    if (!left || !right) continue
    const { data: comp } = await base().eq('sh', left).eq('serial_number', right).maybeSingle()
    if (comp?.id) return comp.id
  }

  /* 부분 일치는 와일드카드 문자가 섞이면 쿼리가 깨질 수 있어 제한 */
  if (code.length >= 2 && !/[%_]/.test(code)) {
    const { data: loose } = await supabase
      .from('items')
      .select('id')
      .eq('user_id', userId)
      .ilike('barcode_code', `%${code}%`)
      .limit(1)
      .maybeSingle()

    if (loose?.id) return loose.id
  }

  return null
}
