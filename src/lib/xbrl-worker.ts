// Web Worker — XBRL parsing in background thread
// Avoids blocking the main UI thread during 2MB+ file parsing

interface ParseRequest { type: 'parse'; html: string; period: string }
interface ParseResponse { type: 'result'; period: string; data: XBRLResult | null }
interface XBRLResult {
  revenue: number | null; netIncome: number | null; grossProfit: number | null
  totalAssets: number | null; totalLiabilities: number | null; operatingCashFlow: number | null
  eps: number | null
}

const CONCEPT_MAP: Record<string, keyof XBRLResult> = {
  'Revenues': 'revenue', 'RevenueFromContractWithCustomerExcludingAssessedTax': 'revenue',
  'SalesRevenueNet': 'revenue', 'SalesRevenueGoodsNet': 'revenue',
  'OperatingRevenueRevenue': 'revenue', 'RevenuesNetOfInterestExpense': 'revenue',
  'NetIncomeLoss': 'netIncome', 'ProfitLoss': 'netIncome',
  'GrossProfit': 'grossProfit', 'Assets': 'totalAssets', 'Liabilities': 'totalLiabilities',
  'NetCashProvidedByUsedInOperatingActivities': 'operatingCashFlow',
  'EarningsPerShareDiluted': 'eps', 'EarningsPerShareBasic': 'eps',
  'EarningsPerShareBasicAndDiluted': 'eps',
}

function extractPeriods(html: string): Map<string, string> {
  const ctx = new Map<string, string>()
  const dur = /<xbrli:context[^>]*id="([^"]+)"[^>]*>[\s\S]*?<xbrli:startDate>([^<]+)<\/xbrli:startDate>[\s\S]*?<xbrli:endDate>([^<]+)<\/xbrli:endDate>[\s\S]*?<\/xbrli:context>/g
  let m: RegExpExecArray | null
  while ((m = dur.exec(html)) !== null) ctx.set(m[1], m[3])
  const inst = /<xbrli:context[^>]*id="([^"]+)"[^>]*>[\s\S]*?<xbrli:instant>([^<]+)<\/xbrli:instant>[\s\S]*?<\/xbrli:context>/g
  while ((m = inst.exec(html)) !== null) ctx.set(m[1], m[2])
  return ctx
}

function parse(html: string, reportPeriod: string): XBRLResult | null {
  const ctxMap = extractPeriods(html)
  const raw: Record<string, Array<{ p: string; v: number }>> = {}

  const ix = /<ix:non(?:Fraction|Numeric)\b([^>]*)>([^<]+)<\/ix:non(?:Fraction|Numeric)>/g
  let m: RegExpExecArray | null
  while ((m = ix.exec(html)) !== null) {
    const nm = m[1].match(/\bname="([^"]+)"/)
    const cm = m[1].match(/\bcontextRef="([^"]+)"/)
    const sm = m[1].match(/\bscale="(\d+)"/)
    if (!nm || !cm) continue
    const period = ctxMap.get(cm[1])
    if (!period) continue
    const scale = parseInt(sm?.[1] || '0', 10)
    const val = parseFloat(m[2].replace(/,/g, '')) * Math.pow(10, scale)
    if (isNaN(val)) continue

    for (const [suffix, key] of Object.entries(CONCEPT_MAP)) {
      if (nm[1] === 'us-gaap:' + suffix || nm[1].endsWith(':' + suffix)) {
        if (!raw[key]) raw[key] = []
        raw[key].push({ p: period, v: val })
        break
      }
    }
  }

  // Use the report period as the primary date — find the latest value for each concept
  const result: XBRLResult = {
    revenue: null, netIncome: null, grossProfit: null,
    totalAssets: null, totalLiabilities: null, operatingCashFlow: null,
    eps: null,
  }
  for (const [k, entries] of Object.entries(raw)) {
    const key = k as keyof XBRLResult
    const latest = entries[entries.length - 1] // Last entry typically matches report date
    if (latest) result[key] = latest.v
  }

  return result.revenue != null || result.totalAssets != null ? result : null
}

self.onmessage = (e: MessageEvent<ParseRequest>) => {
  if (e.data.type === 'parse') {
    const result = parse(e.data.html, e.data.period)
    self.postMessage({ type: 'result', period: e.data.period, data: result } satisfies ParseResponse)
  }
}
