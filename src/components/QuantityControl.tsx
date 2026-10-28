import { Minus, Plus } from 'lucide-react'

interface Props {
  value: number
  onChange: (quantity: number) => void
  label?: string
  max?: number
}

export function QuantityControl({ value, onChange, label = 'Quantidade', max = 99 }: Props) {
  return (
    <div className="quantity-control" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`Diminuir ${label.toLowerCase()}`}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={18} />
      </button>
      <output aria-label={label} aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        aria-label={`Aumentar ${label.toLowerCase()}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={18} />
      </button>
    </div>
  )
}
