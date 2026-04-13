'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Package, ArrowLeftRight, ScanLine, FolderKanban, Menu } from 'lucide-react'

const links = [
  { href: '/', label: '홈', icon: Home },
  { href: '/items', label: '품목', icon: Package },
  { href: '/move', label: '입출고', icon: ArrowLeftRight },
  { href: '/scan', label: '스캔', icon: ScanLine },
  { href: '/projects', label: '프로젝트', icon: FolderKanban },
  { href: '/settings', label: '설정', icon: Menu },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden safe-area-pb"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="flex max-w-lg mx-auto justify-around items-stretch h-14">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex flex-col items-center justify-center h-full text-[11px] gap-0.5 ${
                  active ? 'text-blue-600 font-medium' : 'text-slate-500'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={active ? 2.25 : 2} />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
