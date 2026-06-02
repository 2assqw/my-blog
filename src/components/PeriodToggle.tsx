interface Props {
  value: 'annual' | 'quarter'
  onChange: (p: 'annual' | 'quarter') => void
}

export function PeriodToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
      {(['annual', 'quarter'] as const).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
            value === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {p === 'annual' ? '年度' : '季度'}
        </button>
      ))}
    </div>
  )
}
