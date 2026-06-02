import type { SearchResult } from '@/lib/finance-api'

interface Props {
  companies: SearchResult[]
  onRemove: (cik: string) => void
  max: number
}

export function FinancePicker({ companies, onRemove, max }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {companies.map((c) => (
        <span
          key={c.cik}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1.5 text-sm font-medium text-brand-700 transition-all duration-200 hover:bg-brand-100"
        >
          {c.ticker}
          <button
            onClick={() => onRemove(c.cik)}
            className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-brand-500 hover:bg-brand-200 hover:text-brand-700 transition-colors duration-200"
          >
            ×
          </button>
        </span>
      ))}
      {companies.length < max && (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-3.5 py-1.5 text-sm text-gray-400">
          最多选 {max} 家
        </span>
      )}
    </div>
  )
}
