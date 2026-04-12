import Link from 'next/link'
import { NewItemForm } from '@/components/items/NewItemForm'

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
      <NewItemForm initialError={err} />
    </div>
  )
}
