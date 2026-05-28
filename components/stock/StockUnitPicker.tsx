'use client'

import { formatStockUnitLabel, type StockUnitOption } from '@/lib/items/stockUnits'

type Props = {
  units: StockUnitOption[]
  selectedLotId: string
  onSelect: (lotId: string) => void
  disabled?: boolean
  name?: string
}

export function StockUnitPicker({ units, selectedLotId, onSelect, disabled, name = 'stock-unit' }: Props) {
  if (units.length === 0) {
    return (
      <p className="text-xs text-slate-500 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
        선택 가능한 입고 단위가 없습니다. 입고 후 다시 시도하세요.
      </p>
    )
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
      {units.map(unit => (
        <label
          key={unit.lotId}
          className={`flex items-start gap-2 px-3 py-2.5 cursor-pointer ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'
          } ${selectedLotId === unit.lotId ? 'bg-orange-50' : ''}`}
        >
          <input
            type="radio"
            name={name}
            value={unit.lotId}
            checked={selectedLotId === unit.lotId}
            disabled={disabled}
            onChange={() => onSelect(unit.lotId)}
            className="mt-0.5 shrink-0"
          />
          <span className="text-sm text-slate-800 leading-snug break-all">{formatStockUnitLabel(unit)}</span>
        </label>
      ))}
    </div>
  )
}
