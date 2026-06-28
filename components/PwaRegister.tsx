'use client'

import { useEffect } from 'react'
import { initInstallPromptCapture } from '@/lib/pwa/installPrompt'

export function PwaRegister() {
  useEffect(() => {
    initInstallPromptCapture()
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
  }, [])

  return null
}
