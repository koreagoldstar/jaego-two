'use server'

import { createClient } from '@/lib/supabase/server'
import { generateBarcodeValue } from '@/lib/items/codeGeneratorsServer'
import { isMissingItemStockLotsTable } from '@/lib/supabase/missingTable'
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
  const resolvedBarcode = barcode_code || generateBarcodeValue()
  const quantity = Math.max(0, parseInt(String(formData.get('quantity') ?? '0'), 10) || 0)
  const location = String(formData.get('location') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()

  const { data: meta, error: metaErr } = await supabase
    .from('items')
    .select('created_at, quantity')
    .eq('id', itemId)
    .eq('user_id', user.id)
    .single()

  if (metaErr || !meta) {
    redirect(`/items/${itemId}/edit?error=` + encodeURIComponent(metaErr?.message ?? '품목을 찾을 수 없습니다'))
  }

  const lotRes = await supabase
    .from('item_stock_lots')
    .select('quantity')
    .eq('item_id', itemId)
    .eq('user_id', user.id)

  if (lotRes.error && isMissingItemStockLotsTable(lotRes.error)) {
    const { error } = await supabase
      .from('items')
      .update({
        name,
        sh: null,
        barcode_code: resolvedBarcode,
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

  if (lotRes.error) {
    redirect(`/items/${itemId}/edit?error=` + encodeURIComponent(lotRes.error.message))
  }

  const lotRows = lotRes.data ?? []
  const lotSum = lotRows.reduce((s, r) => s + (r.quantity ?? 0), 0)
  const effectiveSum = lotRows.length > 0 ? lotSum : meta.quantity ?? 0

  const { error } = await supabase
    .from('items')
    .update({
      name,
      sh: null,
      barcode_code: resolvedBarcode,
      serial_number: null,
      location: location || null,
      description: description || '',
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('user_id', user.id)

  if (error) {
    redirect(`/items/${itemId}/edit?error=` + encodeURIComponent(error.message))
  }

  if (quantity !== effectiveSum) {
    await supabase.from('item_stock_lots').delete().eq('item_id', itemId).eq('user_id', user.id)

    if (quantity > 0) {
      const { error: lotErr } = await supabase.from('item_stock_lots').insert({
        user_id: user.id,
        item_id: itemId,
        quantity,
        lot_code: resolvedBarcode,
        note: '',
        created_at: meta.created_at,
      })
      if (lotErr) {
        redirect(`/items/${itemId}/edit?error=` + encodeURIComponent(lotErr.message))
      }
    }
  }

  redirect(`/items/${itemId}`)
}
