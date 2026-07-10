'use client'

import { TransactionsHistoryClient } from '@/components/transactions/TransactionsHistoryClient'
import {
  mapStockTransactionsToHistoryRows,
  mergeHistoryRows,
} from '@/lib/transactions/mapHistoryRows'
import { HISTORY_UI_LIMIT } from '@/lib/transactions/historyLimits'
import { createClient } from '@/lib/supabase/client'
import { Download, FolderKanban, Loader2, Search } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

export const PROJECT_NONE_KEY = '__none__'

type Props = {
  projectOptions: string[]
  initialProject?: string
}

function matchesProject(name: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return name.toLowerCase().includes(q)
}

function displayProjectName(key: string): string {
  return key === PROJECT_NONE_KEY ? '프로젝트 없음' : key
}

export function ProjectTransactionsClient({ projectOptions, initialProject }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState('')
  const [selectedKey, setSelectedKey] = useState(initialProject ?? '')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [historyKey, setHistoryKey] = useState(0)
  const [historyRows, setHistoryRows] = useState<ReturnType<typeof mergeHistoryRows>>([])

  const allProjects = useMemo(
    () => [PROJECT_NONE_KEY, ...projectOptions.filter(Boolean)],
    [projectOptions],
  )

  const filtered = useMemo(() => {
    const matched = allProjects.filter(name => matchesProject(displayProjectName(name), query))
    return matched.sort((a, b) => {
      if (a === PROJECT_NONE_KEY) return 1
      if (b === PROJECT_NONE_KEY) return -1
      return a.localeCompare(b, 'ko')
    })
  }, [allProjects, query])

  const loadHistory = useCallback(async (projectKey: string) => {
    if (!projectKey) {
      setHistoryRows([])
      return
    }
    setLoading(true)
    setLoadError(null)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      setLoadError('로그인이 필요합니다')
      return
    }

    let txQuery = supabase
      .from('stock_transactions')
      .select('id, direction, amount, note, project, lot_code, created_at, items(name, barcode_code)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(HISTORY_UI_LIMIT)

    if (projectKey === PROJECT_NONE_KEY) {
      txQuery = txQuery.or('project.is.null,project.eq.')
    } else {
      txQuery = txQuery.eq('project', projectKey)
    }

    const txRes = await txQuery

    setLoading(false)
    if (txRes.error) {
      setLoadError(txRes.error.message)
      setHistoryRows([])
      return
    }

    const stockRows = mapStockTransactionsToHistoryRows(
      (txRes.data ?? []) as unknown as Parameters<typeof mapStockTransactionsToHistoryRows>[0],
    )
    setHistoryRows(mergeHistoryRows(stockRows, []))
    setHistoryKey(k => k + 1)
  }, [])

  useEffect(() => {
    if (selectedKey) void loadHistory(selectedKey)
    else setHistoryRows([])
  }, [selectedKey, loadHistory])

  const selectProject = (projectKey: string) => {
    setSelectedKey(projectKey)
    const params = new URLSearchParams(searchParams.toString())
    if (projectKey) params.set('project', projectKey)
    else params.delete('project')
    const qs = params.toString()
    router.replace(qs ? `/transactions/by-project?${qs}` : '/transactions/by-project', { scroll: false })
  }

  const selectedLabel = selectedKey ? displayProjectName(selectedKey) : ''

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
        <label className="block text-sm font-medium text-slate-700">프로젝트 검색</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="프로젝트 이름 검색"
            className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm"
            autoComplete="off"
          />
        </div>
        <p className="text-xs text-slate-500">프로젝트를 선택하면 해당 현장·프로젝트 입·출고만 모아서 볼 수 있습니다.</p>

        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">검색 결과가 없습니다.</p>
        ) : (
          <ul className="max-h-56 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
            {filtered.map(name => {
              const active = name === selectedKey
              return (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => selectProject(name)}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 ${
                      active ? 'bg-violet-50 text-violet-900' : 'text-slate-800'
                    }`}
                  >
                    <p className="font-medium truncate">{displayProjectName(name)}</p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {selectedKey ? (
        <div className="rounded-2xl bg-violet-900 text-white p-4 shadow-md space-y-3">
          <div className="flex items-start gap-3">
            <FolderKanban className="w-5 h-5 text-violet-300 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-violet-300 uppercase tracking-wide">선택된 프로젝트</p>
              <p className="text-lg font-bold break-words">{selectedLabel}</p>
            </div>
          </div>
          {selectedKey !== PROJECT_NONE_KEY && (
            <a
              href={`/api/transactions/export?project=${encodeURIComponent(selectedKey)}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 px-3 py-2 text-sm text-white"
            >
              <Download className="w-4 h-4" />
              이 프로젝트 이력 엑셀 다운로드
            </a>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500 rounded-2xl border border-dashed border-slate-300 p-6 text-center bg-white">
          위에서 프로젝트를 검색해 선택하세요.
        </p>
      )}

      {loading && (
        <div className="flex justify-center py-8 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {loadError && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{loadError}</p>
      )}

      {!loading && selectedKey && historyRows.length === 0 && !loadError && (
        <p className="text-sm text-slate-500 rounded-2xl border border-dashed border-slate-300 p-6 text-center bg-white">
          이 프로젝트의 입출고 이력이 없습니다.
        </p>
      )}

      {!loading && historyRows.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-slate-900">
            입출고 내역{' '}
            <span className="text-sm font-normal text-slate-500">
              ({historyRows.length}건 · 최대 {HISTORY_UI_LIMIT}건)
            </span>
          </h2>
          <TransactionsHistoryClient
            key={`${selectedKey}-${historyKey}`}
            rows={historyRows}
            projectOptions={projectOptions}
            groupBy="flat"
            onHistoryMutated={() => void loadHistory(selectedKey)}
          />
        </section>
      )}
    </div>
  )
}
