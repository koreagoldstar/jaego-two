import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SAAS_MODE } from '@/lib/saas/mode'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  if (!SAAS_MODE) redirect('/dashboard')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader loggedIn={Boolean(user)} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
