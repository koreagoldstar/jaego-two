'use client'

import { useState } from 'react'
import { createItemAction, createItemsBatchAction } from '@/app/(dashboard)/items/new/actions'
import { generateBarcodeValue } from '@/lib/items/codeGenerators'
import { Sparkles } from 'lucide-react'

type Props = {
  initialError?: string
  /** URL `?mode=bulk` 등으로 일괄 등록 탭을 처음부터 열 때 */
  defaultMode?: 'single' | 'bulk'
}

export function NewItemForm({ initialError, defaultMode = 'single' }: Props) {
  const [mode, setMode] = useState<'single' | 'bulk'>(defaultMode)
  const [barcode, setBarcode] = useState(generateBarcodeValue())

  return (
    <div className="space-y-4">
      {initialError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{initialError}</p>
      )}

      <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
        <button
          type="button"
          onClick={() => setMode('single')}
          className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
            mode === 'single' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          한 개 등록
        </button>
        <button
          type="button"
          onClick={() => setMode('bulk')}
          className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
            mode === 'bulk' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          여러 개 동시
        </button>
      </div>

      {mode === 'single' ? (
        <form action={createItemAction} className="space-y-4 rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <Field label="이름 *" name="name" required placeholder="예: 무선 마이크" />

          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="block text-sm text-slate-600">QR 스캔 코드</label>
              <div className="flex flex-wrap gap-1.5 justify-end">
                <button
                  type="button"
                  onClick={() => setBarcode(generateBarcodeValue())}
                  className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800 hover:bg-violet-100"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  자동
                </button>
              </div>
            </div>
            <input
              name="barcode_code"
              value={barcode}
              onChange={e => setBarcode(e.target.value)}
              placeholder="QR에 넣을 짧은 코드"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">앱은 이 코드만 QR로 생성하고 스캔 매칭합니다.</p>
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1">초기 수량(재고 개수)</label>
            <input
              name="quantity"
              type="number"
              min={0}
              defaultValue={1}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
            />
          </div>
          <Field label="위치" name="location" placeholder="선반 A-1" />
          <div>
            <label className="block text-sm text-slate-600 mb-1">메모</label>
            <textarea
              name="description"
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>
          <button type="submit" className="w-full rounded-xl bg-blue-600 text-white font-medium py-3 shadow-sm">
            저장
          </button>
        </form>
      ) : (
        <form action={createItemsBatchAction} className="space-y-4 rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <p className="text-sm text-slate-600 leading-relaxed">
            같은 종류 품목을 여러 개 한 번에 만듭니다. 이름은 접두어와 번호(또는 괄호)로 구분됩니다.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">품목 이름 접두어 *</label>
            <input
              name="bulk_prefix"
              required
              placeholder="예: 무선 마이크"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">개수 (최대 {100})</label>
              <input
                name="bulk_count"
                type="number"
                min={1}
                max={100}
                defaultValue={3}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">이름 형식</label>
              <select
                name="bulk_name_style"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white"
                defaultValue="dash"
              >
                <option value="dash">접두어-001, 접두어-002 …</option>
                <option value="paren">접두어 (1), 접두어 (2) …</option>
              </select>
            </div>
          </div>

          <p className="text-xs text-slate-500 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
            일괄 등록은 각 품목에 QR 스캔 코드가 자동 생성됩니다.
          </p>

          <div>
            <label className="block text-sm text-slate-600 mb-1">품목당 재고 수량(라벨 개수 기준)</label>
            <input
              name="bulk_quantity"
              type="number"
              min={0}
              defaultValue={1}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">입력한 수량만큼 품목 상세/바코드에서 개별 라벨이 생성됩니다.</p>
          </div>
          <Field label="위치 (공통)" name="bulk_location" placeholder="선반 A-1" />
          <div>
            <label className="block text-sm text-slate-600 mb-1">메모 (공통)</label>
            <textarea
              name="bulk_description"
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>

          <button type="submit" className="w-full rounded-xl bg-violet-600 text-white font-medium py-3 shadow-sm hover:bg-violet-700">
            {`선택한 옵션으로 일괄 등록`}
          </button>
        </form>
      )}
    </div>
  )
}

function Field({
  label,
  name,
  required,
  placeholder,
}: {
  label: string
  name: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm text-slate-600 mb-1">{label}</label>
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
      />
    </div>
  )
}
