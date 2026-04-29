'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { findItemIdByBarcode } from '@/lib/items/barcodeLookup'
import type { Item } from '@/lib/supabase/types'
import { BarcodeCamera } from '@/components/BarcodeCamera'
import { ChevronDown, Loader2, X } from 'lucide-react'

export function MoveStockClient() {
  const searchParams = useSearchParams()
  const preItem = searchParams.get('item')

  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string>('')
  const [amount, setAmount] = useState(1)
  const [project, setProject] = useState('')
  const [projectOptions, setProjectOptions] = useState<string[]>([])
  const [projectItemMap, setProjectItemMap] = useState<Record<string, string[]>>({})
  const [projectRemainingMap, setProjectRemainingMap] = useState<Record<string, number>>({})
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [scanLine, setScanLine] = useState<string | null>(null)
  const [lastScanAt, setLastScanAt] = useState<string | null>(null)
  const [scanCount, setScanCount] = useState(0)
  const [pendingScan, setPendingScan] = useState<{ code: string; itemId: string; itemName: string } | null>(null)
  const [showPicker, setShowPicker] = useState(false)

  const resolveRef = useRef<(code: string) => Promise<void>>(async () => {})

  const load = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('items').select('*').eq('user_id', user.id).order('name')
    setItems((data ?? []) as Item[])
    const [projectRes, txRes] = await Promise.all([
      supabase.from('project_usage_plans').select('project_name, item_id, planned_qty').eq('user_id', user.id),
      supabase
        .from('stock_transactions')
        .select('project, item_id, direction, amount')
        .eq('user_id', user.id)
        .not('project', 'is', null)
        .neq('project', ''),
    ])
    const rows = (projectRes.data ?? []) as Array<{ project_name?: string; item_id?: string; planned_qty?: number }>
    const txRows = (txRes.data ?? []) as Array<{
      project?: string | null
      item_id?: string
      direction?: 'in' | 'out'
      amount?: number
    }>
    const names = Array.from(new Set(rows.map(r => (r.project_name ?? '').trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    )
    const byProject: Record<string, string[]> = {}
    const plannedMap = new Map<string, number>()
    for (const row of rows) {
      const name = (row.project_name ?? '').trim()
      const itemId = (row.item_id ?? '').trim()
      if (!name || !itemId) continue
      const planned = Math.max(0, Number(row.planned_qty) || 0)
      if (planned <= 0) continue
      byProject[name] = byProject[name] ? [...byProject[name], itemId] : [itemId]
      const key = `${name}::${itemId}`
      plannedMap.set(key, (plannedMap.get(key) ?? 0) + planned)
    }
    const shippedMap = new Map<string, number>()
    for (const tx of txRows) {
      const projectName = (tx.project ?? '').trim()
      const itemId = (tx.item_id ?? '').trim()
      if (!projectName || !itemId) continue
      const amount = Math.max(0, Number(tx.amount) || 0)
      const delta = tx.direction === 'out' ? amount : -amount
      const key = `${projectName}::${itemId}`
      shippedMap.set(key, (shippedMap.get(key) ?? 0) + delta)
    }
    const remainingEntries: Array<[string, number]> = []
    plannedMap.forEach((planned, key) => {
      const shipped = Math.max(0, shippedMap.get(key) ?? 0)
      remainingEntries.push([key, planned - shipped])
    })
    for (const key of Object.keys(byProject)) {
      byProject[key] = Array.from(new Set(byProject[key]))
    }
    setProjectOptions(names)
    setProjectItemMap(byProject)
    setProjectRemainingMap(Object.fromEntries(remainingEntries))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (preItem && items.some(i => i.id === preItem)) {
      setSelectedId(preItem)
      setScanLine('URL로 품목이 지정되었습니다.')
    }
  }, [preItem, items])

  const resolveBarcode = useCallback(async (code: string) => {
    setMsg(null)
    if (pendingScan) {
      setMsg({ type: 'err', text: '이전 스캔을 먼저 확인/취소하세요.' })
      return
    }
    const trimmed = code.trim()
    if (!trimmed) return

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const id = await findItemIdByBarcode(supabase, user.id, trimmed)
    if (id) {
      const selectedProject = project.trim()
      if (selectedProject) {
        const allowed = projectItemMap[selectedProject] ?? []
        if (allowed.length > 0 && !allowed.includes(id)) {
          setMsg({ type: 'err', text: `이 품목은 프로젝트 "${selectedProject}" 예정 품목이 아닙니다.` })
          return
        }
        const remaining = projectRemainingMap[`${selectedProject}::${id}`]
        if (typeof remaining === 'number' && remaining <= 0) {
          setMsg({ type: 'err', text: `이 품목은 프로젝트 "${selectedProject}" 잔여가 없어 출고할 수 없습니다.` })
          return
        }
      }
      const item = items.find(i => i.id === id)
      setPendingScan({ code: trimmed, itemId: id, itemName: item?.name ?? '품목' })
      return
    }
    setMsg({ type: 'err', text: `등록되지 않은 코드: ${trimmed}` })
  }, [items, pendingScan, project, projectItemMap, projectRemainingMap])

  resolveRef.current = resolveBarcode

  /** 무선 스캐너 입력(키보드처럼 들어옴) */
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

  const selected = useMemo(() => items.find(i => i.id === selectedId), [items, selectedId])
  const selectedProject = project.trim()
  const selectedRemaining = useMemo(() => {
    if (!selectedProject || !selectedId) return null
    return projectRemainingMap[`${selectedProject}::${selectedId}`] ?? null
  }, [selectedProject, selectedId, projectRemainingMap])
  const outBlockedByRemaining = selectedProject && selectedRemaining !== null && selectedRemaining <= 0
  const projectItems = useMemo(() => {
    if (!selectedProject) return []
    const ids = new Set(projectItemMap[selectedProject] ?? [])
    return items.filter(i => {
      if (!ids.has(i.id)) return false
      const remaining = projectRemainingMap[`${selectedProject}::${i.id}`]
      return typeof remaining !== 'number' || remaining > 0
    })
  }, [selectedProject, projectItemMap, projectRemainingMap, items])
  const pickerItems = selectedProject ? projectItems : items

  function confirmPendingScan() {
    if (!pendingScan) return
    setSelectedId(pendingScan.itemId)
    setScanLine(`스캔 확인: ${pendingScan.code}`)
    setLastScanAt(new Date().toISOString())
    setScanCount(prev => prev + 1)
    setPendingScan(null)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(35)
    }
  }

  async function run(direction: 'in' | 'out') {
    setMsg(null)
    if (!selectedId || amount < 1) {
      setMsg({ type: 'err', text: '스캔으로 품목을 먼저 선택하세요.' })
      return
    }
    if (direction === 'out' && outBlockedByRemaining) {
      setMsg({ type: 'err', text: '프로젝트 예정 잔여가 0 이하라 출고할 수 없습니다.' })
      return
    }
    const requestAmount = direction === 'out' ? 1 : amount
    setBusy(true)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('apply_stock_move', {
      p_item_id: selectedId,
      p_direction: direction,
      p_amount: requestAmount,
      p_note: note.trim() || null,
      p_project: project.trim() || null,
    })
    setBusy(false)
    if (error) {
      setMsg({ type: 'err', text: error.message })
      return
    }
    if (data) {
      setMsg({ type: 'ok', text: direction === 'in' ? '입고 완료' : '출고 완료 (스캔 1개 기준)' })
      setNote('')
      setAmount(1)
      await load()
    }
  }

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
        카메라로 비추거나, 무선 스캐너로 찍으면 품목이 잡힙니다. 그다음 수량·입고/출고만 누르면 됩니다.
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

      {selected ? (
        <div className="rounded-2xl bg-slate-900 text-white p-4 shadow-md space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 uppercase tracking-wide">선택된 품목</p>
              <p className="text-lg font-bold leading-snug truncate">{selected.name}</p>
              <p className="text-sm text-slate-300 tabular-nums mt-1">현재 재고 {selected.quantity}</p>
              {selectedRemaining !== null && (
                <p className="text-xs text-amber-300 mt-1">프로젝트 예정 잔여 {selectedRemaining}</p>
              )}
              {selected.barcode_code && (
                <p className="text-xs text-slate-500 mt-1 truncate">
                  <span>QR 코드 {selected.barcode_code}</span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedId('')
                setScanLine(null)
                setMsg(null)
              }}
              className="shrink-0 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              aria-label="선택 해제"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : pickerItems.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/80 p-6 text-center text-sm text-slate-600">
          {selectedProject
            ? '선택한 프로젝트에 연결된 품목이 없습니다. 프로젝트 예정 품목을 먼저 등록하세요.'
            : '등록된 품목이 없습니다. 재고 메뉴에서 품목을 먼저 등록한 뒤 다시 오세요.'}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/80 p-6 text-center text-sm text-slate-600">
          QR 코드를 스캔하거나, 아래「직접 품목 고르기」에서 품목을 선택하세요.
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowPicker(s => !s)}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700"
      >
        <span>직접 품목 고르기 (스캔 없이)</span>
        <ChevronDown className={`w-5 h-5 shrink-0 transition-transform ${showPicker ? 'rotate-180' : ''}`} />
      </button>

      {showPicker && (
        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <label className="block text-sm font-medium text-slate-700 mb-2">품목</label>
          <select
            value={selectedId}
            onChange={e => {
              setSelectedId(e.target.value)
              setScanLine(e.target.value ? '목록에서 선택했습니다.' : null)
            }}
            className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base"
          >
            <option value="">선택…</option>
            {pickerItems.map(i => {
              const remaining = selectedProject ? projectRemainingMap[`${selectedProject}::${i.id}`] : undefined
              const blocked = typeof remaining === 'number' && remaining <= 0
              return (
                <option key={i.id} value={i.id}>
                  {i.name} (재고 {i.quantity}
                  {typeof remaining === 'number' ? ` / 잔여 ${remaining}` : ''}
                  {blocked ? ' / 출고잠금' : ''})
                </option>
              )
            })}
          </select>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
        <label className="block text-sm font-medium text-slate-700">프로젝트 / 현장</label>
        <input
          list="project-options"
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
        <datalist id="project-options">
          {projectOptions.map(name => (
            <option key={name} value={name} />
          ))}
        </datalist>
        {selectedProject && (
          <p className="text-xs text-slate-500">
            프로젝트 품목 {projectItems.length}개가 연동됩니다. 스캔 시 해당 품목만 출고 선택됩니다.
          </p>
        )}
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
        <label className="block text-sm font-medium text-slate-700">수량</label>
        <div className="flex gap-2 flex-wrap">
          {[1, 5, 10, 50].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setAmount(n)}
              className={`rounded-xl px-4 py-2 text-sm font-medium border ${
                amount === n ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 border-slate-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={e => setAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
          className="w-full rounded-xl border border-slate-200 px-3 py-3 text-lg font-semibold tabular-nums"
        />
        <p className="text-xs text-slate-500">출고 버튼은 안전을 위해 항상 1개만 처리됩니다.</p>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
        <label className="block text-sm font-medium text-slate-700 mb-1">메모 (선택)</label>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="비고"
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
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

      <div className="grid grid-cols-2 gap-3 pt-1">
        <button
          type="button"
          disabled={busy || !selectedId}
          onClick={() => run('in')}
          className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-5 text-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          입고
        </button>
        <button
          type="button"
          disabled={busy || !selectedId || Boolean(outBlockedByRemaining)}
          onClick={() => run('out')}
          className="rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-semibold py-5 text-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          출고
        </button>
      </div>
      {outBlockedByRemaining && (
        <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-2 py-1.5">
          이 품목은 프로젝트 예정 잔여가 0 이하라 출고가 잠겨 있습니다.
        </p>
      )}
    </div>
  )
}
