'use client'

import { reconcileItemLotsByScannedCodesAction } from '@/app/(dashboard)/items/[id]/reconcileActions'
import { BarcodeCamera } from '@/components/BarcodeCamera'
import { Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  itemId: string
  currentCodes: string[]
}

export function ItemStockReconcileClient({ itemId, currentCodes }: Props) {
  const router = useRouter()
  const [scanned, setScanned] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const currentSet = useMemo(() => new Set(currentCodes.map(v => v.trim()).filter(Boolean)), [currentCodes])
  const scannedSet = useMemo(() => new Set(scanned.map(v => v.trim()).filter(Boolean)), [scanned])

  const missingInDb = useMemo(() => scanned.filter(code => !currentSet.has(code)), [scanned, currentSet])
  const extraInDb = useMemo(() => currentCodes.filter(code => !scannedSet.has(code)), [currentCodes, scannedSet])

  function onDecode(code: string) {
    const trimmed = code.trim()
    if (!trimmed) return
    setScanned(prev => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
  }

  async function applyFix() {
    if (scanned.length === 0) return
    if (!window.confirm(`스캔 목록 ${scanned.length}개로 재고 QR을 보정할까요?`)) return
    setBusy(true)
    const fd = new FormData()
    fd.set('codes', scanned.join('\n'))
    const res = await reconcileItemLotsByScannedCodesAction(itemId, fd)
    setBusy(false)
    if (!res.ok) {
      alert(res.error)
      return
    }
    alert(`보정 완료: ${res.count}개`)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        실물 QR을 연속 스캔하면 DB와 비교합니다. 누락/초과를 확인한 뒤 스캔 목록 기준으로 자동 보정할 수 있습니다.
      </p>
      <BarcodeCamera
        onDecode={onDecode}
        initialStatus="실물 QR을 순서대로 비춰 주세요."
        videoClassName="w-full max-h-[240px] min-h-[180px] object-contain bg-black"
      />

      <div className="grid gap-2 sm:grid-cols-3 text-xs">
        <div className="rounded-lg border border-slate-200 p-2 bg-white">DB 코드: {currentCodes.length}개</div>
        <div className="rounded-lg border border-slate-200 p-2 bg-white">스캔 코드: {scanned.length}개</div>
        <div className="rounded-lg border border-slate-200 p-2 bg-white">
          불일치: {missingInDb.length + extraInDb.length}개
        </div>
      </div>

      {(missingInDb.length > 0 || extraInDb.length > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 space-y-1 text-xs">
          {missingInDb.length > 0 && <p>실물엔 있는데 DB에 없음: {missingInDb.length}개</p>}
          {extraInDb.length > 0 && <p>DB엔 있는데 실물엔 없음: {extraInDb.length}개</p>}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setScanned([])}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
        >
          스캔 목록 초기화
        </button>
        <button
          type="button"
          disabled={busy || scanned.length === 0}
          onClick={() => void applyFix()}
          className="rounded-lg bg-blue-600 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : '스캔 목록으로 자동 보정'}
        </button>
      </div>
    </div>
  )
}
