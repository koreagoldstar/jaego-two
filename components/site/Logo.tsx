/**
 * 오늘의 재고 로고 — 먹색 라벨 위 바코드 막대 + 주황 점(오늘)
 * 색은 tailwind `brand` 팔레트(주황)와 맞춥니다.
 */
export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x="1" y="4" width="30" height="24" rx="6" fill="#1c1917" />
      <rect x="6" y="10" width="2.5" height="12" rx="1" fill="#fafaf9" />
      <rect x="10.5" y="10" width="1.5" height="12" rx="0.75" fill="#fafaf9" />
      <rect x="14" y="10" width="3.5" height="12" rx="1" fill="#fafaf9" />
      <rect x="19.5" y="10" width="1.5" height="12" rx="0.75" fill="#fafaf9" />
      <circle cx="25" cy="12.5" r="2.75" fill="#f76707" />
      <rect x="23.5" y="17" width="2.5" height="5" rx="1" fill="#fafaf9" />
    </svg>
  )
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight text-stone-900 ${className}`}>
      <LogoMark />
      <span>
        오늘의 <span className="text-brand-600">재고</span>
      </span>
    </span>
  )
}
