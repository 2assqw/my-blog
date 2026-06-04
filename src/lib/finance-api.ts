const WORKER_BASE = 'https://2assqw.cc/api'

export interface SearchResult {
  cik: string
  ticker: string
  name: string
}

export interface FilingUrl {
  url: string
  reportDate: string
  form: string
}

export interface FinancialData {
  company: string
  ticker: string
  periods: string[]
  revenue: (number | null)[]
  netIncome: (number | null)[]
  totalAssets: (number | null)[]
  totalLiabilities: (number | null)[]
  operatingCashFlow: (number | null)[]
  grossProfit: (number | null)[]
  error?: string
}

interface FilingInfo {
  company: string
  ticker: string
  filingUrls: FilingUrl[]
  error?: string
}

type MetricKey = keyof Omit<FinancialData, 'company' | 'ticker' | 'periods' | 'error'>

const CONCEPT_MAP: Record<string, MetricKey> = {
  'Revenues': 'revenue',
  'RevenueFromContractWithCustomerExcludingAssessedTax': 'revenue',
  'NetIncomeLoss': 'netIncome',
  'Assets': 'totalAssets',
  'Liabilities': 'totalLiabilities',
  'NetCashProvidedByUsedInOperatingActivities': 'operatingCashFlow',
  'GrossProfit': 'grossProfit',
}

export async function fetchFinancials(cik: string, period: 'annual' | 'quarter'): Promise<FinancialData> {
  // Step 0: Try pre-computed database first (10-year, static, instant)
  try {
    const dbRes = await fetch(`/data/${cik}.json`)
    if (dbRes.ok) {
      const db: { quarters: Array<{ period: string; revenue: number | null; netIncome: number | null; grossProfit: number | null; totalAssets: number | null; totalLiabilities: number | null; operatingCashFlow: number | null }>; ticker: string; name: string } = await dbRes.json()
      const qs = db.quarters || []
      return {
        company: db.name, ticker: db.ticker, periods: qs.map(q => q.period),
        revenue: qs.map(q => q.revenue), netIncome: qs.map(q => q.netIncome),
        grossProfit: qs.map(q => q.grossProfit), totalAssets: qs.map(q => q.totalAssets),
        totalLiabilities: qs.map(q => q.totalLiabilities), operatingCashFlow: qs.map(q => q.operatingCashFlow),
      }
    }
  } catch { /* fall through to live SEC */ }

  // Step 1: Get filing URLs from Worker
  const res = await fetch(`${WORKER_BASE}/financials?cik=${cik}&period=${period}`)
  const info: FilingInfo = await res.json()
  if (info.error) return { company: '', ticker: '', periods: [], revenue: [], netIncome: [], totalAssets: [], totalLiabilities: [], operatingCashFlow: [], grossProfit: [], error: info.error }

  // Step 2: Download and parse XBRL from SEC directly (client-side, no CPU limits)
  const allData: Array<{ date: string; data: ReturnType<typeof parseIXBRL> }> = []

  for (const filing of info.filingUrls.slice(0, period === 'annual' ? 5 : 6)) {
    try {
      const docRes = await fetch(`${WORKER_BASE}/proxy?url=${encodeURIComponent(filing.url)}`)
      if (!docRes.ok) continue
      const text = await docRes.text()
      const parsed = parseIXBRL(text)
      if (parsed.periods.length > 0) {
        allData.push({ date: filing.reportDate, data: parsed })
      }
    } catch {
      // Skip failed downloads
    }
  }

  // Deduplicate by report date
  const seen = new Set<string>()
  const unique = allData.filter(d => {
    if (seen.has(d.date)) return false
    seen.add(d.date)
    return true
  })

  // Collect all periods and sort
  const allPeriods = new Set<string>()
  for (const d of unique) {
    for (const p of d.data.periods) allPeriods.add(p)
  }
  const periods = Array.from(allPeriods).sort().slice(-10) // Last 10 periods

  // Build aligned arrays — pick best filing for each period
  const keys: MetricKey[] = ['revenue', 'netIncome', 'totalAssets', 'totalLiabilities', 'operatingCashFlow', 'grossProfit']
  const aligned: Record<MetricKey, (number | null)[]> = {
    revenue: [], netIncome: [], totalAssets: [], totalLiabilities: [], operatingCashFlow: [], grossProfit: [],
  }

  for (const period of periods) {
    for (const k of keys) {
      let value: number | null = null
      // Find first filing that has this period and metric
      for (const d of unique) {
        const idx = d.data.periods.indexOf(period)
        if (idx >= 0 && d.data[k][idx] != null) {
          value = d.data[k][idx]
          break
        }
      }
      aligned[k].push(value)
    }
  }

  return {
    company: info.company,
    ticker: info.ticker,
    periods,
    ...aligned,
  }
}

// ---- Inline XBRL parser (client-side) ----

interface IXBRLData {
  periods: string[]
  revenue: (number | null)[]
  netIncome: (number | null)[]
  totalAssets: (number | null)[]
  totalLiabilities: (number | null)[]
  operatingCashFlow: (number | null)[]
  grossProfit: (number | null)[]
}

function parseIXBRL(text: string): IXBRLData {
  const result: IXBRLData = {
    periods: [], revenue: [], netIncome: [], totalAssets: [], totalLiabilities: [], operatingCashFlow: [], grossProfit: [],
  }

  // Parse context periods
  const ctxMap = new Map<string, string>()
  const durRegex = /<xbrli:context[^>]*id="([^"]+)"[^>]*>[\s\S]*?<xbrli:startDate>([^<]+)<\/xbrli:startDate>[\s\S]*?<xbrli:endDate>([^<]+)<\/xbrli:endDate>[\s\S]*?<\/xbrli:context>/g
  let m: RegExpExecArray | null
  while ((m = durRegex.exec(text)) !== null) ctxMap.set(m[1], m[3])
  const instRegex = /<xbrli:context[^>]*id="([^"]+)"[^>]*>[\s\S]*?<xbrli:instant>([^<]+)<\/xbrli:instant>[\s\S]*?<\/xbrli:context>/g
  while ((m = instRegex.exec(text)) !== null) ctxMap.set(m[1], m[2])

  // Parse iXBRL values
  type RawEntry = { period: string; value: number }
  const raw: Record<MetricKey, RawEntry[]> = {
    revenue: [], netIncome: [], totalAssets: [], totalLiabilities: [], operatingCashFlow: [], grossProfit: [],
  }

  const ixRegex = /<ix:non(?:Fraction|Numeric)\b([^>]*)>([^<]+)<\/ix:non(?:Fraction|Numeric)>/g
  while ((m = ixRegex.exec(text)) !== null) {
    const nameMatch = m[1].match(/\bname="([^"]+)"/)
    const ctxMatch = m[1].match(/\bcontextRef="([^"]+)"/)
    const scaleMatch = m[1].match(/\bscale="(\d+)"/)
    if (!nameMatch || !ctxMatch) continue

    const fullConcept = nameMatch[1]
    const ctxRef = ctxMatch[1]
    const scale = parseInt(scaleMatch?.[1] || '0', 10)
    const rawValue = parseFloat(m[2].replace(/,/g, ''))
    if (isNaN(rawValue)) continue

    const ctxPeriod = ctxMap.get(ctxRef)
    if (!ctxPeriod) continue

    const value = rawValue * Math.pow(10, scale)

    for (const [suffix, key] of Object.entries(CONCEPT_MAP)) {
      if (fullConcept === 'us-gaap:' + suffix || fullConcept.endsWith(':' + suffix)) {
        raw[key].push({ period: ctxPeriod, value })
        break
      }
    }
  }

  // Merge
  const periodSet = new Set<string>()
  for (const arr of Object.values(raw)) {
    for (const e of arr) periodSet.add(e.period)
  }
  result.periods = Array.from(periodSet).sort()

  for (const period of result.periods) {
    for (const [keyStr, arr] of Object.entries(raw) as [string, RawEntry[]][]) {
      const k = keyStr as MetricKey
      const entry = arr.find(e => e.period === period)
      result[k].push(entry ? entry.value : null)
    }
  }

  return result
}
