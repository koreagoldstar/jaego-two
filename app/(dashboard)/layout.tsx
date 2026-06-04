import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MobileNav } from '@/components/MobileNav'
import { DesktopNav } from '@/components/DesktopNav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  return (
    <div
      className="min-h-screen flex bg-[#eef2f7] bg-cover bg-center bg-no-repeat bg-fixed"
      style={{
        backgroundImage:
          "linear-gradient(rgba(238,242,247,0.55), rgba(238,242,247,0.55)), url('/inventory-bg.png')",
      }}
    >
      <DesktopNav />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4 pb-24 md:pb-8 md:max-w-4xl">
          {children}
        </main>
        <MobileNav />
      </div>
    </div>
  )
}
