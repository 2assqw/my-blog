'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { fetchFinancials, type FinancialData } from '@/lib/finance-api'
import { PeriodToggle } from '@/components/PeriodToggle'

// Lazy tabs loaded only when selected
const TABS = ['overview', 'financials', 'market', 'news', 'ratings'] as const
type Tab = (typeof TABS)[number]

const TAB_LABELS: Record<Tab, string> = {
  overview: '概览',
  financials: '财报',
  market: '市场',
  news: '新闻',
  ratings: '评级',
}

function AnalysisContent() {
  const params = useSearchParams()
  const router = useRouter()
  const ciksParam = params.get('ciks') || ''
  const ciks = ciksParam.split(',').filter(Boolean)

  const [tab, setTab] = useState<Tab>('overview')
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
          setError(results.find((r) => r.error)?.error || '获取失败')
        } else {
          setData(results)
        }
      })
      .catch(() => setError('网络请求失败'))
      .finally(() => setLoading(false))
  }, [ciksParam, period, router])

  const tickers = data.map((d) => d.ticker || d.company)
  const title = tickers.length === 2 ? `${tickers[0]} vs ${tickers[1]}` : tickers[0] || ''

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
          <p>正在获取数据...</p>
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

  const primaryStock = tickers[0] || ''

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 bg-white/80 backdrop-blur px-3 sm:px-6 py-2 sm:py-3 border-b border-gray-100">
        <Link href="/technology/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors duration-200 shrink-0">
          ← FinScope
        </Link>
        <span className="text-xs sm:text-sm font-semibold text-gray-800 truncate max-w-[40%]">{title}</span>
        <PeriodToggle value={period} onChange={setPeriod} />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-4xl px-3 sm:px-6 flex gap-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors duration-200 border-b-2 -mb-[1px] whitespace-nowrap ${
                tab === t
                  ? 'border-brand text-brand'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-3 sm:px-6 py-4 sm:py-8">
        {tab === 'overview' && <OverviewTab data={data} companies={tickers} symbol={primaryStock} />}
        {tab === 'financials' && <FinancialsTab data={data} companies={tickers} />}
        {tab === 'market' && <MarketTab symbol={primaryStock} />}
        {tab === 'news' && <NewsTab symbol={primaryStock} />}
        {tab === 'ratings' && <RatingsTab symbol={primaryStock} />}

        {/* Source attribution */}
        <SourceFooter tab={tab} />
      </div>
    </div>
  )
}

function SourceFooter({ tab }: { tab: Tab }) {
  const sources: Record<Tab, string> = {
    overview: 'Financial Modeling Prep · SEC EDGAR',
    financials: 'SEC EDGAR · 数据来自公司 10-K/10-Q 原始申报',
    market: 'Financial Modeling Prep · 行情延迟 15 分钟',
    news: 'Financial Modeling Prep · 新闻来自第三方媒体聚合',
    ratings: 'Financial Modeling Prep · 评级数据来自各券商分析师',
  }
  return (
    <div className="mt-8 pt-4 border-t border-gray-100 text-center text-[10px] sm:text-xs text-gray-400">
      数据来源：{sources[tab]}
    </div>
  )
}

// ---- Sub-components (inline for now, extracted to files when growing) ----

import { CompanyScore } from '@/components/CompanyScore'
import { ScatterCompare } from '@/components/ScatterCompare'
import { MetricChart } from '@/components/MetricChart'

function FinancialsTab({ data, companies }: { data: FinancialData[]; companies: string[] }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {companies.length === 2 && <CompanyScore data={data} companies={companies} />}
      <ScatterCompare data={data} companies={companies} />
      <MetricChart title="收入 (Revenue)" data={data} metricKey="revenue" companies={companies} />
      <MetricChart title="净利润 (Net Income)" data={data} metricKey="netIncome" companies={companies} />
      <MetricChart title="总资产 (Total Assets)" data={data} metricKey="totalAssets" companies={companies} />
      <MetricChart title="总负债 (Total Liabilities)" data={data} metricKey="totalLiabilities" companies={companies} />
      <MetricChart title="经营现金流 (Operating Cash Flow)" data={data} metricKey="operatingCashFlow" companies={companies} />
      <MetricChart title="毛利润 (Gross Profit)" data={data} metricKey="grossProfit" companies={companies} />
    </div>
  )
}

interface FmpMarket { price: number | null; change: number | null; changePct: number | null; dayHigh: number | null; dayLow: number | null; prevClose: number | null; marketCap: number | null; pe: number | null; eps: number | null; week52High: number | null; week52Low: number | null; beta: number | null; volume: number | null; candles: { close: number[]; timestamp: number[] } | null }
interface YahooNews { items?: Array<{ headline: string; summary: string; source: string; url: string; datetime: number }> }

function OverviewTab({ data, companies, symbol }: { data: FinancialData[]; companies: string[]; symbol: string }) {
  const [market, setMarket] = useState<FmpMarket | null>(null)
  const [news, setNews] = useState<Array<{ headline: string; datetime: number; url: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    Promise.all([
      fetch(`/api/market?symbol=${symbol}`).then(r => r.json()).catch(() => null),
      fetch(`/api/news?symbol=${symbol}`).then(r => r.json()).catch(() => null),
    ]).then(([m, n]) => {
      setMarket(m && !m.error ? m : null)
      setNews(n?.items?.slice(0, 3) || [])
    }).finally(() => setLoading(false))
  }, [symbol])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard label="股价" value={market?.price ? `$${market.price}` : '—'} source="FMP" loading={loading} />
        <MetricCard label="涨跌" value={market?.changePct != null ? `${(market.changePct * 100).toFixed(2)}%` : '—'} source="FMP" loading={loading} trend={market?.changePct != null ? (market.changePct >= 0 ? 'up' : 'down') : undefined} />
        <MetricCard label="日内高" value={market?.dayHigh ? `$${market.dayHigh}` : '—'} source="FMP" loading={loading} />
        <MetricCard label="日内低" value={market?.dayLow ? `$${market.dayLow}` : '—'} source="FMP" loading={loading} />
      </div>

      {market?.price && (
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-xs text-gray-400 mb-2">最新行情</p>
          <p className="text-2xl font-bold">${market.price} <span className={`text-sm font-medium ${(market.changePct ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>{(market.changePct ?? 0) >= 0 ? '+' : ''}{(market.changePct ?? 0 * 100).toFixed(2)}%</span></p>
        </div>
      )}

      {news.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">最新动态</h3>
          <div className="space-y-3">
            {news.map((n, i) => (
              <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className="block group">
                <p className="text-sm text-gray-800 group-hover:text-brand line-clamp-2 transition-colors">{n.headline}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(n.datetime * 1000).toLocaleDateString('zh-CN')}</p>
              </a>
            ))}
          </div>
        </div>
      )}

      {!loading && !market && !news.length && <EmptyState source="FMP" />}
    </div>
  )
}

function MarketTab({ symbol }: { symbol: string }) {
  const [data, setData] = useState<FmpMarket | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    fetch(`/api/market?symbol=${symbol}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false))
  }, [symbol])

  if (loading) return <Skeleton />
  if (error) return <ErrorBlock source="FMP" onRetry={() => window.location.reload()} />
  if (!data?.price) return <EmptyState source="FMP" />

  const closes = data.candles?.close || []
  const maxV = Math.max(...closes, 1)
  const minV = Math.min(...closes, maxV * 0.9)
  const range = maxV - minV || 1

  return (
    <div className="space-y-4 sm:space-y-6">
      {closes.length > 5 && (
        <div className="rounded-xl border border-gray-100 bg-white p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">近 6 个月走势</h3>
          <svg viewBox="0 0 800 200" className="w-full h-48">
            <polyline
              fill="none"
              stroke="#4F46E5"
              strokeWidth="2"
              points={closes.map((v, i) => `${(i / (closes.length - 1)) * 780 + 10},${200 - ((v - minV) / range) * 180 - 10}`).join(' ')}
            />
          </svg>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <MetricCard label="最新价" value={data.price != null ? `$${data.price}` : '—'} source="FMP" />
        <MetricCard label="涨跌幅" value={data.change != null ? `${data.change.toFixed(2)}%` : '—'} source="FMP" trend={data.change != null ? (data.change >= 0 ? 'up' : 'down') : undefined} />
        {data.pe != null && <MetricCard label="P/E" value={`${data.pe.toFixed(1)}x`} source="FMP" />}
        {data.marketCap != null && <MetricCard label="市值" value={`$${(data.marketCap / 1e9).toFixed(1)}B`} source="FMP" />}
        {data.eps != null && <MetricCard label="EPS" value={`$${data.eps}`} source="FMP" />}
        {data.dayHigh != null && <MetricCard label="日内高" value={`$${data.dayHigh}`} source="FMP" />}
        {data.dayLow != null && <MetricCard label="日内低" value={`$${data.dayLow}`} source="FMP" />}
        {data.week52High != null && <MetricCard label="52周高" value={`$${data.week52High}`} source="FMP" />}
        {data.week52Low != null && <MetricCard label="52周低" value={`$${data.week52Low}`} source="FMP" />}
      </div>
    </div>
  )
}

function NewsTab({ symbol }: { symbol: string }) {
  const [news, setNews] = useState<Array<{ headline: string; summary: string; url: string; source: string; datetime: number }>>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative'>('all')

  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    fetch(`/api/news?symbol=${symbol}`)
      .then(r => r.json())
      .then(d => setNews(d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [symbol])

  if (loading) return <Skeleton />
  if (!news.length) return <EmptyState source="Finnhub" />

  // Flag unverified news
  function getFlag(headline: string, url: string): string | null {
    if (!url) return '未附来源链接'
    const h = headline.toLowerCase()
    if (/anonymous|匿名|知情人士|内部人士/.test(h)) return '引用未知来源'
    return null
  }

  const displayed = filter === 'all' ? news : news.filter(n => n.headline.toLowerCase().includes(filter))

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['all', 'positive', 'negative'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded-full transition-colors duration-200 ${filter === f ? 'bg-brand text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {f === 'all' ? '全部' : f === 'positive' ? '正面' : '负面'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {displayed.map((n, i) => {
          const flag = getFlag(n.headline, n.url)
          return (
            <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-gray-100 bg-white p-4 hover:shadow-sm transition-shadow">
              {flag && <span className="inline-block mb-2 px-2 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 rounded">⚠ {flag}</span>}
              <p className="text-sm text-gray-800 font-medium line-clamp-2">{n.headline}</p>
              {n.summary && <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{n.summary}</p>}
              <p className="text-xs text-gray-400 mt-2">{n.source} · {new Date(n.datetime * 1000).toLocaleDateString('zh-CN')}</p>
            </a>
          )
        })}
      </div>
    </div>
  )
}

function RatingsTab({ symbol }: { symbol: string }) {
  const [data, setData] = useState<{ trends?: Array<{ period: string; strongBuy: number; buy: number; hold: number; sell: number; strongSell: number }>; targetMean?: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    fetch(`/api/ratings?symbol=${symbol}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [symbol])

  if (loading) return <Skeleton />
  if (!data?.trends?.length && !data?.targetMean) return <EmptyState source="FMP" />
  if (!data.trends?.length) return <EmptyState source="FMP" />

  const latest = data.trends[0]
  const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Current rating */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">分析师评级 (最新)</h3>
        <div className="flex h-6 rounded-full overflow-hidden bg-gray-100">
          {[{ label: 'Buy', v: latest.strongBuy + latest.buy, color: '#10B981' },
            { label: 'Hold', v: latest.hold, color: '#F59E0B' },
            { label: 'Sell', v: latest.sell + latest.strongSell, color: '#EF4444' }].map(s => (
            <div key={s.label} style={{ width: `${(s.v / total) * 100}%`, background: s.color }} className="flex items-center justify-center text-[10px] text-white font-medium min-w-[24px]">
              {s.v > total * 0.1 ? s.label + ' ' + s.v : ''}
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2 text-[10px] sm:text-xs text-gray-500">
          <span>🟢 Buy: {latest.strongBuy + latest.buy}</span>
          <span>🟡 Hold: {latest.hold}</span>
          <span>🔴 Sell: {latest.sell + latest.strongSell}</span>
        </div>
      </div>

      {/* Price targets */}
      {data.targetMean != null && (
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          <MetricCard label="平均目标价" value={`$${data.targetMean}`} source="FMP" />
        </div>
      )}
    </div>
  )
}

// ---- Shared UI components ----

function MetricCard({ label, value, loading, source, trend }: { label: string; value: string; loading?: boolean; source?: string; trend?: 'up' | 'down' }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 sm:p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] sm:text-xs text-gray-400">{label}</span>
        {source && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 font-medium">{source}</span>}
      </div>
      {loading ? (
        <div className="h-6 w-16 bg-gray-100 rounded animate-pulse mt-1" />
      ) : (
        <div className={`text-lg sm:text-xl font-bold ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-gray-900'}`}>
          {value}
        </div>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
      <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
    </div>
  )
}

function ErrorBlock({ source, onRetry }: { source: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 text-center">
      <p className="text-sm text-red-500 mb-2">数据加载失败</p>
      <p className="text-xs text-gray-400 mb-3">来源：{source}</p>
      <button onClick={onRetry} className="text-xs text-brand hover:underline">重试</button>
    </div>
  )
}

function EmptyState({ source }: { source: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 text-center">
      <p className="text-sm text-gray-400">暂无数据</p>
      <p className="text-xs text-gray-400 mt-1">来源：{source}</p>
    </div>
  )
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-gray-400"><Skeleton /></div>}>
      <AnalysisContent />
    </Suspense>
  )
}
