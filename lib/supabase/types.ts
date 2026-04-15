export type Item = {
  id: string
  user_id: string
  name: string
  description: string | null
  sh: string | null
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
  /** 입·출고 연결 프로젝트/현장명 */
  project: string | null
  created_at: string
}

export type InventoryEvent = {
  id: string
  user_id: string
  item_id: string | null
  event_type: 'item_create' | 'item_delete'
  item_name: string
  quantity: number
  detail: string | null
  created_at: string
}

export type ProjectUsagePlan = {
  id: string
  user_id: string
  project_name: string
  install_date: string | null
  item_id: string
  planned_qty: number
  created_at: string
  updated_at: string
}

/** 품목 내 입고 단위(날짜·수량별). 합계가 items.quantity와 일치 */
export type ItemStockLot = {
  id: string
  user_id: string
  item_id: string
  quantity: number
  /** 입고 단위별 스캔/QR 값(비어 있으면 QR 삭제 불가, 목록에서만 삭제) */
  lot_code: string | null
  note: string | null
  created_at: string
}
