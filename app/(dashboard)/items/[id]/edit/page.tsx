import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Item } from '@/lib/supabase/types'
import { updateItemAction } from './actions'

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

export default async function EditItemPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: Record<string, string | string[] | undefined>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: row } = await supabase
    .from('items')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!row) notFound()
  const item = row as Item
  const err = readError(searchParams)

  const boundUpdate = updateItemAction.bind(null, item.id)

  return (
    <div className="space-y-4 max-w-lg">
      <Link href={`/items/${item.id}`} className="text-sm text-blue-600">
        ← 상세
      </Link>
      <h1 className="text-xl font-bold text-slate-900">품목 수정</h1>
      {err && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</p>
      )}
      <form action={boundUpdate} className="space-y-4 rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
        <Field label="이름 *" name="name" required defaultValue={item.name} />
        <Field label="SKU" name="sku" defaultValue={item.sku ?? ''} />
        <Field label="바코드 값" name="barcode_code" defaultValue={item.barcode_code ?? ''} />
        <Field label="시리얼" name="serial_number" defaultValue={item.serial_number ?? ''} />
        <div>
          <label className="block text-sm text-slate-600 mb-1">수량</label>
          <input
            name="quantity"
            type="number"
            min={0}
            defaultValue={item.quantity}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
          />
        </div>
        <Field label="위치" name="location" defaultValue={item.location ?? ''} />
        <div>
          <label className="block text-sm text-slate-600 mb-1">메모</label>
          <textarea
            name="description"
            rows={3}
            defaultValue={item.description ?? ''}
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
  defaultValue,
}: {
  label: string
  name: string
  required?: boolean
  defaultValue?: string
}) {
  return (
    <div>
      <label className="block text-sm text-slate-600 mb-1">{label}</label>
      <input
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
      />
    </div>
  )
}
