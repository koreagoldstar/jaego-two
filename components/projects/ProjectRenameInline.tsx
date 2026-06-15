'use client'

import { updateProjectMetaAction } from '@/app/(dashboard)/projects/actions'
import { NO_PROJECT_LABEL } from '@/lib/history/groupByProject'
import { Loader2, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

function toDateInputValue(value: string | null): string {
  if (!value) return ''
  return value.slice(0, 10)
}

type Props = {
  projectName: string
  installDate?: string | null
  className?: string
}

export function ProjectRenameInline({ projectName, installDate = null, className }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [nextName, setNextName] = useState(projectName)
  const [nextDate, setNextDate] = useState(toDateInputValue(installDate))
  const [busy, setBusy] = useState(false)

  if (!projectName || projectName === NO_PROJECT_LABEL) return null

  const cancel = () => {
    setNextName(projectName)
    setNextDate(toDateInputValue(installDate))
    setEditing(false)
  }

  const save = async () => {
    const trimmed = nextName.trim()
    if (!trimmed) {
      alert('프로젝트명을 입력하세요.')
      return
    }

    const nameChanged = trimmed !== projectName
    const dateChanged = nextDate !== toDateInputValue(installDate)
    if (!nameChanged && !dateChanged) {
      setEditing(false)
      return
    }

    const lines = ['프로젝트 정보를 변경합니다.']
    if (nameChanged) lines.push(`이름: "${projectName}" → "${trimmed}"`)
    if (dateChanged) {
      lines.push(
        `설치 일정: ${installDate ? toDateInputValue(installDate) : '미정'} → ${nextDate || '미정'}`,
      )
    }
    lines.push('사용예정·재고요약·출고 이력에 반영됩니다. 계속할까요?')
    if (!window.confirm(lines.join('\n'))) return

    setBusy(true)
    const fd = new FormData()
    fd.set('old_name', projectName)
    fd.set('new_name', trimmed)
    fd.set('install_date', nextDate)
    const res = await updateProjectMetaAction(fd)
    setBusy(false)
    if (!res.ok) {
      alert(res.error)
      return
    }
    setEditing(false)
    router.refresh()
  }

  if (editing) {
    return (
      <div className={`flex flex-col gap-2 w-full ${className ?? ''}`}>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={nextName}
            onChange={e => setNextName(e.target.value)}
            placeholder="프로젝트명"
            className="min-w-[10rem] flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm"
            autoFocus
            disabled={busy}
          />
          <input
            type="date"
            value={nextDate}
            onChange={e => setNextDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
            disabled={busy}
            aria-label="설치 일정"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="rounded-lg bg-blue-600 text-white px-2.5 py-1 text-xs font-medium disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '저장'}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs disabled:opacity-50"
          >
            취소
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setNextName(projectName)
        setNextDate(toDateInputValue(installDate))
        setEditing(true)
      }}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 ${className ?? ''}`}
      title="프로젝트명·설치 일정 변경"
    >
      <Pencil className="w-3.5 h-3.5" />
      수정
    </button>
  )
}
