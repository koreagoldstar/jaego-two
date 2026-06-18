'use server'

import { ensureOutboundLotForScan } from '@/lib/items/ensureOutboundLot'
import { revalidateInventoryViews } from '@/lib/projects/revalidateViews'
import { createClient } from '@/lib/supabase/server'

export async function prepareOutboundLotAction(itemId: string, scannedCode: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: '로그인이 필요합니다' }

  const itemIdTrim = itemId.trim()
  const code = scannedCode.trim()
  if (!itemIdTrim || !code) return { ok: false as const, error: '품목 또는 QR이 없습니다' }

  const result = await ensureOutboundLotForScan(supabase, user.id, itemIdTrim, code)
  if (!result.ok) return result

  revalidateInventoryViews()
  return result
}
