import { DiagnoseStockLotsButton } from '@/components/items/DiagnoseStockLotsButton'
import { RefreshLotsButton } from '@/components/items/RefreshLotsButton'

type Props = {
  /** Supabase에서 내려온 에러 문구(있으면 스키마 캐시 여부 판별에 사용) */
  errorMessage?: string | null
}

export function StockLotsMigrationNotice({ errorMessage }: Props) {
  const msg = (errorMessage ?? '').toLowerCase()
  const looksLikeSchemaCache =
    msg.includes('schema cache') || msg.includes('pgrst205')

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950 space-y-3">
      <p className="font-medium">
        {looksLikeSchemaCache
          ? '입고 단위 테이블은 DB에 있을 수 있으나, API가 아직 인식하지 못하고 있습니다'
          : '입고 단위(날짜별) 테이블이 아직 없습니다'}
      </p>

      {looksLikeSchemaCache ? (
        <div className="text-xs text-amber-900/95 space-y-2 leading-relaxed">
          <p>
            <strong>SQL Editor</strong>에서 아래 <strong>한 줄만</strong> 실행한 뒤, 아래「다시 불러오기」를 눌러 주세요.
          </p>
          <pre className="rounded-lg bg-amber-100/90 border border-amber-200/80 p-2 overflow-x-auto text-[11px]">
            NOTIFY pgrst, &apos;reload schema&apos;;
          </pre>
          <p className="text-amber-900/85">
            그래도 같으면 Supabase <strong>Table Editor</strong>에서 <code className="px-1 rounded bg-amber-100">item_stock_lots</code> 테이블이 보이는지 확인하세요. 아래「DB 연결 진단」으로 앱이 붙는 Supabase 주소(
            <code className="px-1 rounded bg-amber-100">xxx.supabase.co</code>)가 대시보드와 같은지 확인합니다.
          </p>
        </div>
      ) : (
        <div className="text-xs text-amber-900/90 space-y-2 leading-relaxed">
          <p>
            Supabase 대시보드 → <strong>SQL Editor</strong>에서 저장소의{' '}
            <code className="rounded bg-amber-100/80 px-1">supabase/migrations/007_item_stock_lots.sql</code>{' '}
            전체를 붙여 넣고 <strong>한 번에 실행</strong>하세요.
          </p>
          <p>
            실행 직후 앱에 같은 메시지가 뜨면 같은 Editor에서{' '}
            <code className="rounded bg-amber-100/80 px-1 text-[11px]">008_postgrest_reload_schema.sql</code> 내용(또는{' '}
            <code className="rounded bg-amber-100/80 px-1 text-[11px]">NOTIFY pgrst, &apos;reload schema&apos;;</code>)을 실행한 뒤「다시 불러오기」를 눌러 보세요.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <RefreshLotsButton />
          <span className="text-[11px] text-amber-800/80">브라우저 새로고침(F5)도 같은 효과입니다.</span>
        </div>
        <DiagnoseStockLotsButton />
      </div>

      <p className="text-xs text-amber-900/80 border-t border-amber-200/60 pt-2">
        그 전까지는 <strong>품목 수정</strong>에서 <strong>수량 0</strong>으로 저장하면 재고를 비울 수 있습니다.
      </p>
    </div>
  )
}
