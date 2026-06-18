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

function parseCodeList(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/\r?\n/)
        .map(v => v.trim())
        .filter(Boolean),
    ),
  )
}

export function ItemStockReconcileClient({ itemId, currentCodes }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'paste' | 'scan'>('paste')
  const [scanned, setScanned] = useState<string[]>([])
  const [pasteText, setPasteText] = useState('')
  const [lastScanned, setLastScanned] = useState<string | null>(null)
  const [lastScanAt, setLastScanAt] = useState<string | null>(null)
  const [pendingScan, setPendingScan] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const pastedCodes = useMemo(() => parseCodeList(pasteText), [pasteText])
  const targetCodes = mode === 'paste' ? pastedCodes : scanned

  const currentSet = useMemo(() => new Set(currentCodes.map(v => v.trim()).filter(Boolean)), [currentCodes])
  const targetSet = useMemo(() => new Set(targetCodes.map(v => v.trim()).filter(Boolean)), [targetCodes])

  const missingInDb = useMemo(() => targetCodes.filter(code => !currentSet.has(code)), [targetCodes, currentSet])
  const extraInDb = useMemo(() => currentCodes.filter(code => !targetSet.has(code)), [currentCodes, targetSet])

  function onDecode(code: string) {
    const trimmed = code.trim()
    if (!trimmed) return
    if (pendingScan) return
    setPendingScan(trimmed)
  }

  function confirmPendingScan() {
    if (!pendingScan) return
    setLastScanned(pendingScan)
    setLastScanAt(new Date().toISOString())
    setScanned(prev => (prev.includes(pendingScan) ? prev : [...prev, pendingScan]))
    setPendingScan(null)
  }

  async function applyFix() {
    if (targetCodes.length === 0) return
    if (
      !window.confirm(
        `입력한 QR ${targetCodes.length}개로 이 품목 재고를 맞출까요?\n(기존 lot 목록은 이 목록으로 교체됩니다)`,
      )
    ) {
      return
    }
    setBusy(true)
    const fd = new FormData()
    fd.set('codes', targetCodes.join('\n'))
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
      <p className="text-xs text-slate-500 leading-relaxed">
        스캔 없이 QR 목록 붙여넣기로 보정할 수 있습니다. 위「재고 수량」에서 각 lot「수정」으로 QR만 바꿀 수도 있습니다.
      </p>

      <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 gap-0.5 text-xs">
        <button
          type="button"
          onClick={() => setMode('paste')}
          className={`flex-1 rounded-md py-1.5 font-medium ${mode === 'paste' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          목록 붙여넣기
        </button>
        <button
          type="button"
          onClick={() => setMode('scan')}
          className={`flex-1 rounded-md py-1.5 font-medium ${mode === 'scan' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          카메라 스캔
        </button>
      </div>

      {mode === 'paste' ? (
        <label className="block text-xs text-slate-600">
          QR 코드 (한 줄에 하나)
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            rows={6}
            placeholder={'품목코드-001\n품목코드-002\n품목코드-059'}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-mono"
          />
        </label>
      ) : (
        <>
          <BarcodeCamera
            onDecode={onDecode}
            initialStatus="실물 QR을 순서대로 비춰 주세요."
            videoClassName="w-full max-h-[240px] min-h-[180px] object-contain bg-black"
          />
          {lastScanned && (
            <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1.5">
              스캔 확인 · {lastScanned} · {lastScanAt ? new Date(lastScanAt).toLocaleTimeString('ko-KR') : ''}
            </p>
          )}
          {pendingScan && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 space-y-1">
              <p className="text-[11px] text-blue-800">스캔 확인 대기: {pendingScan}</p>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setPendingScan(null)}
                  className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px]"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={confirmPendingScan}
                  className="rounded bg-blue-600 text-white px-2 py-0.5 text-[11px] font-medium"
                >
                  확인
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setScanned([])}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
          >
            스캔 목록 초기화
          </button>
        </>
      )}

      <div className="grid gap-2 sm:grid-cols-3 text-xs">
        <div className="rounded-lg border border-slate-200 p-2 bg-white">DB 코드: {currentCodes.length}개</div>
        <div className="rounded-lg border border-slate-200 p-2 bg-white">입력 코드: {targetCodes.length}개</div>
        <div className="rounded-lg border border-slate-200 p-2 bg-white">
          불일치: {missingInDb.length + extraInDb.length}개
        </div>
      </div>

      {(missingInDb.length > 0 || extraInDb.length > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 space-y-1 text-xs">
          {missingInDb.length > 0 && <p>입력엔 있는데 DB에 없음: {missingInDb.length}개</p>}
          {extraInDb.length > 0 && <p>DB엔 있는데 입력엔 없음: {extraInDb.length}개</p>}
        </div>
      )}

      <button
        type="button"
        disabled={busy || targetCodes.length === 0}
        onClick={() => void applyFix()}
        className="rounded-lg bg-blue-600 text-white px-3 py-2 text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {targetCodes.length}개 QR로 재고 보정
      </button>
    </div>
  )
}
