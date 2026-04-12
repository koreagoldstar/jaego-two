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
    <div className="min-h-[100dvh] bg-[#0f1419] flex flex-col text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-[#0f1419]/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-3 safe-area-pt">
        <div className="min-w-0">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">현장 입·출고</p>
          <h1 className="text-xl font-bold text-white truncate tracking-tight">신화유디텍 장비</h1>
        </div>
        <SignOutButton className="text-xs font-medium text-slate-400 border border-slate-700 bg-slate-800/80 px-3 py-2 rounded-xl hover:bg-slate-800" />
      </header>
      <main className="flex-1 w-full max-w-lg mx-auto px-4 pt-4 pb-6">{children}</main>
      <footer className="border-t border-slate-800 py-3 px-4 text-center safe-area-pb">
        <Link
          href="/"
          className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2"
        >
          재고 관리(전체 메뉴)로 이동
        </Link>
      </footer>
    </div>
  )
}
