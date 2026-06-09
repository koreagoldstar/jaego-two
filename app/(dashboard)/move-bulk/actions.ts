'use server'

import { deleteStockTransactionAction } from '@/app/(dashboard)/transactions/actions'

export async function deleteStockTransactionsBatchAction(ids: string[]) {
  const unique = Array.from(new Set(ids.map(id => id.trim()).filter(Boolean)))
  if (unique.length === 0) {
    return { ok: false as const, error: '삭제할 이력이 없습니다', deleted: 0, failed: [] as string[] }
  }

  let deleted = 0
  const failed: string[] = []

  for (const id of unique) {
    const res = await deleteStockTransactionAction(id)
    if (res.ok) {
      deleted += 1
    } else {
      failed.push(res.error)
    }
  }

  if (deleted === 0) {
    return {
      ok: false as const,
      error: failed[0] ?? '삭제에 실패했습니다',
      deleted: 0,
      failed,
    }
  }

  return {
    ok: true as const,
    deleted,
    failed,
  }
}
