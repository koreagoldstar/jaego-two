'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ProjectHistoryGroup } from '@/lib/history/groupByProject'
import { NO_PROJECT_LABEL } from '@/lib/history/groupByProject'

type Props<T> = {
  groups: ProjectHistoryGroup<T>[]
  emptyMessage: string
  metaForGroup?: (group: ProjectHistoryGroup<T>) => string | null
  headerAction?: (projectKey: string) => ReactNode
  renderItems: (items: T[], projectKey: string) => ReactNode
}

export function ProjectHistoryAccordion<T>({
  groups,
  emptyMessage,
  metaForGroup,
  headerAction,
  renderItems,
}: Props<T>) {
  if (groups.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>
  }

  return (
    <div className="space-y-2">
      {groups.map(group => {
        const meta = metaForGroup?.(group)
        const latestLabel = group.latestAt
          ? new Date(group.latestAt).toLocaleString('ko-KR')
          : ''
        return (
          <details
            key={group.projectKey}
            className="group rounded-xl border border-slate-200 bg-white overflow-hidden"
          >
            <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <p
                    className={`font-medium truncate ${
                      group.projectKey === NO_PROJECT_LABEL ? 'text-slate-600' : 'text-slate-900'
                    }`}
                  >
                    {group.projectKey}
                  </p>
                  {headerAction && group.projectKey !== NO_PROJECT_LABEL ? (
                    <span
                      className="shrink-0"
                      onClick={e => e.preventDefault()}
                      onKeyDown={e => e.stopPropagation()}
                    >
                      {headerAction(group.projectKey)}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {group.items.length}건
                  {latestLabel ? ` · 최근 ${latestLabel}` : ''}
                  {meta ? ` · ${meta}` : ''}
                </p>
              </div>
              <ChevronDown className="w-5 h-5 text-slate-400 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50">
              {renderItems(group.items, group.projectKey)}
            </div>
          </details>
        )
      })}
    </div>
  )
}
