export function StockLotsMigrationNotice() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950 space-y-2">
      <p className="font-medium">입고 단위(날짜별) 테이블이 아직 없습니다</p>
      <p className="text-xs text-amber-900/90 leading-relaxed">
        Supabase 대시보드 → <strong>SQL Editor</strong>에서 저장소의{' '}
        <code className="rounded bg-amber-100/80 px-1">supabase/migrations/007_item_stock_lots.sql</code>{' '}
        내용을 붙여 넣고 실행하세요. 실행 후에는 품목 상세에서 날짜별 입고 추가·삭제가 가능합니다.
      </p>
      <p className="text-xs text-amber-900/80">
        그 전까지는 <strong>품목 수정</strong> 화면의 <strong>수량</strong>에 <strong>0</strong>을 넣으면 재고를 비울 수 있습니다.
      </p>
    </div>
  )
}
