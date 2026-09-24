import Link from 'next/link'
import { APP_NAME } from '@/lib/saas/mode'
import { Package, ArrowLeftRight, ScanLine, Settings, Home, Barcode, History, FolderKanban, Table } from 'lucide-react'

const items = [
  { href: '/dashboard', label: '대시보드', icon: Home },
  { href: '/items', label: '품목', icon: Package },
  { href: '/move', label: '입출고', icon: ArrowLeftRight },
  { href: '/scan', label: '스캔', icon: ScanLine },
  { href: '/projects', label: '프로젝트', icon: FolderKanban },
  { href: '/stock-overview', label: '재고요약표', icon: Table },
  { href: '/barcode', label: '바코드', icon: Barcode },
  { href: '/transactions', label: '이력', icon: History },
  { href: '/settings', label: '설정', icon: Settings },
]

export function DesktopNav({ companyName }: { companyName?: string | null }) {
  return (
    <aside className="hidden md:flex md:flex-col md:w-52 md:shrink-0 border-r border-slate-200 bg-white min-h-screen p-4 gap-1">
      <div className="mb-6 px-2">
        <div className="font-bold text-slate-900 flex items-center gap-2">
          <span className="text-xl">📦</span> {APP_NAME}
        </div>
        {companyName && companyName !== APP_NAME && <p className="text-xs text-slate-500 mt-1 truncate">{companyName}</p>}
      </div>
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
        >
          <Icon className="w-4 h-4" />
          {label}
        </Link>
      ))}
    </aside>
  )
}
