import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from '@/components/SignOutButton'

export const dynamic = 'force-dynamic'

export default async function MoveAppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8] flex flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3 flex items-center justify-between gap-3 safe-area-pt">
        <div className="min-w-0">
          <p className="text-[11px] text-slate-500 uppercase tracking-wide">입·출고 전용</p>
          <h1 className="text-lg font-bold text-slate-900 truncate">신화유디텍 장비</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 px-2 py-1.5 rounded-lg hover:bg-blue-50"
          >
            전체 메뉴
          </Link>
          <SignOutButton className="text-sm font-medium text-red-600 border border-red-100 bg-red-50/80 px-3 py-1.5 rounded-lg hover:bg-red-100" />
        </div>
      </header>
      <main className="flex-1 w-full max-w-lg mx-auto p-4 pb-10">{children}</main>
    </div>
  )
}
