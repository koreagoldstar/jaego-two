'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function SignOutButton() {
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      className="w-full rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-medium text-red-600 shadow-sm"
    >
      로그아웃
    </button>
  )
}
