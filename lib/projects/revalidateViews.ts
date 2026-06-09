import { revalidatePath } from 'next/cache'

/** 입출고·프로젝트·재고 집계 화면 갱신 */
export function revalidateInventoryViews() {
  revalidatePath('/transactions')
  revalidatePath('/projects')
  revalidatePath('/stock-overview')
  revalidatePath('/items')
  revalidatePath('/barcode')
  revalidatePath('/move')
  revalidatePath('/move-app')
  revalidatePath('/move-bulk')
}
