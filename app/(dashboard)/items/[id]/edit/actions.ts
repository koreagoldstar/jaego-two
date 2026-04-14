'use server'

import { createClient } from '@/lib/supabase/server'
import { generateBarcodeValue } from '@/lib/items/codeGeneratorsServer'
import { redirect } from 'next/navigation'

export async function updateItemAction(itemId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const name = String(formData.get('name') ?? '').trim()
  if (!name) redirect(`/items/${itemId}/edit?error=` + encodeURIComponent('이름을 입력하세요'))

  const barcode_code = String(formData.get('barcode_code') ?? '').trim()
  const quantity = Math.max(0, parseInt(String(formData.get('quantity') ?? '0'), 10) || 0)
  const location = String(formData.get('location') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()

  const { error } = await supabase
    .from('items')
    .update({
      name,
      sh: null,
      barcode_code: barcode_code || generateBarcodeValue(),
      serial_number: null,
      quantity,
      location: location || null,
      description: description || '',
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('user_id', user.id)

  if (error) {
    redirect(`/items/${itemId}/edit?error=` + encodeURIComponent(error.message))
  }
  redirect(`/items/${itemId}`)
}
