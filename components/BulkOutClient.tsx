'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ALREADY_SHIPPED_MESSAGE,
  UNIT_NOT_IN_STOCK_MESSAGE,
  UNIT_QR_MISMATCH_MESSAGE,
  findItemByBarcode,
} from '@/lib/items/barcodeLookup'
import { parseUnitSuffixIndex } from '@/lib/items/lotCodes'
import {
  DUPLICATE_UNIT_SCAN_MESSAGE,
  markRecentlyOutboundScanned,
  wasRecentlyOutboundScanned,
} from '@/lib/items/recentUnitScan'
import type { Item } from '@/lib/supabase/types'
import { BarcodeCamera } from '@/components/BarcodeCamera'
import { Loader2, Trash2 } from 'lucide-react'

type ScanEntry = {
  code: string
  lotId: string | null
}

type ScanBucket = {
  item: Item
  scans: ScanEntry[]
}

export function BulkOutClient() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState('')
  const [projectOptions, setProjectOptions] = useState<string[]>([])
  const [projectItemMap, setProjectItemMap] = useState<Record<string, string[]>>({})
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [scanLine, setScanLine] = useState<string | null>(null)
  const [lastScanAt, setLastScanAt] = useState<string | null>(null)
  const [scanCount, setScanCount] = useState(0)
  const [pendingScan, setPendingScan] = useState<{
    code: string
    itemId: string
    itemName: string
    lotId: string | null
  } | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [bucket, setBucket] = useState<Record<string, ScanBucket>>({})
  const [bulkOutConfirmPending, setBulkOutConfirmPending] = useState(false)
  const [forceUnplannedOutbound, setForceUnplannedOutbound] = useState(false)
  const resolveRef = useRef<(code: string) => Promise<void>>(async () => {})
  const submittingRef = useRef(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('items').select('*').eq('user_id', user.id).order('name')
    setItems((data ?? []) as Item[])
    const [{ data: projectRows }, { data: statusRows }] = await Promise.all([
      supabase.from('project_usage_plans').select('project_name, item_id').eq('user_id', user.id),
      supabase.from('project_status').select('project_name').eq('user_id', user.id),
    ])
    const completedProjects = new Set(
      ((statusRows ?? []) as Array<{ project_name?: string }>)
        .map(r => (r.project_name ?? '').trim())
        .filter(Boolean),
    )
    const rows = ((projectRows ?? []) as Array<{ project_name?: string; item_id?: string }>).filter(
      r => !completedProjects.has((r.project_name ?? '').trim()),
    )
    const names = Array.from(new Set(rows.map(r => (r.project_name ?? '').trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    )
    const byProject: Record<string, string[]> = {}
    for (const row of rows) {
      const name = (row.project_name ?? '').trim()
      const itemId = (row.item_id ?? '').trim()
      if (!name || !itemId) continue
      byProject[name] = byProject[name] ? [...byProject[name], itemId] : [itemId]
    }
    for (const key of Object.keys(byProject)) {
      byProject[key] = Array.from(new Set(byProject[key]))
    }
    setProjectOptions(names)
    setProjectItemMap(byProject)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const resolveBarcode = useCallback(
    async (code: string) => {
      setMsg(null)
      if (pendingScan) {
        setMsg({ type: 'err', text: '이전 스캔을 먼저 확인/취소하세요.' })
        return
      }
      const trimmed = code.trim()
      if (!trimmed) return

      if (wasRecentlyOutboundScanned(trimmed)) {
        window.alert(DUPLICATE_UNIT_SCAN_MESSAGE)
        setMsg({ type: 'err', text: DUPLICATE_UNIT_SCAN_MESSAGE })
        return
      }

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const hit = await findItemByBarcode(supabase, user.id, trimmed, { strictUnitQr: true })
      if (hit?.alreadyShipped) {
        window.alert(ALREADY_SHIPPED_MESSAGE)
        setMsg({ type: 'err', text: ALREADY_SHIPPED_MESSAGE })
        return
      }
      if (hit?.unitNotInStock) {
        window.alert(UNIT_NOT_IN_STOCK_MESSAGE)
        setMsg({ type: 'err', text: UNIT_NOT_IN_STOCK_MESSAGE })
        return
      }
      if (hit?.unitMismatch) {
        setMsg({
          type: 'err',
          text: `${UNIT_QR_MISMATCH_MESSAGE} (라벨 QR이 DB와 다릅니다. 품목 상세에서 lot 코드를 확인하세요.)`,
        })
        return
      }
      if (!hit) {
        setMsg({ type: 'err', text: `등록되지 않은 코드: ${trimmed}` })
        return
      }
      const id = hit.itemId
      const lotId = hit.lotId ?? null
      const selectedProject = project.trim()
      if (selectedProject && !forceUnplannedOutbound) {
        const allowed = projectItemMap[selectedProject] ?? []
        if (allowed.length > 0 && !allowed.includes(id)) {
          setMsg({ type: 'err', text: `이 품목은 프로젝트 "${selectedProject}" 예정 품목이 아닙니다. 강제 출고를 켜면 진행할 수 있습니다.` })
          return
        }
      }

      const item = items.find(i => i.id === id)
      if (!item) {
        setMsg({ type: 'err', text: '품목 정보를 찾을 수 없습니다. 새로고침 후 다시 시도하세요.' })
        return
      }

      setPendingScan({ code: trimmed, itemId: id, itemName: item.name, lotId })
    },
    [items, pendingScan, project, projectItemMap, forceUnplannedOutbound]
  )

  resolveRef.current = resolveBarcode

  useEffect(() => {
    let buffer = ''
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el?.closest('input, textarea, select') || el?.isContentEditable) return
      if (e.key === 'Enter') {
        const code = buffer.trim()
        buffer = ''
        if (code.length >= 2) {
          e.preventDefault()
          void resolveRef.current(code)
        }
        return
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        buffer += e.key
        if (buffer.length > 128) buffer = buffer.slice(-128)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const rows = useMemo(() => Object.values(bucket), [bucket])
  const totalScans = useMemo(() => rows.reduce((s, r) => s + r.scans.length, 0), [rows])

  function confirmPendingScan() {
    if (!pendingScan) return
    const codeKey = pendingScan.code.trim().toLowerCase()
    setBucket(prev => {
      const current = prev[pendingScan.itemId]
      const item = current?.item ?? items.find(i => i.id === pendingScan.itemId)
      if (!item) return prev
      const scans = current?.scans ?? []
      if (codeKey && scans.some(s => s.code.toLowerCase() === codeKey)) {
        setMsg({ type: 'err', text: '이미 스캔 목록에 있는 QR입니다.' })
        return prev
      }
      return {
        ...prev,
        [pendingScan.itemId]: {
          item,
          scans: [...scans, { code: pendingScan.code.trim(), lotId: pendingScan.lotId }],
        },
      }
    })
    setScanLine(`${pendingScan.itemName} 스캔 +1`)
    setLastScanAt(new Date().toISOString())
    setScanCount(prev => prev + 1)
    setPendingScan(null)
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(35)
  }

  const removeLastScan = useCallback((itemId: string) => {
    setBucket(prev => {
      const row = prev[itemId]
      if (!row) return prev
      if (row.scans.length <= 1) {
        const next = { ...prev }
        delete next[itemId]
        return next
      }
      return { ...prev, [itemId]: { ...row, scans: row.scans.slice(0, -1) } }
    })
  }, [])

  const clearAll = useCallback(() => {
    setBucket({})
    setMsg(null)
    setScanLine(null)
    setBulkOutConfirmPending(false)
  }, [])

  const requestBulkOut = useCallback(() => {
    setMsg(null)
    if (!project.trim()) {
      setMsg({ type: 'err', text: '프로젝트/현장을 입력하세요.' })
      return
    }
    if (rows.length === 0) {
      setMsg({ type: 'err', text: '먼저 바코드를 스캔하세요.' })
      return
    }
    setBulkOutConfirmPending(true)
  }, [project, rows.length])

  const runBulkOut = useCallback(async () => {
    if (submittingRef.current) return
    setMsg(null)
    if (!project.trim()) {
      setMsg({ type: 'err', text: '프로젝트/현장을 입력하세요.' })
      return
    }
    if (rows.length === 0) {
      setMsg({ type: 'err', text: '먼저 바코드를 스캔하세요.' })
      return
    }

    submittingRef.current = true
    setBusy(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setMsg({ type: 'err', text: '로그인이 필요합니다.' })
      submittingRef.current = false
      setBusy(false)
      return
    }

    let okScans = 0
    const failed: string[] = []

    try {
      for (const row of rows) {
        for (const scan of row.scans) {
          const hit = await findItemByBarcode(supabase, user.id, scan.code, { strictUnitQr: true })
          if (hit?.alreadyShipped) {
            failed.push(`${row.item.name} · ${scan.code} (이미 출고됨)`)
            continue
          }
          if (hit?.unitNotInStock) {
            failed.push(`${row.item.name} · ${scan.code} (재고 없음)`)
            continue
          }
          if (hit?.unitMismatch) {
            failed.push(`${row.item.name} · ${scan.code} (QR 불일치)`)
            continue
          }

          const lotId = hit?.lotId ?? scan.lotId
          const noteParts = ['[일괄출고]', note.trim(), `스캔:${scan.code.trim()}`].filter(Boolean)
          const { error } = await supabase.rpc('apply_stock_move', {
            p_item_id: row.item.id,
            p_direction: 'out',
            p_amount: 1,
            p_note: noteParts.join(' '),
            p_project: project.trim(),
            ...(lotId ? { p_lot_id: lotId } : {}),
          })
          if (error) {
            failed.push(`${row.item.name} · ${scan.code} (${error.message})`)
          } else {
            okScans++
            if (parseUnitSuffixIndex(scan.code) !== null) markRecentlyOutboundScanned(scan.code)
          }
        }
      }

      if (failed.length > 0) {
        setBulkOutConfirmPending(false)
        setMsg({
          type: 'err',
          text: `일부 실패 (${okScans}/${totalScans}건 완료): ${failed.slice(0, 3).join(' / ')}${failed.length > 3 ? ` 외 ${failed.length - 3}건` : ''}`,
        })
        if (okScans > 0) await load()
      } else {
        setMsg({ type: 'ok', text: `출고 완료: ${rows.length}개 품목, 스캔 ${okScans}건 (QR 번호 그대로 기록)` })
        setBucket({})
        setNote('')
        setBulkOutConfirmPending(false)
        setScanLine(null)
        await load()
      }
    } finally {
      submittingRef.current = false
      setBusy(false)
    }
  }, [project, rows, note, totalScans, load])

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-xs text-slate-500 leading-relaxed px-1">
        여러 제품 QR을 연속으로 찍고 프로젝트 1개로 일괄 출고합니다. 스캔한 QR 번호가 출고 이력에 그대로 기록됩니다.
      </p>

      <BarcodeCamera
        onDecode={resolveBarcode}
        videoClassName="w-full max-h-[min(38vh,280px)] min-h-[200px] flex flex-col items-center justify-center bg-slate-950 text-slate-300 py-4"
      />

      {scanLine && (
        <p className="text-center text-xs text-emerald-700 font-medium bg-emerald-50 border border-emerald-100 rounded-xl py-2 px-3">
          {scanLine}
        </p>
      )}
      {pendingScan && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 space-y-2">
          <p className="text-xs text-blue-800">
            스캔 확인 대기: <span className="font-semibold">{pendingScan.itemName}</span> · {pendingScan.code}
          </p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setPendingScan(null)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs"
            >
              취소
            </button>
            <button
              type="button"
              onClick={confirmPendingScan}
              className="rounded-lg bg-blue-600 text-white px-2.5 py-1 text-xs font-medium"
            >
              확인
            </button>
          </div>
        </div>
      )}
      {lastScanAt && (
        <p className="text-center text-[11px] text-emerald-700 bg-emerald-50/70 border border-emerald-100 rounded-xl py-1.5 px-3">
          스캔 확인 · 총 {scanCount}건 · {new Date(lastScanAt).toLocaleTimeString('ko-KR')}
        </p>
      )}

      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
        <label className="block text-sm font-medium text-slate-700">프로젝트 / 현장 *</label>
        <input
          list="bulk-project-options"
          value={project}
          onChange={e => setProject(e.target.value)}
          placeholder="예: OO방송, A행사"
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
        <label className="block text-xs text-slate-500">
          프로젝트 불러오기
          <select
            value={project}
            onChange={e => setProject(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
          >
            <option value="">선택…</option>
            {projectOptions.map(name => (
              <option key={`pick-${name}`} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <datalist id="bulk-project-options">
          {projectOptions.map(name => (
            <option key={name} value={name} />
          ))}
        </datalist>
        {project.trim() && (
          <p className="text-xs text-slate-500">
            {forceUnplannedOutbound
              ? '강제 출고 ON: 예정에 없는 품목도 스캔·출고할 수 있습니다.'
              : '프로젝트 품목만 스캔 등록됩니다. 다른 품목 QR은 자동 차단됩니다.'}
          </p>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={forceUnplannedOutbound}
            onChange={e => setForceUnplannedOutbound(e.target.checked)}
            className="rounded border-slate-300"
          />
          예정 외 품목 강제 출고 허용
        </label>
        <label className="block text-sm font-medium text-slate-700">메모 (선택)</label>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="일괄 출고 메모"
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">
            스캔 목록 ({rows.length}개 품목 / 총 {totalScans}개)
          </p>
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            전체 비우기
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">아직 스캔된 품목이 없습니다.</p>
        ) : (
          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {rows.map(row => (
              <li key={row.item.id} className="rounded-xl border border-slate-200 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{row.item.name}</p>
                    <p className="text-xs text-slate-500">
                      스캔 {row.scans.length}건 · 현재 재고 {row.item.quantity}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLastScan(row.item.id)}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 shrink-0"
                  >
                    1건 취소
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {msg && (
        <p
          className={`text-sm rounded-xl px-3 py-2 ${
            msg.type === 'ok'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
              : 'bg-red-50 text-red-700 border border-red-100'
          }`}
        >
          {msg.text}
        </p>
      )}

      {bulkOutConfirmPending && rows.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-3 space-y-2">
          <p className="text-sm text-orange-900 font-medium">일괄 출고 확인</p>
          <p className="text-xs text-orange-800 leading-relaxed">
            프로젝트 <span className="font-semibold">{project.trim()}</span>로 총{' '}
            <span className="font-semibold">{totalScans}개</span> ({rows.length}개 품목)를 출고할까요?
          </p>
          <ul className="text-[11px] text-orange-800/90 max-h-28 overflow-y-auto space-y-0.5">
            {rows.map(row => (
              <li key={row.item.id}>
                {row.item.name} × {row.scans.length}
              </li>
            ))}
          </ul>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => setBulkOutConfirmPending(false)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runBulkOut()}
              className="rounded-lg bg-orange-600 text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {busy ? '처리 중…' : '확인 출고'}
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={busy || rows.length === 0 || bulkOutConfirmPending}
        onClick={requestBulkOut}
        className="w-full rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 text-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? '출고 처리 중…' : `일괄 출고 실행 (${totalScans}개)`}
      </button>
    </div>
  )
}
