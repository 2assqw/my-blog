'use client'

import { useState, useEffect, useRef } from 'react'
import type { SearchResult } from '@/lib/finance-api'

interface Props {
  selected: SearchResult[]
  onSelect: (company: SearchResult) => void
  max: number
}

const PAGE_SIZE = 8

interface CompanyEntry {
  cik_str: number
  ticker: string
  title: string
}

export function FinanceSearch({ selected, onSelect, max }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [allResults, setAllResults] = useState<SearchResult[]>([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const dataRef = useRef<CompanyEntry[] | null>(null)

  useEffect(() => {
    fetch('/company_tickers.json')
      .then((r) => r.json())
      .then((data: Record<string, CompanyEntry>) => {
        dataRef.current = Object.values(data)
      })
  }, [])

  useEffect(() => {
    if (!dataRef.current || query.trim().length < 2) {
      setAllResults([])
      setResults([])
      setPage(0)
      return
    }

    setLoading(true)
    const q = query.trim().toUpperCase()
    const tickerMatch: SearchResult[] = []
    const nameMatch: SearchResult[] = []

    for (const entry of dataRef.current) {
      const cik = String(entry.cik_str).padStart(10, '0')
      const ticker = entry.ticker.toUpperCase()
      const name = entry.title

      if (ticker.includes(q)) {
        tickerMatch.push({ cik, ticker, name })
      } else if (name.toUpperCase().includes(q)) {
        nameMatch.push({ cik, ticker, name })
      }
      if (tickerMatch.length + nameMatch.length >= 200) break
    }

    const merged = [...tickerMatch, ...nameMatch]
    const filtered = merged.filter((c) => !selected.find((s) => s.cik === c.cik))

    setAllResults(filtered)
    setResults(filtered.slice(0, PAGE_SIZE))
    setPage(0)
    setLoading(false)
  }, [query, selected])

  const hasMore = allResults.length > PAGE_SIZE

  const loadMore = () => {
    const nextPage = page + 1
    const end = (nextPage + 1) * PAGE_SIZE
    setResults(allResults.slice(0, end))
    setPage(nextPage)
  }

  const disabled = selected.length >= max

  return (
    <div className="w-full max-w-lg">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入公司名称或股票代码..."
          disabled={disabled}
          className="w-full rounded-xl border border-gray-200 bg-white px-5 py-3.5 text-base shadow-sm outline-none transition-all duration-200 placeholder:text-gray-400 focus:border-brand focus:shadow-md disabled:opacity-50"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
        )}
      </div>

      {results.length > 0 && (
        <div className="mt-2 rounded-xl border border-gray-100 bg-white shadow-lg overflow-hidden">
          {results.map((r) => (
            <button
              key={r.cik}
              onClick={() => { onSelect(r); setQuery(''); setAllResults([]); setResults([]) }}
              className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-brand-50 transition-colors duration-200 border-b border-gray-50 last:border-0"
            >
              <span className="font-semibold text-gray-800 text-sm w-16 shrink-0">{r.ticker}</span>
              <span className="text-sm text-gray-500 truncate ml-4 text-right">{r.name}</span>
            </button>
          ))}
          {hasMore && page * PAGE_SIZE + results.length < allResults.length && (
            <button
              onClick={loadMore}
              className="w-full py-2.5 text-center text-xs text-brand hover:text-brand-600 hover:bg-brand-50 transition-colors duration-200 font-medium"
            >
              加载更多 ({(page + 1) * PAGE_SIZE}/{allResults.length})
            </button>
          )}
        </div>
      )}

      {query.trim().length >= 2 && !loading && results.length === 0 && (
        <div className="mt-2 rounded-xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">
          未找到匹配的公司
        </div>
      )}
    </div>
  )
}
