'use client'

import {
  deleteInventoryEventAction,
  deleteStockTransactionAction,
  updateInventoryEventAction,
  updateStockTransactionAction,
} from '@/app/(dashboard)/transactions/actions'
import { ProjectHistoryAccordion } from '@/components/history/ProjectHistoryAccordion'
import { ProjectHeaderActions } from '@/components/projects/ProjectHeaderActions'
import { groupHistoryByProject } from '@/lib/history/groupByProject'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'

export type HistoryRow =
  | {
      kind: 'stock'
      key: string
      rawId: string
      created_at: string
      title: string
      subtitle: string
      detailLines: string[]
      amountText: string
      amountClass: string
      direction: 'in' | 'out'
      amount: number
      note: string
      project: string
    }
  | {
      kind: 'inventory'
      key: string
      rawId: string
      created_at: string
      title: string
      subtitle: string
      detailLines: string[]
      amountText: string
      amountClass: string
      event_type: 'item_create' | 'item_delete'
      item_name: string
      quantity: number
      detail: string
      kindLabel: string
    }

function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function projectKeyForRow(tx: HistoryRow): string {
  if (tx.kind === 'stock') return tx.project
  return ''
}

type RowEditorProps = {
  tx: HistoryRow
  projectOptions: string[]
  busy: string | null
  onCancel: () => void
  onSaveStock: (rawId: string, key: string, formData: FormData) => void
  onSaveInv: (rawId: string, key: string, formData: FormData) => void
}

function projectSelectOptions(projectOptions: string[], current: string): string[] {
  const trimmed = current.trim()
  if (trimmed && !projectOptions.includes(trimmed)) {
    return [trimmed, ...projectOptions]
  }
  return projectOptions
}

function HistoryRowEditor({ tx, projectOptions, busy, onCancel, onSaveStock, onSaveInv }: RowEditorProps) {
  if (tx.kind === 'stock') {
    const options = projectSelectOptions(projectOptions, tx.project)
    return (
      <form className="space-y-2" action={fd => void onSaveStock(tx.rawId, tx.key, fd)}>
        <p className="text-xs font-medium text-slate-700">{tx.title}</p>
        <p className="text-[11px] text-slate-500">
          구분: {tx.direction === 'in' ? '입고' : '출고'} · 수량 {tx.direction === 'in' ? '+' : '−'}
          {tx.amount}
        </p>
        <label className="block text-xs text-slate-500">
          일시
          <input
            name="created_at"
            type="datetime-local"
            defaultValue={toDatetimeLocalValue(tx.created_at)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
            required
          />
        </label>
        <label className="block text-xs text-slate-500">
          프로젝트
          <select
            name="project"
            defaultValue={tx.project.trim()}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 bg-white text-sm"
          >
            <option value="">프로젝트 없음</option>
            {options.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[10px] text-slate-400">저장 시 재고요약·프로젝트 출고 집계에도 반영됩니다.</p>
        <label className="block text-xs text-slate-500">
          메모
          <input
            name="note"
            type="text"
            defaultValue={tx.note}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
          />
        </label>
        {tx.direction === 'out' ? (
          <label className="block text-xs text-slate-500">
            출고 수량
            <input
              name="amount"
              type="number"
              min={1}
              defaultValue={tx.amount}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
              required
            />
          </label>
        ) : null}
        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-3 py-1 text-xs">
            취소
          </button>
          <button
            type="submit"
            disabled={busy === tx.key}
            className="rounded-lg bg-blue-600 text-white px-3 py-1 text-xs font-medium disabled:opacity-50"
          >
            {busy === tx.key ? <Loader2 className="w-4 h-4 animate-spin" /> : '저장'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <form className="space-y-2" action={fd => void onSaveInv(tx.rawId, tx.key, fd)}>
      <label className="block text-xs text-slate-500">
        품목명
        <input
          name="item_name"
          type="text"
          defaultValue={tx.item_name}
          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
          required
        />
      </label>
      <label className="block text-xs text-slate-500">
        일시
        <input
          name="created_at"
          type="datetime-local"
          defaultValue={toDatetimeLocalValue(tx.created_at)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
          required
        />
      </label>
      <label className="block text-xs text-slate-500">
        수량
        <input
          name="quantity"
          type="number"
          min={0}
          defaultValue={tx.quantity}
          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
        />
      </label>
      <label className="block text-xs text-slate-500">
        메모/상세
        <input
          name="detail"
          type="text"
          defaultValue={tx.detail}
          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5"
        />
      </label>
      <p className="text-[11px] text-slate-400">{tx.kindLabel}</p>
      <div className="flex gap-2 justify-end pt-1">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-3 py-1 text-xs">
          취소
        </button>
        <button
          type="submit"
          disabled={busy === tx.key}
          className="rounded-lg bg-blue-600 text-white px-3 py-1 text-xs font-medium disabled:opacity-50"
        >
          {busy === tx.key ? <Loader2 className="w-4 h-4 animate-spin" /> : '저장'}
        </button>
      </div>
    </form>
  )
}

type RowCardProps = {
  tx: HistoryRow
  projectOptions: string[]
  busy: string | null
  editingKey: string | null
  setEditingKey: (key: string | null) => void
  onDelete: (tx: HistoryRow) => void
  onSaveStock: (rawId: string, key: string, formData: FormData) => void
  onSaveInv: (rawId: string, key: string, formData: FormData) => void
}

function HistoryRowCard({
  tx,
  projectOptions,
  busy,
  editingKey,
  setEditingKey,
  onDelete,
  onSaveStock,
  onSaveInv,
}: RowCardProps) {
  return (
    <li className="rounded-xl bg-white border border-slate-200 px-4 py-3 shadow-sm flex justify-between gap-3 text-sm">
      {editingKey === tx.key ? (
        <div className="w-full">
          <HistoryRowEditor
            tx={tx}
            projectOptions={projectOptions}
            busy={busy}
            onCancel={() => setEditingKey(null)}
            onSaveStock={onSaveStock}
            onSaveInv={onSaveInv}
          />
        </div>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-900 truncate">{tx.title}</p>
            <p className="text-xs text-slate-400">{new Date(tx.created_at).toLocaleString('ko-KR')}</p>
            {tx.subtitle ? <p className="text-xs text-slate-500 mt-0.5">{tx.subtitle}</p> : null}
            {tx.detailLines.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {tx.detailLines.map(line => (
                  <p key={`${tx.key}-${line}`} className="text-[11px] text-slate-500 break-all">
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <span className={`inline-block font-semibold tabular-nums ${tx.amountClass}`}>{tx.amountText}</span>
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={() => setEditingKey(tx.key)}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <Pencil className="w-3.5 h-3.5" />
                수정
              </button>
              <button
                type="button"
                disabled={busy === tx.key}
                onClick={() => void onDelete(tx)}
                className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline disabled:opacity-50"
              >
                {busy === tx.key ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                삭제
              </button>
            </div>
          </div>
        </>
      )}
    </li>
  )
}

export function TransactionsHistoryClient({
  rows,
  projectOptions,
}: {
  rows: HistoryRow[]
  projectOptions: string[]
}) {
  const router = useRouter()
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const groups = useMemo(
    () => groupHistoryByProject(rows, projectKeyForRow, tx => tx.created_at),
    [rows],
  )

  const onSaveStock = useCallback(
    async (rawId: string, key: string, formData: FormData) => {
      setBusy(key)
      const res = await updateStockTransactionAction(rawId, formData)
      setBusy(null)
      if (!res.ok) {
        alert(res.error)
        return
      }
      setEditingKey(null)
      router.refresh()
    },
    [router],
  )

  const onDelete = useCallback(
    async (tx: HistoryRow) => {
      const label = tx.kind === 'stock' ? tx.title : tx.item_name
      if (!window.confirm(`이 이력을 삭제할까요?\n${label}\n(재고는 되돌리거나 차감됩니다)`)) return
      setBusy(tx.key)
      const res =
        tx.kind === 'stock'
          ? await deleteStockTransactionAction(tx.rawId)
          : await deleteInventoryEventAction(tx.rawId)
      setBusy(null)
      if (!res.ok) {
        alert(res.error)
        return
      }
      if (editingKey === tx.key) setEditingKey(null)
      router.refresh()
    },
    [router, editingKey],
  )

  const onSaveInv = useCallback(
    async (rawId: string, key: string, formData: FormData) => {
      setBusy(key)
      const res = await updateInventoryEventAction(rawId, formData)
      setBusy(null)
      if (!res.ok) {
        alert(res.error)
        return
      }
      setEditingKey(null)
      router.refresh()
    },
    [router],
  )

  return (
    <ProjectHistoryAccordion
      groups={groups}
      emptyMessage="기록이 없습니다."
      headerAction={projectKey => <ProjectHeaderActions projectName={projectKey} />}
      renderItems={items => (
        <ul className="space-y-2">
          {items.map(tx => (
            <HistoryRowCard
              key={tx.key}
              tx={tx}
              projectOptions={projectOptions}
              busy={busy}
              editingKey={editingKey}
              setEditingKey={setEditingKey}
              onDelete={onDelete}
              onSaveStock={onSaveStock}
              onSaveInv={onSaveInv}
            />
          ))}
        </ul>
      )}
    />
  )
}
