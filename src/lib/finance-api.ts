const WORKER_BASE = 'https://2assqw.cc/api'

export interface SearchResult { cik: string; ticker: string; name: string }
export interface FilingUrl { url: string; reportDate: string; form: string }

export interface FinancialData {
  company: string; ticker: string; periods: string[]
  revenue: (number | null)[]; netIncome: (number | null)[]; totalAssets: (number | null)[]
  totalLiabilities: (number | null)[]; operatingCashFlow: (number | null)[]; grossProfit: (number | null)[]
  eps?: (number | null)[]
  // TTM series (built-in at database layer)
  revenueTTM?: (number | null)[]; netIncomeTTM?: (number | null)[]; operatingCashFlowTTM?: (number | null)[]
  ebitTTM?: (number | null)[]
  // Market data from build-time
  sharesOutstanding?: (number | null)[]; marketCap?: (number | null)[]
  // Extended
  currentAssets?: (number | null)[]; currentLiabilities?: (number | null)[]; accountsReceivable?: (number | null)[]
  longTermDebt?: (number | null)[]; stockholdersEquity?: (number | null)[]; retainedEarnings?: (number | null)[]
  commonStock?: (number | null)[]; operatingIncome?: (number | null)[]; interestExpense?: (number | null)[]
  depreciationAmortization?: (number | null)[]; sellingGeneralAdmin?: (number | null)[]
  error?: string
}

export interface FetchProgress { phase: 'cache' | 'live' | 'parsing' | 'done'; downloaded: number; total: number; message: string }
export type ProgressCallback = (p: FetchProgress) => void

interface FilingInfo { company: string; ticker: string; filingUrls: FilingUrl[]; error?: string }

export async function fetchFinancials(cik: string, period: 'annual' | 'quarter', onProgress?: ProgressCallback): Promise<FinancialData> {
  const empty: (number | null)[] = []

  // Step 0: Pre-computed database (instant, no network)
  try {
    onProgress?.({ phase: 'cache', downloaded: 0, total: 0, message: '查询本地数据库...' })
    const dbRes = await fetch(`/data/${cik}.json`)
    if (dbRes.ok) {
      const db = await dbRes.json() as { quarters: Array<Record<string, number | null>>; ticker: string; name: string }
      const qs = db.quarters || []
      onProgress?.({ phase: 'done', downloaded: qs.length, total: qs.length, message: '数据库命中 (毫秒级)' })
      return {
        company: db.name, ticker: db.ticker, periods: qs.map(q => String(q.period)),
        revenue: qs.map(q => q.revenue ?? null), netIncome: qs.map(q => q.netIncome ?? null),
        grossProfit: qs.map(q => q.grossProfit ?? null), totalAssets: qs.map(q => q.totalAssets ?? null),
        totalLiabilities: qs.map(q => q.totalLiabilities ?? null), operatingCashFlow: qs.map(q => q.operatingCashFlow ?? null),
        eps: qs.map(q => q.eps ?? null),
        revenueTTM: qs.map(q => (q as Record<string,unknown>).revenueTTM as number ?? null),
        netIncomeTTM: qs.map(q => (q as Record<string,unknown>).netIncomeTTM as number ?? null),
        operatingCashFlowTTM: qs.map(q => (q as Record<string,unknown>).operatingCashFlowTTM as number ?? null),
        ebitTTM: qs.map(q => null), // computed server-side in engine
        sharesOutstanding: qs.map(q => (q as Record<string,unknown>).sharesOutstanding as number ?? null),
        marketCap: qs.map(q => (q as Record<string,unknown>).marketCap as number ?? null),
        currentAssets: empty, currentLiabilities: empty, accountsReceivable: empty,
        longTermDebt: empty, stockholdersEquity: empty, retainedEarnings: empty,
        commonStock: empty, operatingIncome: empty, interestExpense: empty,
        depreciationAmortization: empty, sellingGeneralAdmin: empty,
      }
    }
  } catch { /* fall through */ }

  // Step 1: Live SEC — Stale-While-Revalidate
  onProgress?.({ phase: 'live', downloaded: 0, total: 0, message: '正在从 SEC 获取财报列表...' })
  const res = await fetch(`${WORKER_BASE}/financials?cik=${cik}&period=${period}`)
  const info: FilingInfo = await res.json()
  if (info.error) return { company: '', ticker: '', periods: [], revenue: [], netIncome: [], totalAssets: [], totalLiabilities: [], operatingCashFlow: [], grossProfit: [], error: info.error }

  const filingCount = Math.min(info.filingUrls.length, period === 'annual' ? 5 : 6)
  onProgress?.({ phase: 'live', downloaded: 0, total: filingCount, message: `找到 ${filingCount} 份申报文件，开始下载...` })

  // Step 2: Download + parse in Web Worker (non-blocking main thread)
  const allData: Array<Record<string, number | null> & { date: string }> = []

  for (let i = 0; i < filingCount; i++) {
    const filing = info.filingUrls[i]
    try {
      onProgress?.({ phase: 'live', downloaded: i, total: filingCount, message: `下载 ${i+1}/${filingCount}: ${filing.reportDate}` })
      const docRes = await fetch(`${WORKER_BASE}/proxy?url=${encodeURIComponent(filing.url)}`)
      if (!docRes.ok) continue

      const text = await docRes.text()
      onProgress?.({ phase: 'parsing', downloaded: i + 1, total: filingCount, message: `解析 ${i+1}/${filingCount} (后台线程)...` })

      const parsed = await new Promise<Record<string, number> | null>(resolve => {
        const w = new Worker(new URL('./xbrl-worker.ts', import.meta.url))
        w.onmessage = (e) => { resolve(e.data?.data ?? null); w.terminate() }
        w.postMessage({ type: 'parse', html: text, period: filing.reportDate })
      })

      if (parsed && (parsed.revenue != null || parsed.totalAssets != null)) {
        allData.push({ date: filing.reportDate, ...parsed } as Record<string, number | null> & { date: string })
      }
    } catch { /* skip */ }
  }

  if (!allData.length) return { company: info.company, ticker: info.ticker, periods: [], revenue: [], netIncome: [], totalAssets: [], totalLiabilities: [], operatingCashFlow: [], grossProfit: [], error: '无法解析财报数据' }

  // Merge into aligned arrays
  const seen = new Set<string>()
  const unique = allData.filter(d => { if (seen.has(d.date)) return false; seen.add(d.date); return true })
  const allPeriods = [...new Set(unique.map(d => d.date))].sort().slice(-10)

  const coreKeys = ['revenue','netIncome','totalAssets','totalLiabilities','operatingCashFlow','grossProfit','eps'] as const
  const aligned: Record<string, (number | null)[]> = {}
  for (const k of coreKeys) aligned[k] = []

  for (const period of allPeriods) {
    for (const k of coreKeys) {
      const entry = unique.find(d => d.date === period)
      aligned[k].push(entry ? (entry[k] as number | null) : null)
    }
  }

  onProgress?.({ phase: 'done', downloaded: allPeriods.length, total: allPeriods.length, message: '分析完成' })
  return {
    company: info.company, ticker: info.ticker, periods: allPeriods,
    revenue: aligned.revenue, netIncome: aligned.netIncome,
    totalAssets: aligned.totalAssets, totalLiabilities: aligned.totalLiabilities,
    operatingCashFlow: aligned.operatingCashFlow, grossProfit: aligned.grossProfit,
    eps: aligned.eps,
    currentAssets: empty, currentLiabilities: empty, accountsReceivable: empty,
    longTermDebt: empty, stockholdersEquity: empty, retainedEarnings: empty,
    commonStock: empty, operatingIncome: empty, interestExpense: empty,
    depreciationAmortization: empty, sellingGeneralAdmin: empty,
  }
}
