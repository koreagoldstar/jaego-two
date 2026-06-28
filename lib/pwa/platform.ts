export type InstallPlatform = 'ios' | 'android' | 'desktop' | 'standalone'

const DISMISS_KEY = 'jaego-install-banner-dismissed'

export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function getInstallPlatform(): InstallPlatform {
  if (typeof window === 'undefined') return 'desktop'
  if (isStandaloneMode()) return 'standalone'
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

/** 휴대폰·좁은 화면·터치 기기에서 설치 배너 표시 */
export function shouldShowInstallBanner(): boolean {
  if (typeof window === 'undefined') return false
  if (isStandaloneMode()) return false
  try {
    if (localStorage.getItem(DISMISS_KEY) === '1') return false
  } catch {
    /* private mode */
  }

  const platform = getInstallPlatform()
  if (platform === 'ios' || platform === 'android') return true

  const coarse = window.matchMedia('(pointer: coarse)').matches
  const narrow = window.innerWidth < 768
  return coarse || narrow
}

export { DISMISS_KEY }
