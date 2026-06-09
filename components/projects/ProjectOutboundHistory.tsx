'use client'

import { ProjectHistoryAccordion } from '@/components/history/ProjectHistoryAccordion'
import { ProjectHeaderActions } from '@/components/projects/ProjectHeaderActions'
import { groupHistoryByProject } from '@/lib/history/groupByProject'

export type OutboundHistoryRow = {
  created_at: string
  project: string
  install_date: string | null
  item_name: string
  amount: number
}

type Props = {
  rows: OutboundHistoryRow[]
  installDateByProject: Record<string, string | null>
}

export function ProjectOutboundHistory({ rows, installDateByProject }: Props) {
  const groups = groupHistoryByProject(
    rows,
    r => r.project,
    r => r.created_at,
  )

  return (
    <ProjectHistoryAccordion
      groups={groups}
      emptyMessage="출고 완료 이력이 없습니다."
      headerAction={projectKey => <ProjectHeaderActions projectName={projectKey} />}
      metaForGroup={group =>
        group.projectKey in installDateByProject
          ? `설치 ${installDateByProject[group.projectKey] || '미정'}`
          : null
      }
      renderItems={items => (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3">출고일시</th>
                <th className="py-2 pr-3">품목</th>
                <th className="py-2 text-right">수량</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, idx) => (
                <tr
                  key={`${row.created_at}-${row.item_name}-${idx}`}
                  className="border-b border-slate-100 last:border-0 bg-white"
                >
                  <td className="py-2 pr-3 text-slate-700">
                    {new Date(row.created_at).toLocaleString('ko-KR')}
                  </td>
                  <td className="py-2 pr-3 text-slate-900">{row.item_name}</td>
                  <td className="py-2 text-right tabular-nums text-orange-700">{row.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    />
  )
}
