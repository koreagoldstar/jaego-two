'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { SITE, SITE_NAV } from '@/lib/saas/site'

export function SiteHeader({ loggedIn }: { loggedIn: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-slate-900" onClick={() => setOpen(false)}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-base">📦</span>
          {SITE.name}
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {SITE_NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3 py-2 text-sm ${
                pathname === href ? 'font-semibold text-blue-600' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {loggedIn ? (
            <Link href="/dashboard" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              내 재고로 이동
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:text-slate-900">
                로그인
              </Link>
              <Link href="/signup" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                무료로 시작하기
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="-mr-2 rounded-lg p-2 text-slate-700 md:hidden"
          aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white px-4 pb-4 md:hidden">
          <nav className="flex flex-col py-2">
            {SITE_NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`py-3 text-base ${pathname === href ? 'font-semibold text-blue-600' : 'text-slate-700'}`}
              >
                {label}
              </Link>
            ))}
          </nav>
          {loggedIn ? (
            <Link href="/dashboard" className="block rounded-xl bg-blue-600 py-3 text-center font-medium text-white">
              내 재고로 이동
            </Link>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link href="/login" className="rounded-xl border border-slate-200 py-3 text-center font-medium text-slate-700">
                로그인
              </Link>
              <Link href="/signup" className="rounded-xl bg-blue-600 py-3 text-center font-medium text-white">
                무료로 시작하기
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
