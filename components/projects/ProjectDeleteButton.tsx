'use client'

import { deleteProjectAction } from '@/app/(dashboard)/projects/actions'
import { NO_PROJECT_LABEL } from '@/lib/history/groupByProject'
import { Loader2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = {
  projectName: string
  variant?: 'inline' | 'button'
  className?: string
}

export function ProjectDeleteButton({ projectName, variant = 'inline', className }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (!projectName || projectName === NO_PROJECT_LABEL) return null

  const run = async () => {
    if (
      !window.confirm(
        `프로젝트 "${projectName}"을(를) 삭제할까요?\n\n` +
          '· 사용예정 재고·완료 상태가 삭제됩니다\n' +
          '· 입출고 이력은 유지되며 프로젝트만 「없음」으로 바뀝니다\n' +
          '· 실제 재고 수량은 변하지 않습니다',
      )
    ) {
      return
    }

    setBusy(true)
    const fd = new FormData()
    fd.set('project_name', projectName)
    const res = await deleteProjectAction(fd)
    setBusy(false)
    if (!res.ok) {
      alert(res.error)
      return
    }
    router.refresh()
  }

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50 ${className ?? ''}`}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        프로젝트 삭제
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => void run()}
      disabled={busy}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 ${className ?? ''}`}
      title="프로젝트 삭제"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      삭제
    </button>
  )
}
