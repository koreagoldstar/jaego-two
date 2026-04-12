import { MobileNav } from '@/components/MobileNav'
import { DesktopNav } from '@/components/DesktopNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f6f8] flex">
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
