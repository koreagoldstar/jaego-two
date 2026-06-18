'use client'

import { alignAllStockLotsAction, auditStockLotsAction } from '@/app/(dashboard)/items/alignActions'
import type { ItemStockLotAudit } from '@/lib/items/stockLotAlign'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const ISSUE_LABEL: Record<ItemStockLotAudit['issues'][number], string> = {
  qty_mismatch: '수량≠lot합',
  empty_lot_code: 'QR비어있음',
  bundled_lot: '묶음lot',
  no_item_barcode: '품목QR없음',
}

export function StockLotsAlignPanel() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [auditing, setAuditing] = useState(false)
  const [issues, setIssues] = useState<ItemStockLotAudit[] | null>(null)
  const [result, setResult] = useState<string | null>(null)

  async function runAudit() {
    setAuditing(true)
    setResult(null)
    const res = await auditStockLotsAction()
    setAuditing(false)
    if (!res.ok) {
      alert(res.error)
      return
    }
    setIssues(res.report.items)
  }

  async function runAlign() {
    if (
      !window.confirm(
        '전체 품목의 재고 QR을 DB 기준으로 정합합니다.\n\n' +
          '· 빈 QR 번호 채우기\n' +
          '· 묶음 lot를 1개 단위로 분리\n' +
          '· 품목 수량과 lot 개수 맞추기\n\n' +
          '이미 출고된 번호는 재사용하지 않습니다.\n' +
          '실물 라벨과 다르면 품목 상세「재고 대사」로 스캔 보정이 필요합니다.\n\n계속할까요?',
      )
    ) {
      return
    }
    setBusy(true)
    setResult(null)
    const res = await alignAllStockLotsAction()
    setBusy(false)
    if (!res.ok) {
      alert(res.error)
      return
    }
    setResult(
      `정합 완료: ${res.alignedItems}개 품목 · QR 채움 ${res.filled} · 분리 ${res.split} · 추가 ${res.added} · trim ${res.trimmed}`,
    )
    await runAudit()
    router.refresh()
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900">전체 QR · 재고 번호 정합</h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          DB 안에서 품목 수량·lot·QR 번호를 맞춥니다. 바코드 만들기·출고·라벨 인쇄가 같은 번호를 씁니다.
          실물 스티커가 예전 번호면 품목 상세의「재고 대사」로 스캔 보정하거나 라벨을 다시 인쇄하세요.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={auditing || busy}
          onClick={() => void runAudit()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {auditing ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} 점검
        </button>
        <button
          type="button"
          disabled={busy || auditing}
          onClick={() => void runAlign()}
          className="rounded-lg bg-violet-600 text-white px-3 py-2 text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          전체 QR 정합 실행
        </button>
      </div>

      {result && <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{result}</p>}

      {issues && issues.length === 0 && (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          점검 결과 문제 없음 — DB 기준으로 QR·수량이 맞습니다.
        </p>
      )}

      {issues && issues.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 overflow-hidden">
          <p className="text-xs font-medium text-amber-900 px-3 py-2 border-b border-amber-100">
            점검: {issues.length}개 품목에 이슈
          </p>
          <ul className="max-h-48 overflow-y-auto text-xs divide-y divide-amber-100">
            {issues.slice(0, 30).map(row => (
              <li key={row.itemId} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                <Link href={`/items/${row.itemId}`} className="font-medium text-amber-950 hover:underline">
                  {row.itemName}
                </Link>
                <span className="text-amber-800 tabular-nums">
                  재고 {row.itemQty} / lot {row.lotQtySum}
                  {' · '}
                  {row.issues.map(i => ISSUE_LABEL[i]).join(', ')}
                </span>
              </li>
            ))}
          </ul>
          {issues.length > 30 && (
            <p className="text-[11px] text-amber-700 px-3 py-2">외 {issues.length - 30}개 품목…</p>
          )}
        </div>
      )}
    </div>
  )
}
