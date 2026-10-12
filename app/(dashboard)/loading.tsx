/** 화면 이동 시 서버 응답을 기다리는 동안 바로 보여 주는 뼈대 */
export default function DashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="불러오는 중">
      <div className="h-7 w-32 rounded-lg bg-slate-200/80" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 rounded-2xl bg-white/70 border border-slate-200" />
        <div className="h-20 rounded-2xl bg-white/70 border border-slate-200" />
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="h-14 rounded-2xl bg-white/70 border border-slate-200" />
        ))}
      </div>
    </div>
  )
}
