import { BarcodePanel } from '@/components/BarcodePanel'

export default function BarcodePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">바코드 만들기</h1>
        <p className="text-sm text-slate-500">
          등록 품목을 고르거나 직접 입력 · 여러 품목 동시 인쇄·PNG
        </p>
      </div>
      <BarcodePanel />
    </div>
  )
}
