import Link from 'next/link'
import { SITE, SITE_NAV } from '@/lib/saas/site'
import { Logo } from '@/components/site/Logo'

export function SiteFooter() {
  const b = SITE.business
  const info = [
    b.companyName && `상호 ${b.companyName}`,
    b.ceo && `대표 ${b.ceo}`,
    b.registrationNumber && `사업자등록번호 ${b.registrationNumber}`,
    b.mailOrderNumber && `통신판매업신고 ${b.mailOrderNumber}`,
    b.address && `주소 ${b.address}`,
    b.phone && `전화 ${b.phone}`,
    b.email && `이메일 ${b.email}`,
  ].filter(Boolean)

  return (
    <footer className="border-t border-stone-200 bg-stone-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <Logo />
            <p className="mt-1 text-sm text-stone-500">{SITE.tagline}</p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-600">
            {SITE_NAV.map(({ href, label }) => (
              <Link key={href} href={href} className="hover:text-stone-900">
                {label}
              </Link>
            ))}
            <Link href="/login" className="hover:text-stone-900">
              로그인
            </Link>
          </nav>
        </div>
        {info.length > 0 && (
          <p className="mt-8 text-xs leading-relaxed text-stone-400">{info.join(' · ')}</p>
        )}
        <p className="mt-2 text-xs text-stone-400">© {new Date().getFullYear()} {SITE.name}. All rights reserved.</p>
      </div>
    </footer>
  )
}
