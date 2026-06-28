'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  getDeferredInstallPrompt,
  subscribeInstallPrompt,
  triggerInstallPrompt,
} from '@/lib/pwa/installPrompt'
import { getInstallPlatform, isStandaloneMode, type InstallPlatform } from '@/lib/pwa/platform'

export function usePwaInstall() {
  const [platform, setPlatform] = useState<InstallPlatform>('desktop')
  const [installed, setInstalled] = useState(false)
  const [canNativeInstall, setCanNativeInstall] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    setPlatform(getInstallPlatform())
    setInstalled(isStandaloneMode())
    setCanNativeInstall(!!getDeferredInstallPrompt())

    return subscribeInstallPrompt(() => {
      setCanNativeInstall(!!getDeferredInstallPrompt())
      setInstalled(isStandaloneMode())
    })
  }, [])

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'manual'> => {
    setInstalling(true)
    try {
      const outcome = await triggerInstallPrompt()
      if (outcome === 'accepted') {
        setInstalled(true)
        setCanNativeInstall(false)
        return 'accepted'
      }
      if (outcome === 'dismissed') return 'dismissed'
      return 'manual'
    } finally {
      setInstalling(false)
    }
  }, [])

  return { platform, installed, canNativeInstall, installing, install }
}
