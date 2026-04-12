import { BarcodePanel } from '@/components/BarcodePanel'

export default function BarcodePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">바코드 만들기</h1>
        <p className="text-sm text-slate-500">시리얼까지 포함한 라벨용 CODE128/CODE39</p>
      </div>
      <BarcodePanel />
    </div>
  )
}
