export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
let initialized = false
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((cb) => cb())
}

/** 앱 최초 로드 시 한 번 호출 — beforeinstallprompt 를 페이지 이동 전에 잡습니다 */
export function initInstallPromptCapture() {
  if (typeof window === 'undefined' || initialized) return
  initialized = true

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    notify()
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function triggerInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable'
  try {
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') deferredPrompt = null
    notify()
    return outcome
  } catch {
    return 'unavailable'
  }
}

if (typeof window !== 'undefined') {
  initInstallPromptCapture()
}
