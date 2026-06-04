'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { fetchFinancials, type FinancialData, type FetchProgress } from '@/lib/finance-api'
import { CompanyScore } from '@/components/CompanyScore'
import { ScatterCompare } from '@/components/ScatterCompare'
import { MetricChart } from '@/components/MetricChart'
import { PeriodToggle } from '@/components/PeriodToggle'
import { runEngine } from '@/lib/finscope-engine'
import { computeScores, INDICATORS, IndicatorCategory } from '@/lib/finscope-indicators'
import { analyzePatterns } from '@/lib/finscope-patterns'
import { analyzeSentiment, extractMDAText, analyzeTrend, type SentimentScore } from '@/lib/finscope-sentiment'
import { generateScoreReport, type ScoreReport } from '@/lib/finscope-scoring'

const TABS = ['overview', 'financials', 'market', 'news', 'ratings'] as const
type Tab = (typeof TABS)[number]
const LABELS: Record<Tab, string> = { overview: '概览', financials: '财报', market: '市场', news: '新闻', ratings: '评级' }

interface YahooMarket { price: number | null; change: number | null; changePct: number | null; dayHigh: number | null; dayLow: number | null; prevClose: number | null; candles: { close: number[]; timestamp: number[] } | null }

function getMarketStatus(): { label: string; color: string } {
  const now = new Date()
  const day = now.getUTCDay()
  const m = now.getUTCHours() * 60 + now.getUTCMinutes()
  const month = now.getUTCMonth() // 0=Jan
  const isDST = month >= 2 && month <= 10 // US DST approx March–Nov
  const off = isDST ? 4 : 5
  const pre = 4 * 60 + off * 60
  const open = 9 * 60 + 30 + off * 60
  const close = 16 * 60 + off * 60
  const after = 20 * 60 + off * 60

  if (day === 0 || day === 6) return { label: '休市', color: 'bg-gray-200 text-gray-600' }
  if (m < pre)    return { label: '盘前待开', color: 'bg-gray-200 text-gray-600' }
  if (m < open)   return { label: '盘前交易', color: 'bg-amber-100 text-amber-700' }
  if (m < close)  return { label: '交易中',  color: 'bg-green-100 text-green-700' }
  if (m < after)  return { label: '盘后交易', color: 'bg-amber-100 text-amber-700' }
  return { label: '已收盘', color: 'bg-gray-200 text-gray-600' }
}

function AnalysisContent() {
  const params = useSearchParams()
  const router = useRouter()
  const ciks = (params.get('ciks') || '').split(',').filter(Boolean)
  const [tab, setTab] = useState<Tab>('overview')
  const [period, setPeriod] = useState<'annual' | 'quarter'>('annual')
  const [data, setData] = useState<FinancialData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<FetchProgress | null>(null)

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      const idx = TABS.indexOf(tab)
      if (e.key === '1') setTab('overview')
      else if (e.key === '2') setTab('financials')
      else if (e.key === '3') setTab('market')
      else if (e.key === '4') setTab('news')
      else if (e.key === '5') setTab('ratings')
      else if (e.key === 'ArrowRight' && idx < TABS.length - 1) setTab(TABS[idx + 1])
      else if (e.key === 'ArrowLeft' && idx > 0) setTab(TABS[idx - 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tab])

  useEffect(() => {
    if (!ciks.length) { router.push('/technology/'); return }
    setLoading(true)
    setError('')
    setProgress(null)
    Promise.all(ciks.map(c => fetchFinancials(c, period, setProgress)))
      .then(r => {
        if (r.some(x => x.error)) setError(r.find(x => x.error)?.error || '获取失败')
        else setData(r)
      })
      .catch(() => setError('网络请求失败'))
      .finally(() => setLoading(false))
  }, [ciks.join(','), period, router])

  const tickers = data.map(d => d.ticker || d.company)
  const title = tickers.length === 2 ? `${tickers[0]} vs ${tickers[1]}` : tickers[0] || ''
  const symbol = tickers[0] || ''

  if (loading) return <Spinner progress={progress} />
  if (error) return <ErrorPage error={error} />

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 bg-white/80 backdrop-blur px-3 sm:px-6 py-2 border-b border-gray-100">
        <Link href="/technology/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors shrink-0">← FinScope</Link>
        <span className="text-xs sm:text-sm font-semibold text-gray-800 truncate max-w-[40%]">{title}</span>
        <PeriodToggle value={period} onChange={setPeriod} />
      </div>

      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-4xl px-3 sm:px-6 flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors duration-200 border-b-2 -mb-[1px] whitespace-nowrap ${tab === t ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-3 sm:px-6 py-4 sm:py-8">
        {tab === 'overview' && <OverviewTab data={data} companies={tickers} symbol={symbol} cik={ciks[0]} />}
        {tab === 'financials' && <FinancialsTab data={data} companies={tickers} />}
        {tab === 'market' && <MarketTab symbol={symbol} />}
        {tab === 'news' && <NewsTab symbol={symbol} />}
        {tab === 'ratings' && <RatingsTab symbol={symbol} />}
        <SourceFooter tab={tab} />
      </div>
    </div>
  )
}

function Spinner({ progress }: { progress?: FetchProgress | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
        {progress && (
          <>
            <p className="text-sm text-gray-500">{progress.message}</p>
            {progress.total > 0 && (
              <div className="w-64 mx-auto">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden dark:bg-gray-800">
                  <div className="h-full bg-brand rounded-full transition-all duration-300"
                    style={{ width: `${Math.round((progress.downloaded / progress.total) * 100)}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1">{progress.downloaded}/{progress.total}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
function ErrorPage({ error }: { error: string }) {
  return <div className="flex min-h-screen items-center justify-center"><div className="text-center"><p className="text-red-500 mb-4">{error}</p><button onClick={() => window.location.reload()} className="text-brand hover:underline text-sm">重试</button></div></div>
}

function SourceFooter({ tab }: { tab: Tab }) {
  const s: Record<Tab, string> = {
    overview: 'Yahoo Finance · SEC EDGAR',
    financials: 'SEC EDGAR · 10-K/10-Q 原始申报',
    market: 'Yahoo Finance · 行情延迟 15 分钟',
    news: 'Yahoo Finance · 新闻聚合',
    ratings: 'Yahoo Finance · 评级摘要',
  }
  return <div className="mt-8 pt-4 border-t border-gray-100 text-center text-[10px] sm:text-xs text-gray-400">数据来源：{s[tab]}</div>
}

// ====== Overview Tab ======

function OverviewTab({ data, companies, symbol, cik }: { data: FinancialData[]; companies: string[]; symbol: string; cik: string }) {
  const [mkt, setMkt] = useState<YahooMarket | null>(null)
  const [news, setNews] = useState<Array<{ headline: string; datetime: number; url: string }>>([])

  useEffect(() => {
    if (!symbol) return
    Promise.all([
      fetch(`/api/market?symbol=${symbol}`).then(r => r.json()).catch(() => null),
      fetch(`/api/news?symbol=${symbol}`).then(r => r.json()).catch(() => null),
    ]).then(([m, n]) => {
      if (m && !m.error) setMkt(m)
      setNews(n?.items?.slice(0, 3) || [])
    })
  }, [symbol])

  const d = data[0]
  const i = d ? d.periods.length - 1 : -1
  const rev = i >= 0 && d.revenue[i] ? d.revenue[i]! : 0
  const ni = i >= 0 && d.netIncome[i] ? d.netIncome[i]! : 0
  const gp = i >= 0 && d.grossProfit[i] ? d.grossProfit[i]! : 0
  const ta = i >= 0 && d.totalAssets[i] ? d.totalAssets[i]! : 0
  const tl = i >= 0 && d.totalLiabilities[i] ? d.totalLiabilities[i]! : 0
  const fmt = (v: number) => v >= 1e12 ? (v/1e12).toFixed(1)+'T' : (v/1e9).toFixed(1)+'B'

  return (
    <div className="space-y-4 sm:space-y-6">
      {mkt?.price && (
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-2xl font-bold">${mkt.price}</span>
            <span className={`text-sm font-medium ${(mkt.change ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>{(mkt.change ?? 0) >= 0 ? '+' : ''}{mkt.change?.toFixed(2) ?? '—'} ({(mkt.changePct ?? 0).toFixed(2)}%)</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getMarketStatus().color}`}>{getMarketStatus().label}</span>
            <span className="text-[10px] text-gray-400 ml-auto">Yahoo</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card label="最新收入" value={`$${fmt(rev)}`} src="SEC" />
        <Card label="净利润" value={`$${fmt(ni)}`} src="SEC" />
        <Card label="毛利率" value={rev > 0 ? `${((gp/rev)*100).toFixed(1)}%` : '—'} src="SEC" />
        <Card label="负债率" value={ta > 0 ? `${((tl/ta)*100).toFixed(1)}%` : '—'} src="SEC" />
      </div>

      <InsiderCard cik={cik} />
      <EventsCard cik={cik} />

      {news.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">最新动态</h3>
          <div className="space-y-3">
            {news.map((n, i) => (
              <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className="block group">
                <p className="text-sm text-gray-800 group-hover:text-brand line-clamp-2">{n.headline}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(n.datetime * 1000).toLocaleDateString('zh-CN')}</p>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ label, value, src }: { label: string; value: string; src: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-gray-400">{label}</span>
        <span className="text-[9px] px-1 rounded bg-gray-50 text-gray-400">{src}</span>
      </div>
      <div className="text-sm sm:text-base font-bold text-gray-900">{value}</div>
    </div>
  )
}

// ====== Financials Tab ======

function FinancialsTab({ data, companies }: { data: FinancialData[]; companies: string[] }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {data.map((d, i) => (
        <div key={i} className="space-y-4">
          <ScoreDashboard data={d} company={companies[i]} />
          <IndicatorDashboard data={d} company={companies[i]} />
          <PatternDashboard data={d} company={companies[i]} />
          <SentimentCard symbol={companies[i]} periods={d.periods} />
        </div>
      ))}
      <ScatterCompare data={data} companies={companies} />
      <MetricChart title="收入" data={data} metricKey="revenue" companies={companies} />
      <MetricChart title="净利润" data={data} metricKey="netIncome" companies={companies} />
      <MetricChart title="总资产" data={data} metricKey="totalAssets" companies={companies} />
      <MetricChart title="总负债" data={data} metricKey="totalLiabilities" companies={companies} />
      <MetricChart title="经营现金流" data={data} metricKey="operatingCashFlow" companies={companies} />
      <MetricChart title="毛利润" data={data} metricKey="grossProfit" companies={companies} />
      {data.map((d, i) => (
        <AlgorithmicSummary key={i} data={d} company={companies[i]} />
      ))}
    </div>
  )
}

// ====== Market Tab ======

function MarketTab({ symbol }: { symbol: string }) {
  const [d, setD] = useState<YahooMarket | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!symbol) return
    fetch(`/api/market?symbol=${symbol}`).then(r => r.json())
      .then(x => { if (x.error) setErr(x.error); else setD(x); })
      .catch(() => setErr('加载失败'))
  }, [symbol])

  if (err) return <Empty text={err} />
  if (!d?.price) return <Empty text="无行情数据" />

  const closes = d.candles?.close || []
  const maxV = Math.max(...closes, 1), minV = Math.min(...closes, maxV * 0.9), range = maxV - minV || 1

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-700">市场数据</h3>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getMarketStatus().color}`}>{getMarketStatus().label}</span>
      </div>
      {closes.length > 5 && (
        <div className="rounded-xl border border-gray-100 bg-white p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">近 6 个月走势</h3>
          <svg viewBox="0 0 800 200" className="w-full h-48">
            <polyline fill="none" stroke="#4F46E5" strokeWidth="2"
              points={closes.map((v, i) => `${(i/(closes.length-1))*780+10},${200-((v-minV)/range)*180-10}`).join(' ')} />
          </svg>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card label="最新价" value={`$${d.price}`} src="Yahoo" />
        <Card label="涨跌" value={d.change != null ? `${d.change.toFixed(2)}` : '—'} src="Yahoo" />
        <Card label="日内高" value={d.dayHigh ? `$${d.dayHigh}` : '—'} src="Yahoo" />
        <Card label="日内低" value={d.dayLow ? `$${d.dayLow}` : '—'} src="Yahoo" />
        <Card label="前收盘" value={d.prevClose ? `$${d.prevClose}` : '—'} src="Yahoo" />
      </div>
    </div>
  )
}

// ====== News Tab ======

function NewsTab({ symbol }: { symbol: string }) {
  const [news, setNews] = useState<Array<{ headline: string; summary: string; url: string; source: string; datetime: number }>>([])

  useEffect(() => {
    if (!symbol) return
    fetch(`/api/news?symbol=${symbol}`).then(r => r.json()).then(x => setNews(x.items || []))
  }, [symbol])

  if (!news.length) return <Empty text="暂无新闻" />

  return (
    <div className="space-y-3">
      {news.map((n, i) => {
        const flag = !n.url ? '未附来源链接' : /匿名|知情人士|内部人士/.test(n.headline) ? '引用未知来源' : null
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
  )
}

// ====== Ratings Tab ======

function RatingsTab({ symbol }: { symbol: string }) {
  const [d, setD] = useState<{ trends?: Array<{ period: string; strongBuy: number; buy: number; hold: number; sell: number; strongSell: number }>; targetMean?: number } | null>(null)

  useEffect(() => {
    if (!symbol) return
    fetch(`/api/ratings?symbol=${symbol}`).then(r => r.json()).then(x => { if (!x.error) setD(x) })
  }, [symbol])

  if (!d?.trends?.length) return <Empty text="暂无评级数据" />

  const latest = d.trends[0]
  const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-xl border border-gray-100 bg-white p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">分析师评级</h3>
        <div className="flex h-6 rounded-full overflow-hidden bg-gray-100">
          {[
            { v: latest.strongBuy + latest.buy, c: '#10B981', l: 'Buy' },
            { v: latest.hold, c: '#F59E0B', l: 'Hold' },
            { v: latest.sell + latest.strongSell, c: '#EF4444', l: 'Sell' },
          ].map(s => (
            <div key={s.l} style={{ width: `${(s.v/total)*100}%`, background: s.c }} className="flex items-center justify-center text-[10px] text-white font-medium min-w-[24px]">
              {s.v > total * 0.1 ? `${s.l} ${s.v}` : ''}
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2 text-[10px] sm:text-xs text-gray-500">
          <span>Buy: {latest.strongBuy + latest.buy}</span>
          <span>Hold: {latest.hold}</span>
          <span>Sell: {latest.sell + latest.strongSell}</span>
        </div>
      </div>
      {d.targetMean != null && <Card label="平均目标价" value={`$${d.targetMean}`} src="Yahoo" />}
    </div>
  )
}

function EventsCard({ cik }: { cik: string }) {
  const [items, setItems] = useState<Array<{ type: string; date: string; description: string; form: string }>>([])
  useEffect(() => {
    if (!cik) return
    fetch(`/api/events?cik=${cik}`).then(r => r.json()).then(d => setItems(d.items || []))
  }, [cik])
  if (!items.length) return null

  const icons: Record<string, string> = { earnings: '📅', filing: '📄', '10-K': '📊', '10-Q': '📋', '8-K': '⚠️', '4': '👤' }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 dark:bg-gray-900 dark:border-gray-800">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">近期动向</h3>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-5 text-center">{icons[it.form] || icons[it.type] || '·'}</span>
            <span className="text-gray-400 w-20 shrink-0">{it.date}</span>
            <span className={`font-medium ${it.type === 'earnings' ? 'text-brand dark:text-brand-400' : 'text-gray-600 dark:text-gray-400'}`}>
              {it.form === '10-K' ? '年报' : it.form === '10-Q' ? '季报' : it.form === '8-K' ? '重大事项' : it.form === '4' ? '内部人交易' : it.type === 'earnings' ? '财报预计' : it.form}
            </span>
            <span className="text-gray-400 truncate hidden sm:inline">{it.description}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function InsiderCard({ cik }: { cik: string }) {
  const [items, setItems] = useState<Array<{ title: string; summary: string; date: string; url: string }>>([])
  useEffect(() => {
    if (!cik) return
    fetch(`/api/insider?cik=${cik}`).then(r => r.json()).then(d => setItems(d.items || []))
  }, [cik])
  if (!items.length) return null

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 dark:bg-gray-900 dark:border-gray-800">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">内部人交易</h3>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {items.map((it, i) => {
          const isBuy = it.title.includes('Purchase') || it.summary.includes('P-Purchase')
          const isSell = it.title.includes('Sale') || it.summary.includes('S-Sale')
          const badge = isBuy ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : isSell ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          const action = isBuy ? '买入' : isSell ? '卖出' : '交易'
          return (
            <a key={i} href={it.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 text-xs group">
              <span className={`shrink-0 px-1.5 py-0.5 rounded font-medium ${badge}`}>{action}</span>
              <span className="text-gray-600 dark:text-gray-400 truncate flex-1">{it.summary}</span>
            </a>
          )
        })}
      </div>
    </div>
  )
}

function AlgorithmicSummary({ data, company }: { data: FinancialData; company: string }) {
  const engine = runEngine(data, company)
  const { risk, correlations, patterns, quartersAnalyzed } = engine

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 sm:p-6 dark:bg-gray-900 dark:border-gray-800 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          FinScope 引擎 · {company} ({quartersAnalyzed} 季度)
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          risk.totalScore >= 50 ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
          risk.totalScore >= 25 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
          'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
        }`}>
          风险 {risk.totalScore}/100
        </span>
      </div>

      {/* Patterns */}
      {patterns.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 mb-2">形态识别</h4>
          <div className="space-y-1">
            {patterns.map((p, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  p.pattern === 'acceleration' || p.pattern === 'steady-growth' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                  p.pattern === 'V-recovery' || p.pattern === 'J-curve' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                  p.pattern === 'L-stagnation' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {p.pattern}
                </span>
                <span className="text-gray-600 dark:text-gray-400">{p.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cross-metric correlations */}
      {correlations.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 mb-2">跨指标关联</h4>
          <div className="space-y-1">
            {correlations.filter(c => c.interpretation && c.interpretation.length > 4).slice(0, 4).map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className={`shrink-0 px-1 py-0.5 rounded text-[10px] font-medium ${
                  c.significance === 'strong' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' :
                  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  r={c.correlation}
                </span>
                <span className="text-gray-600 dark:text-gray-400">{c.interpretation}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk breakdown */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 mb-2">风险分解</h4>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: '波动', score: risk.volatilityScore, max: 30 },
            { label: '动量', score: risk.momentumScore, max: 30 },
            { label: '关联', score: risk.correlationScore, max: 20 },
            { label: '形态', score: risk.patternScore, max: 20 },
          ].map(r => (
            <div key={r.label} className="text-center">
              <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-0.5">
                <div className={`h-full rounded-full ${r.score > r.max * 0.7 ? 'bg-red-500' : r.score > r.max * 0.4 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${(r.score / r.max) * 100}%` }} />
              </div>
              <span className="text-[9px] text-gray-400">{r.label} {r.score}</span>
            </div>
          ))}
        </div>
        {risk.breakdown.length > 0 && (
          <div className="mt-2 space-y-0.5">
            {risk.breakdown.slice(0, 3).map((b, i) => (
              <p key={i} className="text-[10px] text-amber-600 dark:text-amber-400">⚠ {b}</p>
            ))}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 p-3">
        <p className="text-[10px] text-red-600 dark:text-red-400 leading-relaxed">
          ⚠️ <strong>免责声明：</strong>FinScope 引擎所有计算（估值、预测、风险评分、形态识别）均为纯算法推导，基于 SEC 历史财报数据，不构成任何投资建议。参考入场价由多因子模型加权得出，不保证准确性。股市有风险，投资须谨慎。过去表现不代表未来收益。请咨询持牌金融顾问后再做投资决策。
        </p>
      </div>

      <p className="text-[10px] text-gray-400 text-center">FinScope Adaptive Analytics Engine — MWE · 波动率自适应 · 跨指标关联矩阵</p>
    </div>
  )
}

function IndicatorDashboard({ data, company }: { data: FinancialData; company: string }) {
  const { categoryScores, totalScore, indicatorCount } = computeScores(data)

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 sm:p-6 dark:bg-gray-900 dark:border-gray-800 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          指标体系 · {company} ({indicatorCount} 项)
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          totalScore >= 70 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
          totalScore >= 50 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
          'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
        }`}>
          综合评分 {totalScore}/100
        </span>
      </div>

      {/* Category score bars */}
      <div className="space-y-2">
        {categoryScores.map(cat => (
          <div key={cat.category}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-gray-500 dark:text-gray-500">{cat.name}</span>
              <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">{cat.score}/100</span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  cat.score >= 70 ? 'bg-green-500' : cat.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${cat.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Top & bottom indicators */}
      <div className="grid grid-cols-2 gap-1 text-[10px]">
        {categoryScores.map(cat => {
          const sorted = [...cat.indicators].filter(s => s.value != null).sort((a, b) => b.score - a.score)
          const best = sorted[0], worst = sorted[sorted.length - 1]
          return (
            <div key={cat.category} className="text-gray-500 dark:text-gray-500">
              <p>↑ {best?.name || '—'} <span className="text-green-600">{best?.value?.toFixed(1)}{best?.id.includes('p0') || best?.id.includes('g0') ? '%' : ''}</span></p>
              <p>↓ {worst?.name || '—'} <span className="text-red-500">{worst?.value?.toFixed(1)}{worst?.id.includes('p0') || worst?.id.includes('g0') ? '%' : ''}</span></p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PatternDashboard({ data, company }: { data: FinancialData; company: string }) {
  const report = analyzePatterns(data, company)
  const { patterns, compositeSignal, dimensions } = report

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 sm:p-6 dark:bg-gray-900 dark:border-gray-800 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">模式识别 · {report.quarters.length} 季度</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          compositeSignal.direction === '看多' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
          compositeSignal.direction === '看空' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
          'bg-gray-100 text-gray-600'
        }`}>
          {compositeSignal.direction} {compositeSignal.score}/100
        </span>
      </div>

      {/* 5-dimension grid */}
      <div className="grid grid-cols-5 gap-1.5 text-center text-[10px]">
        <DimCell label="收入" color={dimensions.revenue.trend === 'up' ? 'green' : dimensions.revenue.trend === 'down' ? 'red' : 'gray'}>
          {dimensions.revenue.trend === 'up' ? '↑' : dimensions.revenue.trend === 'down' ? '↓' : '→'} {dimensions.revenue.momentum}
        </DimCell>
        <DimCell label="毛利" color={dimensions.margin.trend === 'up' ? 'green' : dimensions.margin.trend === 'down' ? 'red' : 'gray'}>
          {dimensions.margin.level}%
        </DimCell>
        <DimCell label="预期" color={dimensions.guidance.accuracy > 50 ? 'green' : 'gray'}>
          {dimensions.guidance.accuracy}%
        </DimCell>
        <DimCell label="反应" color={dimensions.reaction.avgReaction > 0 ? 'green' : 'red'}>
          {dimensions.reaction.positivePct}%
        </DimCell>
        <DimCell label="股价" color={dimensions.price.return > 0 ? 'green' : 'red'}>
          {dimensions.price.return > 0 ? '+' : ''}{dimensions.price.return}%
        </DimCell>
      </div>

      {/* Patterns */}
      {patterns.length > 0 && (
        <div className="space-y-1.5">
          {patterns.map((p, i) => (
            <div key={i} className={`flex items-start gap-2 text-xs rounded-lg p-2 ${
              p.signal.includes('bullish') ? 'bg-green-50 dark:bg-green-900/20' :
              p.signal.includes('bearish') ? 'bg-red-50 dark:bg-red-900/20' :
              'bg-gray-50 dark:bg-gray-800'
            }`}>
              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                p.signal === 'strong-bullish' ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200' :
                p.signal === 'bullish' ? 'bg-green-100 text-green-700' :
                p.signal === 'bearish' ? 'bg-red-100 text-red-700' :
                p.signal === 'strong-bearish' ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200' :
                'bg-gray-200 text-gray-600'
              }`}>
                {p.signal.includes('bullish') ? '↑' : p.signal.includes('bearish') ? '↓' : '—'} {Math.round(p.confidence)}%
              </span>
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-300">{p.name}</p>
                <p className="text-gray-500">{p.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SentimentCard({ symbol, periods }: { symbol: string; periods: string[] }) {
  const [scores, setScores] = useState<SentimentScore[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    // Fetch latest filing via proxy and analyze sentiment
    const cik = periods.length > 0 ? undefined : undefined // We need filing URLs from Worker

    // For now: analyze the MD&A from the most recent 10-K/10-Q filings
    // Get filing URLs from the financials endpoint
    fetch(`/api/financials?cik=&period=annual&ticker=${symbol}`).then(r => r.json()).then(async info => {
      if (!info.filingUrls?.length) { setLoading(false); return }

      const results: SentimentScore[] = []
      for (const f of info.filingUrls.slice(0, 6)) {
        try {
          const proxyUrl = `/api/proxy?url=${encodeURIComponent(f.url)}`
          const res = await fetch(proxyUrl)
          const html = await res.text()
          const text = extractMDAText(html)
          if (text.length > 100) {
            results.push(analyzeSentiment(text, f.reportDate.slice(0, 7)))
          }
        } catch { /* skip */ }
      }
      setScores(results)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [symbol])

  const trend = analyzeTrend(scores)

  if (loading) return <div className="rounded-xl border border-gray-100 bg-white p-4 dark:bg-gray-900 dark:border-gray-800"><div className="h-4 w-32 bg-gray-100 animate-pulse rounded" /></div>
  if (!scores.length) return null

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 sm:p-6 dark:bg-gray-900 dark:border-gray-800 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">管理层情绪</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          trend.trend === 'improving' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
          trend.trend === 'declining' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
          trend.trend === 'volatile' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
          'bg-gray-100 text-gray-600'
        }`}>
          趋势 {trend.trend === 'improving' ? '改善中' : trend.trend === 'declining' ? '下降中' : trend.trend === 'volatile' ? '波动' : '稳定'}
        </span>
      </div>

      {/* Sentiment bar */}
      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
        <div className="h-full bg-green-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, 50 + trend.latestComposite / 2))}%` }} />
        <div className="h-full bg-red-300" style={{ width: `${Math.max(0, Math.min(100, 50 - trend.latestComposite / 2))}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>悲观</span>
        <span>复合情绪 {trend.latestComposite > 0 ? '+' : ''}{trend.latestComposite}</span>
        <span>乐观</span>
      </div>

      {/* Latest filing details */}
      {scores[0] && (
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p>最新分析 ({scores[0].period})，基于 {scores[0].wordCount} 词</p>
          <div className="flex gap-4">
            <span className="text-green-600 dark:text-green-400">乐观词 {scores[0].optimistic}</span>
            <span className="text-red-500 dark:text-red-400">谨慎词 {scores[0].cautious}</span>
            <span>前瞻性 {scores[0].forwardLooking}</span>
            <span>不确定性 {scores[0].uncertainty}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function DimCell({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-lg p-2 ${color === 'green' ? 'bg-green-50 dark:bg-green-900/20' : color === 'red' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-800'}`}>
      <p className="text-gray-400 mb-0.5">{label}</p>
      <p className="font-medium text-gray-800 dark:text-gray-200">{children}</p>
    </div>
  )
}

function ScoreDashboard({ data, company }: { data: FinancialData; company: string }) {
  // Pass actual market cap for X₄ calculation
  const mktCap = (data.marketCap?.length || 0) > 0 ? data.marketCap![data.marketCap!.length - 1] : null
  const report = generateScoreReport(data, mktCap)
  const { altmanZ, beneishM, piotroskiF, consensus, consensusScore } = report

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 sm:p-6 dark:bg-gray-900 dark:border-gray-800 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">量化评分 · {company}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          consensusScore >= 60 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
          consensusScore >= 35 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
          'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
        }`}>
          {consensus === 'strong-buy' ? '★★★ 强烈推荐' : consensus === 'buy' ? '★★ 推荐' : consensus === 'hold' ? '★ 持有' : consensus === 'caution' ? '⚠ 谨慎' : '✗ 回避'} {consensusScore}/100
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[altmanZ, beneishM, piotroskiF].map(s => (
          <div key={s.name} className="rounded-lg border border-gray-100 dark:border-gray-800 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-gray-500">{s.name}</span>
              <span className="text-[9px] text-gray-400">{s.score}</span>
            </div>
            <p className="text-[11px] mb-2">{s.rating}</p>
            <p className="text-[10px] text-gray-400 leading-relaxed mb-2">{s.interpretation}</p>
            <div className="space-y-0.5">
              {s.components.map((c, j) => (
                <div key={j} className="flex items-center justify-between text-[9px]">
                  <span className="text-gray-500">{c.label}</span>
                  <span className={c.pass ? 'text-green-600' : 'text-red-500'}>{c.pass ? '✓' : '✗'} {c.threshold}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 text-center">评分基于 SEC 10-K/10-Q 原始数据，算法引用自 Altman (1968), Beneish (1999), Piotroski (2000)</p>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">{text}</div>
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<Spinner progress={null} />}>
      <AnalysisContent />
    </Suspense>
  )
}
