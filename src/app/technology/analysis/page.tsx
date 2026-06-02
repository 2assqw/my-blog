'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { fetchFinancials, type FinancialData } from '@/lib/finance-api'
import { ScatterCompare } from '@/components/ScatterCompare'
import { CompanyScore } from '@/components/CompanyScore'
import { MetricChart } from '@/components/MetricChart'
import { PeriodToggle } from '@/components/PeriodToggle'

function AnalysisContent() {
  const params = useSearchParams()
  const router = useRouter()
  const ciksParam = params.get('ciks') || ''
  const ciks = ciksParam.split(',').filter(Boolean)

  const [period, setPeriod] = useState<'annual' | 'quarter'>('annual')
  const [data, setData] = useState<FinancialData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (ciks.length === 0) { router.push('/technology/'); return }
    setLoading(true)
    setError('')
    Promise.all(ciks.map((cik) => fetchFinancials(cik, period)))
      .then((results) => {
        if (results.some((r) => r.error)) {
          setError(results.find((r) => r.error)?.error || '获取数据失败')
        } else {
          setData(results)
        }
      })
      .catch(() => setError('网络请求失败，请检查 Worker 是否已部署'))
      .finally(() => setLoading(false))
  }, [ciksParam, period, router])

  const tickers = data.map((d) => d.ticker || d.company)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
          <p>正在从 SEC 获取最新财报数据...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="text-brand hover:underline text-sm">重试</button>
        </div>
      </div>
    )
  }

  const title = tickers.length === 2 ? `${tickers[0]} vs ${tickers[1]}` : tickers[0] || ''

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white/80 backdrop-blur px-6 py-3 border-b border-gray-100">
        <Link href="/technology/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors duration-200">
          ← 返回搜索
        </Link>
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        <PeriodToggle value={period} onChange={setPeriod} />
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        {tickers.length === 2 && <CompanyScore data={data} companies={tickers} />}
        <ScatterCompare data={data} companies={tickers} />

        <MetricChart title="收入 (Revenue)" data={data} metricKey="revenue" companies={tickers} />
        <MetricChart title="净利润 (Net Income)" data={data} metricKey="netIncome" companies={tickers} />
        <MetricChart title="总资产 (Total Assets)" data={data} metricKey="totalAssets" companies={tickers} />
        <MetricChart title="总负债 (Total Liabilities)" data={data} metricKey="totalLiabilities" companies={tickers} />
        <MetricChart title="经营现金流 (Operating Cash Flow)" data={data} metricKey="operatingCashFlow" companies={tickers} />
        <MetricChart title="毛利润 (Gross Profit)" data={data} metricKey="grossProfit" companies={tickers} />
      </div>
    </div>
  )
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-gray-400">加载中...</div>}>
      <AnalysisContent />
    </Suspense>
  )
}
