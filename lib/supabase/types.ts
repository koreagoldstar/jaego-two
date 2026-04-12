export type Item = {
  id: string
  user_id: string
  name: string
  description: string | null
  sku: string | null
  barcode_code: string | null
  serial_number: string | null
  quantity: number
  location: string | null
  created_at: string
  updated_at: string
}

export type StockTransaction = {
  id: string
  user_id: string
  item_id: string
  direction: 'in' | 'out'
  amount: number
  note: string | null
  created_at: string
}
