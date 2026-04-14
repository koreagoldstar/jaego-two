'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { findItemIdByBarcode } from '@/lib/items/barcodeLookup'
import type { Item } from '@/lib/supabase/types'
import { BarcodeCamera } from '@/components/BarcodeCamera'
import { Loader2, Trash2 } from 'lucide-react'

type ScanBucket = {
  item: Item
  count: number
}

export function BulkOutClient() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState('')
  const [projectOptions, setProjectOptions] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [scanLine, setScanLine] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [bucket, setBucket] = useState<Record<string, ScanBucket>>({})
  const resolveRef = useRef<(code: string) => Promise<void>>(async () => {})

  const load = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('items').select('*').eq('user_id', user.id).order('name')
    setItems((data ?? []) as Item[])
    const { data: projectRows } = await supabase
      .from('project_usage_plans')
      .select('project_name')
      .eq('user_id', user.id)
    const names = Array.from(
      new Set((projectRows ?? []).map(r => (r as { project_name?: string }).project_name?.trim() ?? '').filter(Boolean))
    ).sort((a, b) => a.localeCompare(b))
    setProjectOptions(names)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const resolveBarcode = useCallback(
    async (code: string) => {
      setMsg(null)
      const trimmed = code.trim()
      if (!trimmed) return

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const id = await findItemIdByBarcode(supabase, user.id, trimmed)
      if (!id) {
        setMsg({ type: 'err', text: `등록되지 않은 바코드: ${trimmed}` })
        return
      }

      const item = items.find(i => i.id === id)
      if (!item) {
        setMsg({ type: 'err', text: '품목 정보를 찾을 수 없습니다. 새로고침 후 다시 시도하세요.' })
        return
      }

      setBucket(prev => {
        const current = prev[id]
        const nextCount = (current?.count ?? 0) + 1
        return {
          ...prev,
          [id]: { item, count: nextCount },
        }
      })
      setScanLine(`${item.name} 스캔 +1`)
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(35)
    },
    [items]
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
  const totalScans = useMemo(() => rows.reduce((s, r) => s + r.count, 0), [rows])

  const updateCount = useCallback((itemId: string, count: number) => {
    setBucket(prev => {
      const row = prev[itemId]
      if (!row) return prev
      if (count <= 0) {
        const next = { ...prev }
        delete next[itemId]
        return next
      }
      return { ...prev, [itemId]: { ...row, count } }
    })
  }, [])

  const clearAll = useCallback(() => {
    setBucket({})
    setMsg(null)
    setScanLine(null)
  }, [])

  const runBulkOut = useCallback(async () => {
    setMsg(null)
    if (!project.trim()) {
      setMsg({ type: 'err', text: '프로젝트/현장을 입력하세요.' })
      return
    }
    if (rows.length === 0) {
      setMsg({ type: 'err', text: '먼저 바코드를 스캔하세요.' })
      return
    }

    setBusy(true)
    const supabase = createClient()
    let okCount = 0
    const failed: string[] = []

    for (const row of rows) {
      const { error } = await supabase.rpc('apply_stock_move', {
        p_item_id: row.item.id,
        p_direction: 'out',
        p_amount: row.count,
        p_note: note.trim() || null,
        p_project: project.trim(),
      })
      if (error) {
        failed.push(`${row.item.name} (${error.message})`)
      } else {
        okCount++
      }
    }

    setBusy(false)
    if (failed.length > 0) {
      setMsg({
        type: 'err',
        text: `일부 실패: ${failed.slice(0, 3).join(' / ')}${failed.length > 3 ? ` 외 ${failed.length - 3}건` : ''}`,
      })
    } else {
      setMsg({ type: 'ok', text: `출고 완료: ${okCount}개 품목, 총 ${totalScans}개` })
      setBucket({})
      setNote('')
      await load()
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
        여러 제품 바코드를 연속으로 찍고, 프로젝트 1개로 한 번에 출고 처리합니다.
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

      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
        <label className="block text-sm font-medium text-slate-700">프로젝트 / 현장 *</label>
        <input
          list="bulk-project-options"
          value={project}
          onChange={e => setProject(e.target.value)}
          placeholder="예: OO방송, A행사"
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
        <datalist id="bulk-project-options">
          {projectOptions.map(name => (
            <option key={name} value={name} />
          ))}
        </datalist>
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
                    <p className="text-xs text-slate-500">현재 재고 {row.item.quantity}</p>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={row.count}
                    onChange={e => updateCount(row.item.id, Math.max(1, parseInt(e.target.value || '1', 10)))}
                    className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-right tabular-nums"
                  />
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

      <button
        type="button"
        disabled={busy || rows.length === 0}
        onClick={() => void runBulkOut()}
        className="w-full rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 text-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? '출고 처리 중…' : `일괄 출고 실행 (${totalScans}개)`}
      </button>
    </div>
  )
}
