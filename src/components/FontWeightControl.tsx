'use client'

import { useState, useEffect } from 'react'

const WEIGHTS = [
  { value: 300, label: '细' },
  { value: 400, label: '标准' },
  { value: 500, label: '中等' },
  { value: 700, label: '粗' },
] as const

export function FontWeightControl() {
  const [weight, setWeight] = useState(400)

  useEffect(() => {
    const saved = localStorage.getItem('essay-font-weight')
    if (saved) setWeight(Number(saved))
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--essay-font-weight', String(weight))
    localStorage.setItem('essay-font-weight', String(weight))
  }, [weight])

  return (
    <div className="flex items-center gap-1 bg-white/80 backdrop-blur rounded-full border border-gray-100 px-1 py-1 shadow-sm">
      {WEIGHTS.map((w) => (
        <button
          key={w.value}
          onClick={() => setWeight(w.value)}
          className={`w-9 h-7 rounded-full text-xs font-medium transition-all ${
            weight === w.value
              ? 'bg-gray-900 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {w.label}
        </button>
      ))}
    </div>
  )
}
