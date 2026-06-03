'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { parseQuery, matchesFilters, computeMetrics, type FilterClause } from '@/lib/query-parser'
import { fetchFinancials } from '@/lib/finance-api'

interface TickerEntry { cik_str: number; ticker: string; title: string }

export function CompanyScreener() {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<FilterClause[]>([])
  const [results, setResults] = useState<Array<{ cik: string; ticker: string; name: string; matched: boolean; reason?: string }>>([])
  const [screening, setScreening] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const router = useRouter()
  const abortRef = useRef(false)

  const handleParse = useCallback(() => {
    const parsed = parseQuery(query)
    setFilters(parsed.filters)
    if (!parsed.filters.length) {
      setResults([])
      return
    }
    setResults([])

    // Start screening
    setScreening(true)
    abortRef.current = false

    fetch('/company_tickers.json')
      .then(r => r.json())
      .then(async (data: Record<string, TickerEntry>) => {
        const tickers = Object.values(data)
        setProgress({ done: 0, total: tickers.length })

        const batchSize = 8
        const found: typeof results = []
        let scanned = 0

        for (let i = 0; i < tickers.length && !abortRef.current; i += batchSize) {
          const batch = tickers.slice(i, i + batchSize)
          const batchResults = await Promise.all(
            batch.map(async t => {
              try {
                const cik = String(t.cik_str).padStart(10, '0')
                const d = await fetchFinancials(cik, 'annual')
                if (d.error || !d.periods.length) return null
                const m = computeMetrics(d, t.ticker, t.title, cik)
                if (matchesFilters(m, parsed.filters)) {
                  return { cik, ticker: t.ticker, name: t.title, matched: true }
                }
              } catch { /* skip */ }
              return null
            })
          )

          for (const r of batchResults) {
            if (r && found.length < 50) found.push(r)
          }

          scanned += batch.length
          setProgress({ done: scanned, total: tickers.length })
          setResults([...found])

          if (found.length >= 50) break
        }

        setScreening(false)
      })
      .catch(() => setScreening(false))
  }, [query])

  const stop = () => { abortRef.current = true; setScreening(false) }

  const openCompany = (cik: string) => {
    router.push(`/technology/analysis/?ciks=${cik}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleParse()}
          placeholder='输入筛选条件，如"收入增速>30% 毛利率>60% 负债率<30%"'
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-all duration-200 placeholder:text-gray-400 focus:border-brand"
          disabled={screening}
        />
        <button
          onClick={screening ? stop : handleParse}
          className={`shrink-0 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200 ${screening ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-brand text-white hover:bg-brand-600'}`}
        >
          {screening ? '停止' : '筛选'}
        </button>
      </div>

      {/* Parsed filters display */}
      {filters.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f, i) => (
            <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-medium">
              {f.raw}
            </span>
          ))}
        </div>
      )}

      {/* Progress */}
      {screening && (
        <div className="text-xs text-gray-400">
          已扫描 {progress.done}/{progress.total} 家公司 · 找到 {results.length} 家
          <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand transition-all duration-300" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-50 text-xs text-gray-400">
            匹配 {results.length} 家公司
          </div>
          {results.map(r => (
            <button
              key={r.cik}
              onClick={() => openCompany(r.cik)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
            >
              <div>
                <span className="text-sm font-semibold text-gray-800">{r.ticker}</span>
                <span className="text-xs text-gray-400 ml-2">{r.name}</span>
              </div>
              <span className="text-xs text-brand">分析 →</span>
            </button>
          ))}
        </div>
      )}

      {!screening && results.length === 0 && filters.length > 0 && (
        <div className="text-center text-sm text-gray-400 py-8">
          暂无匹配公司 · 试试放宽条件
        </div>
      )}
    </div>
  )
}
