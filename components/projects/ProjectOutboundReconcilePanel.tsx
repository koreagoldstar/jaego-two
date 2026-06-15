'use client'

import {
  reconcileProjectOutboundAction,
  reconcileProjectOutboundForceAction,
} from '@/app/(dashboard)/projects/actions'
import type { OutboundReconcileReport } from '@/lib/projects/outboundReconcile'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = {
  report: OutboundReconcileReport
  projectOptions: string[]
}

export function ProjectOutboundReconcilePanel({ report, projectOptions }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [forceProject, setForceProject] = useState(projectOptions[0] ?? '')
  const [result, setResult] = useState<{ matched: number; forced?: number } | null>(null)

  const needsAttention =
    report.assignableCount > 0 || report.forceAssignableCount > 0 || report.noPlanCount > 0

  if (!needsAttention && !result) return null

  async function runMatch() {
    if (report.assignableCount === 0) return
    if (!window.confirm(`${report.assignableCount}건의 출고 이력을 프로젝트 사용예정에 맞게 연결할까요?`)) return

    setBusy(true)
    const res = await reconcileProjectOutboundAction()
    setBusy(false)

    if (!res.ok) {
      alert(res.error)
      return
    }

    setResult({ matched: res.matched })
    router.refresh()
  }

  async function runForceMatch() {
    const target = forceProject.trim()
    if (!target) {
      alert('프로젝트를 선택하세요')
      return
    }
    if (report.forceAssignableCount === 0) return
    if (
      !window.confirm(
        `품목 예정이 없는 출고 ${report.forceAssignableCount}건을 프로젝트「${target}」에 강제 연결할까요?\n(사용예정 수량에는 반영되지 않고 이력·프로젝트만 연결됩니다.)`,
      )
    ) {
      return
    }

    setBusy(true)
    const fd = new FormData()
    fd.set('project_name', target)
    const res = await reconcileProjectOutboundForceAction(fd)
    setBusy(false)

    if (!res.ok) {
      alert(res.error)
      return
    }

    setResult(prev => ({ matched: prev?.matched ?? 0, forced: res.matched }))
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-amber-900">출고 이력 · 사용예정 매칭</h2>
        <p className="text-xs text-amber-800 mt-0.5">
          프로젝트가 비어 있거나 예정과 맞지 않는 출고를 사용예정(진행·완료 프로젝트)에 자동 연결합니다.
        </p>
      </div>

      <ul className="text-xs text-amber-900 space-y-1">
        {report.orphanCount > 0 && <li>프로젝트 미지정 출고: {report.orphanCount}건</li>}
        {report.misassignedCount > 0 && <li>예정과 불일치 출고: {report.misassignedCount}건</li>}
        {report.forceAssignableCount > 0 && (
          <li className="text-amber-700">품목 예정 없음(강제 연결 가능): {report.forceAssignableCount}건</li>
        )}
        {report.noPlanCount > report.forceAssignableCount && (
          <li className="text-amber-700">
            품목 예정 없음(이미 프로젝트 지정됨): {report.noPlanCount - report.forceAssignableCount}건
          </li>
        )}
        {result && (
          <li className="text-emerald-800 font-medium">
            매칭 완료: {result.matched}건
            {typeof result.forced === 'number' && result.forced > 0 ? ` · 강제 연결 ${result.forced}건` : ''}
          </li>
        )}
      </ul>

      <div className="flex flex-wrap gap-2">
        {report.assignableCount > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void runMatch()}
            className="rounded-lg bg-amber-700 text-white px-3 py-2 text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {busy ? '매칭 중…' : `출고 ${report.assignableCount}건 자동 매칭`}
          </button>
        )}

        {report.forceAssignableCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              value={forceProject}
              onChange={e => setForceProject(e.target.value)}
              className="rounded-lg border border-amber-300 bg-white px-2 py-2 text-sm min-w-40"
            >
              <option value="">프로젝트 선택…</option>
              {projectOptions.map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !forceProject.trim()}
              onClick={() => void runForceMatch()}
              className="rounded-lg border border-amber-800 bg-white text-amber-900 px-3 py-2 text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              예정 없이 {report.forceAssignableCount}건 강제 연결
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
