import {
  completeProjectAction,
  deleteProjectPlanAction,
  reopenProjectAction,
  saveProjectPlanAction,
  updateProjectPlanEntryAction,
} from '@/app/(dashboard)/projects/actions'

type ItemRow = { id: string; name: string; quantity: number }

type PlanLine = {
  project_name: string
  install_date: string | null
  item_id: string
  planned_qty: number
  shipped: number
  remaining: number
}

type Props = {
  projectName: string
  installDate: string | null
  completedAt?: string | null
  items: ItemRow[]
  rows: PlanLine[]
  mode: 'active' | 'completed'
}

export function ProjectPlanSection({
  projectName,
  installDate,
  completedAt,
  items,
  rows,
  mode,
}: Props) {
  const readOnly = mode === 'completed'

  return (
    <section
      className={`rounded-2xl border p-4 shadow-sm space-y-3 ${
        readOnly ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{projectName}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            설치 일정: {installDate || '미정'}
            {readOnly && completedAt ? (
              <span className="ml-2 text-slate-600">
                · 완료: {new Date(completedAt).toLocaleDateString('ko-KR')}
              </span>
            ) : null}
          </p>
        </div>
        {readOnly ? (
          <form action={reopenProjectAction}>
            <input type="hidden" name="project_name" value={projectName} />
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              다시 진행
            </button>
          </form>
        ) : (
          <form action={completeProjectAction}>
            <input type="hidden" name="project_name" value={projectName} />
            <button
              type="submit"
              className="rounded-lg bg-slate-800 text-white px-3 py-1.5 text-sm font-medium hover:bg-slate-900"
            >
              완료 처리
            </button>
          </form>
        )}
      </div>

      {!readOnly && (
        <form action={saveProjectPlanAction} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 md:grid-cols-[1fr_120px_auto]">
          <input type="hidden" name="project_name" value={projectName} />
          <input type="hidden" name="install_date" value={installDate ?? ''} />
          <div>
            <label className="sr-only" htmlFor={`add-item-${projectName}`}>
              품목 추가
            </label>
            <select
              id={`add-item-${projectName}`}
              name="item_id"
              required
              defaultValue=""
              className="w-full rounded-md border border-slate-200 px-2 py-2 text-sm bg-white"
            >
              <option value="" disabled>
                이 프로젝트에 품목 추가…
              </option>
              {items.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="sr-only" htmlFor={`add-qty-${projectName}`}>
              사용예정 수량
            </label>
            <input
              id={`add-qty-${projectName}`}
              name="planned_qty"
              type="number"
              min={0}
              defaultValue={1}
              className="w-full rounded-md border border-slate-200 px-2 py-2 text-sm text-right tabular-nums bg-white"
            />
          </div>
          <button type="submit" className="rounded-md bg-emerald-600 text-white px-3 py-2 text-sm font-medium whitespace-nowrap">
            품목 추가
          </button>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-3">품목</th>
              <th className="py-2 pr-3 text-right">현재 재고</th>
              <th className="py-2 pr-3 text-right">사용예정</th>
              <th className="py-2 pr-3 text-right">출고완료</th>
              <th className="py-2 text-right">예정 잔여</th>
              {!readOnly && <th className="py-2 pl-3 text-right">수정/삭제</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={`${row.project_name}-${row.item_id}`} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-3 text-slate-900">{items.find(i => i.id === row.item_id)?.name ?? '품목'}</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {items.find(i => i.id === row.item_id)?.quantity ?? 0}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{row.planned_qty}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{row.shipped}</td>
                <td
                  className={`py-2 text-right tabular-nums ${row.remaining <= 0 ? 'text-emerald-600' : 'text-orange-600'}`}
                >
                  {row.remaining}
                </td>
                {!readOnly && (
                  <td className="py-2 pl-3">
                    <div className="flex justify-end gap-2">
                      <form action={updateProjectPlanEntryAction} className="flex items-center gap-1.5">
                        <input type="hidden" name="project_name" value={row.project_name} />
                        <input type="hidden" name="install_date" value={row.install_date ?? ''} />
                        <input type="hidden" name="original_item_id" value={row.item_id} />
                        <select
                          name="item_id"
                          defaultValue={row.item_id}
                          className="max-w-[11rem] rounded-md border border-slate-200 px-2 py-1 text-xs"
                          aria-label="품목 선택"
                        >
                          {items.map(item => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                        <input
                          name="planned_qty"
                          type="number"
                          min={0}
                          defaultValue={row.planned_qty}
                          className="w-20 rounded-md border border-slate-200 px-2 py-1 text-xs text-right tabular-nums"
                        />
                        <button
                          type="submit"
                          className="rounded-md bg-blue-600 text-white px-2 py-1 text-xs font-medium whitespace-nowrap"
                        >
                          수정
                        </button>
                      </form>
                      <form action={deleteProjectPlanAction}>
                        <input type="hidden" name="project_name" value={row.project_name} />
                        <input type="hidden" name="item_id" value={row.item_id} />
                        <button
                          type="submit"
                          className="rounded-md border border-red-200 bg-red-50 text-red-700 px-2 py-1 text-xs font-medium whitespace-nowrap"
                        >
                          삭제
                        </button>
                      </form>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
