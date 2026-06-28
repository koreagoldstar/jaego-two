export type InstallPlatform = 'ios' | 'android' | 'desktop' | 'standalone'

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
