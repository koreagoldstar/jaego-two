/** 소개 사이트(오늘의 재고) 공통 정보 — 사업자 정보는 채워지면 하단에 자동 표시됩니다. */
export const SITE = {
  name: '오늘의 재고',
  tagline: '바코드 한 번으로 끝나는 재고관리',
  description: '품목 등록부터 입출고, 바코드·QR 라벨, 프로젝트별 자재 관리까지. 휴대폰 하나로 쓰는 현장형 재고관리 서비스.',
  /** 사업자 정보 (전자상거래법상 표시 의무 · 토스페이먼츠 심사 시 필요) */
  business: {
    companyName: '오늘',
    ceo: '',
    registrationNumber: '',
    mailOrderNumber: '',
    address: '',
    phone: '',
    email: '',
  },
} as const

export const SITE_NAV = [
  { href: '/features', label: '기능 소개' },
  { href: '/pricing', label: '요금 안내' },
  { href: '/custom', label: '맞춤 제작' },
  { href: '/contact', label: '문의하기' },
] as const
