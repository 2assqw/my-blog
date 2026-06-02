'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FinanceSearch } from '@/components/FinanceSearch'
import { FinancePicker } from '@/components/FinancePicker'
import type { SearchResult } from '@/lib/finance-api'

export default function TechnologyPage() {
  const [selected, setSelected] = useState<SearchResult[]>([])
  const router = useRouter()

  const addCompany = (c: SearchResult) => {
    if (selected.length >= 2 || selected.find((s) => s.cik === c.cik)) return
    setSelected([...selected, c])
  }

  const removeCompany = (cik: string) => {
    setSelected(selected.filter((c) => c.cik !== cik))
  }

  const startAnalysis = () => {
    if (selected.length === 0) return
    const ciks = selected.map((c) => c.cik).join(',')
    router.push(`/technology/analysis/?ciks=${ciks}`)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-20">
      <div className="w-full max-w-lg">
        <h1 className="text-center text-2xl sm:text-4xl font-bold text-gray-900 mb-2">
          Earnings Eye
        </h1>
        <p className="text-center text-sm sm:text-base text-gray-500 mb-8 sm:mb-10">
          基于 SEC EDGAR 数据的上市公司财报可视化分析
        </p>

        <FinanceSearch selected={selected} onSelect={addCompany} max={2} />

        {selected.length > 0 && (
          <div className="mt-6">
            <FinancePicker companies={selected} onRemove={removeCompany} max={2} />
          </div>
        )}

        <button
          onClick={startAnalysis}
          disabled={selected.length === 0}
          className="mt-8 w-full rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-gray-800 hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          开始分析 →
        </button>
      </div>
    </main>
  )
}
