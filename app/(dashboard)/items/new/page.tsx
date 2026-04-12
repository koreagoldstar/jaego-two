import Link from 'next/link'
import { createItemAction } from './actions'

export const dynamic = 'force-dynamic'

function readError(searchParams: Record<string, string | string[] | undefined>) {
  const raw = searchParams.error
  const s = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined
  if (!s) return undefined
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export default function NewItemPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const err = readError(searchParams)

  return (
    <div className="space-y-4 max-w-lg">
      <Link href="/items" className="text-sm text-blue-600">
        ← 품목 목록
      </Link>
      <h1 className="text-xl font-bold text-slate-900">품목 추가</h1>
      {err && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</p>
      )}
      <form action={createItemAction} className="space-y-4 rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
        <Field label="이름 *" name="name" required placeholder="예: 무선 마이크" />
        <Field label="SKU" name="sku" placeholder="내부 코드" />
        <Field label="바코드 값" name="barcode_code" placeholder="스캔에 쓸 문자열 (시리얼 포함 가능)" />
        <Field label="시리얼" name="serial_number" placeholder="표시용 시리얼" />
        <div>
          <label className="block text-sm text-slate-600 mb-1">초기 수량</label>
          <input
            name="quantity"
            type="number"
            min={0}
            defaultValue={0}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
          />
        </div>
        <Field label="위치" name="location" placeholder="선반 A-1" />
        <div>
          <label className="block text-sm text-slate-600 mb-1">메모</label>
          <textarea
            name="description"
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-blue-600 text-white font-medium py-3 shadow-sm"
        >
          저장
        </button>
      </form>
    </div>
  )
}

function Field({
  label,
  name,
  required,
  placeholder,
}: {
  label: string
  name: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm text-slate-600 mb-1">{label}</label>
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
      />
    </div>
  )
}
