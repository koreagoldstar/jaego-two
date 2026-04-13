import { BulkOutClient } from '@/components/BulkOutClient'

export default function MoveBulkPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">다중 스캔 일괄 출고</h1>
        <p className="text-sm text-slate-500">
          여러 바코드를 연속 스캔해 같은 프로젝트로 한 번에 출고합니다.
        </p>
      </div>
      <BulkOutClient />
    </div>
  )
}
