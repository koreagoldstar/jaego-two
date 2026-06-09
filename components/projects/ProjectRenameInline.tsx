'use client'

import { renameProjectAction } from '@/app/(dashboard)/projects/actions'
import { NO_PROJECT_LABEL } from '@/lib/history/groupByProject'
import { Loader2, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = {
  projectName: string
  className?: string
}

export function ProjectRenameInline({ projectName, className }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [nextName, setNextName] = useState(projectName)
  const [busy, setBusy] = useState(false)

  if (!projectName || projectName === NO_PROJECT_LABEL) return null

  const cancel = () => {
    setNextName(projectName)
    setEditing(false)
  }

  const save = async () => {
    const trimmed = nextName.trim()
    if (!trimmed) {
      alert('프로젝트명을 입력하세요.')
      return
    }
    if (trimmed === projectName) {
      setEditing(false)
      return
    }
    if (
      !window.confirm(
        `프로젝트명을 "${projectName}" → "${trimmed}"(으)로 바꿉니다.\n사용예정·출고 이력·완료 상태가 모두 반영됩니다. 계속할까요?`,
      )
    ) {
      return
    }

    setBusy(true)
    const fd = new FormData()
    fd.set('old_name', projectName)
    fd.set('new_name', trimmed)
    const res = await renameProjectAction(fd)
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
      <div className={`flex flex-wrap items-center gap-2 ${className ?? ''}`}>
        <input
          type="text"
          value={nextName}
          onChange={e => setNextName(e.target.value)}
          className="min-w-[10rem] flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm"
          autoFocus
          disabled={busy}
        />
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
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setNextName(projectName)
        setEditing(true)
      }}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 ${className ?? ''}`}
      title="프로젝트명 변경"
    >
      <Pencil className="w-3.5 h-3.5" />
      이름 변경
    </button>
  )
}
