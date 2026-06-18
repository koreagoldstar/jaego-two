'use client'

import { alignItemStockLotsAction } from '@/app/(dashboard)/items/alignActions'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function ItemStockAlignButton({ itemId }: { itemId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function run() {
    if (
      !window.confirm(
        '이 품목의 빈 QR·묶음 lot·수량 불일치를 DB 기준으로 자동 맞출까요?\n(스캔 없음 · 실물 라벨 번호는 바뀌지 않을 수 있음)',
      )
    ) {
      return
    }
    setBusy(true)
    const res = await alignItemStockLotsAction(itemId)
    setBusy(false)
    if (!res.ok) {
      alert(res.error)
      return
    }
    const { filledCodes, splitUnits, addedLots, trimmedCodes } = res.result
    const total = filledCodes + splitUnits + addedLots + trimmedCodes
    alert(total > 0 ? `정합 완료 (QR 채움 ${filledCodes} · 분리 ${splitUnits} · 추가 ${addedLots})` : '이미 DB 기준으로 맞습니다.')
    router.refresh()
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void run()}
      className="rounded-lg border border-violet-200 bg-violet-50 text-violet-800 px-3 py-1.5 text-xs font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
      스캔 없이 QR 자동 정합
    </button>
  )
}
