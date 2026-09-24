/** 홈 화면용 앱 화면 예시 (실제 앱 UI 모양을 단순화) */
const ROWS = [
  { name: '무선 마이크 수신기', loc: 'A-03', qty: 24 },
  { name: '스피커 CS-4002', loc: 'B-11', qty: 8 },
  { name: '랙 케이스 12U', loc: 'C-01', qty: 3 },
  { name: 'XLR 케이블 10m', loc: 'A-07', qty: 142 },
]

export function PhoneMock() {
  return (
    <div className="relative mx-auto w-[280px] rounded-[2.5rem] border-[10px] border-slate-900 bg-slate-900 shadow-2xl shadow-blue-900/20">
      <div className="overflow-hidden rounded-[1.8rem] bg-[#eef2f7]">
        <div className="px-4 pb-3 pt-6">
          <p className="text-[11px] text-slate-500">오늘의 재고</p>
          <p className="text-lg font-bold text-slate-900">대시보드</p>
        </div>
        <div className="grid grid-cols-2 gap-2 px-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] text-slate-500">총 품목</p>
            <p className="text-lg font-semibold text-slate-900">1,284</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] text-slate-500">총 수량</p>
            <p className="text-lg font-semibold text-blue-600">9,517</p>
          </div>
        </div>
        <div className="mx-4 mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {ROWS.map(r => (
            <div key={r.name} className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5 last:border-0">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-slate-900">{r.name}</p>
                <p className="text-[10px] text-slate-400">위치 {r.loc}</p>
              </div>
              <span className="text-sm font-semibold text-slate-700">{r.qty}</span>
            </div>
          ))}
        </div>
        <div className="mx-4 mb-5 mt-3 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-semibold text-white">
          <span className="inline-block h-3 w-3 rounded-sm border-2 border-white" /> 바코드 스캔
        </div>
      </div>
    </div>
  )
}
