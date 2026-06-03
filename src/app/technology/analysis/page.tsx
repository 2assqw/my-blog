'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { fetchFinancials, type FinancialData } from '@/lib/finance-api'
import { CompanyScore } from '@/components/CompanyScore'
import { ScatterCompare } from '@/components/ScatterCompare'
import { MetricChart } from '@/components/MetricChart'
import { PeriodToggle } from '@/components/PeriodToggle'
import { analyze } from '@/lib/algorithmic-summary'

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
    Promise.all(ciks.map(c => fetchFinancials(c, period)))
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

  if (loading) return <Spinner />
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

function Spinner() { return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand/30 border-t-brand" /></div> }
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
      {companies.length === 2 && <CompanyScore data={data} companies={companies} />}
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
  const summary = analyze(data)
  const { risks, anomalies, totalRiskScore, summaryText, quartersAnalyzed } = summary

  const riskColor = (l: string) => l === 'critical' ? 'text-red-600 bg-red-50 dark:bg-red-900 dark:text-red-300' : l === 'high' ? 'text-orange-600 bg-orange-50 dark:bg-orange-900 dark:text-orange-300' : 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900 dark:text-yellow-300'

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 sm:p-6 dark:bg-gray-900 dark:border-gray-800 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          算法分析 · {company} ({quartersAnalyzed} 季度)
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${totalRiskScore >= 50 ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : totalRiskScore >= 25 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'}`}>
          风险评分 {totalRiskScore}/100
        </span>
      </div>

      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{summaryText}</p>

      {anomalies.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 mb-2">异常检测</h4>
          <div className="space-y-1">
            {anomalies.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className={`shrink-0 px-1 py-0.5 rounded font-medium ${a.severity === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'}`}>
                  {a.severity === 'critical' ? '严重' : '警告'}
                </span>
                <span className="text-gray-600 dark:text-gray-400">{a.description} (偏差 {a.deviation})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-500 mb-2">风险评估</h4>
        <div className="grid grid-cols-2 gap-2">
          {risks.map((r, i) => (
            <div key={i} className={`rounded-lg p-3 ${riskColor(r.level)} bg-opacity-30`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold">{r.category}</span>
                <span className="text-[10px] opacity-70">{r.score}/25</span>
              </div>
              <p className="text-[10px] leading-relaxed opacity-80">{r.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-gray-400 text-center">算法分析基于纯数学统计（Z-score、IQR、线性回归），非 AI 生成</p>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">{text}</div>
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <AnalysisContent />
    </Suspense>
  )
}
