import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MobileNav } from '@/components/MobileNav'
import { DesktopNav } from '@/components/DesktopNav'
import { getWorkspace } from '@/lib/saas/workspace'
import { SAAS_MODE } from '@/lib/saas/mode'
import { getDataUser } from '@/lib/supabase/dataUser'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await getDataUser(supabase)
  if (!user) {
    redirect('/login')
  }
  const workspace = SAAS_MODE ? await getWorkspace(supabase, user.id) : null

  return (
    <div className="relative isolate min-h-screen flex bg-[#eef2f7]">
      {/* 배경은 고정 레이어로 — background-attachment: fixed 는 휴대폰에서 스크롤할 때마다 다시 그려 버벅임 */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "linear-gradient(rgba(238,242,247,0.32), rgba(238,242,247,0.32)), url('/inventory-bg.png')",
        }}
      />
      <DesktopNav companyName={workspace?.companyName} />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4 pb-24 md:pb-8 md:max-w-4xl">
          {children}
        </main>
        <MobileNav />
      </div>
    </div>
  )
}
