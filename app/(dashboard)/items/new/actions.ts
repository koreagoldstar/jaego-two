'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createItemAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const name = String(formData.get('name') ?? '').trim()
  if (!name) redirect('/items/new?error=' + encodeURIComponent('이름을 입력하세요'))

  const sku = String(formData.get('sku') ?? '').trim()
  const barcode_code = String(formData.get('barcode_code') ?? '').trim()
  const serial_number = String(formData.get('serial_number') ?? '').trim()
  const quantity = Math.max(0, parseInt(String(formData.get('quantity') ?? '0'), 10) || 0)
  const location = String(formData.get('location') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()

  const { error } = await supabase.from('items').insert({
    user_id: user.id,
    name,
    sku: sku || null,
    barcode_code: barcode_code || null,
    serial_number: serial_number || null,
    quantity,
    location: location || null,
    description: description || null,
  })

  if (error) {
    redirect('/items/new?error=' + encodeURIComponent(error.message))
  }
  redirect('/items')
}
