'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { saveProjectPlanBatchAction } from '@/app/(dashboard)/projects/actions'

type ItemOption = {
  id: string
  name: string
  quantity: number
}

type Row = {
  id: string
  item_id: string
  planned_qty: number
}

export function ProjectPlanMultiForm({ items }: { items: ItemOption[] }) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()
  const [rows, setRows] = useState<Row[]>([{ id: crypto.randomUUID(), item_id: '', planned_qty: 0 }])
  const resetRows = () => setRows([{ id: crypto.randomUUID(), item_id: '', planned_qty: 0 }])

  const action = (formData: FormData) => {
    startTransition(async () => {
      await saveProjectPlanBatchAction(formData)
      formRef.current?.reset()
      resetRows()
      router.refresh()
    })
  }

  return (
    <form ref={formRef} action={action} className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
      <p className="text-sm font-semibold text-slate-900">사용예정 재고 입력/수정</p>
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="block text-sm text-slate-600 mb-1">프로젝트명</label>
          <input name="project_name" required className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">설치 일정</label>
          <input name="install_date" type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div key={row.id} className="grid grid-cols-[1fr_120px_auto] gap-2 items-end">
            <div>
              <label className="block text-xs text-slate-500 mb-1">품목 {idx + 1}</label>
              <select
                name="item_id"
                value={row.item_id}
                onChange={e =>
                  setRows(prev => prev.map(r => (r.id === row.id ? { ...r, item_id: e.target.value } : r)))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white"
                required
              >
                <option value="">선택…</option>
                {items.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} (현재 {item.quantity})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">사용예정</label>
              <input
                name="planned_qty"
                type="number"
                min={0}
                value={row.planned_qty}
                onChange={e =>
                  setRows(prev =>
                    prev.map(r => (r.id === row.id ? { ...r, planned_qty: Math.max(0, parseInt(e.target.value || '0', 10) || 0) } : r))
                  )
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => setRows(prev => (prev.length <= 1 ? prev : prev.filter(r => r.id !== row.id)))}
              className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-3 py-2.5 text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setRows(prev => [...prev, { id: crypto.randomUUID(), item_id: '', planned_qty: 0 }])}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
        >
          <Plus className="w-4 h-4" />
          품목 추가
        </button>
      </div>

      <p className="text-xs text-slate-500">수량 0으로 저장하면 해당 프로젝트-품목 예정치가 삭제됩니다.</p>
      <button type="submit" className="rounded-xl bg-blue-600 text-white px-4 py-2.5 text-sm font-medium">
        {pending ? '저장 중…' : '일괄 저장'}
      </button>
    </form>
  )
}
