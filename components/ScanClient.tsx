'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { findItemIdByBarcode } from '@/lib/items/barcodeLookup'
import { BarcodeCamera } from '@/components/BarcodeCamera'

export function ScanClient() {
  const router = useRouter()
  const [hint, setHint] = useState<string | null>(null)

  const onDecode = useCallback(
    async (code: string) => {
      setHint(null)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const id = await findItemIdByBarcode(supabase, user.id, code)
      if (id) {
        router.push(`/move-app?item=${id}`)
        return
      }
      setHint(`등록되지 않은 코드: ${code}`)
    },
    [router]
  )

  return (
    <div className="space-y-2">
      <BarcodeCamera
        onDecode={onDecode}
        initialStatus="카메라 시작 중…"
        videoClassName="w-full max-h-[50vh] object-contain bg-black"
      />
      {hint && <p className="text-sm text-red-600 px-1">{hint}</p>}
    </div>
  )
}
