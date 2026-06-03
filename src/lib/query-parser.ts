// Natural language financial query parser
// Supports Chinese + English metric names with comparison operators

export interface FilterClause {
  metric: string       // internal key
  op: 'gt' | 'lt' | 'gte' | 'lte'
  value: number
  raw: string          // original text
}

export interface ParsedQuery {
  filters: FilterClause[]
  keywords: string[]   // free-text keywords (company name/industry)
  raw: string
}

const METRIC_ALIASES: Record<string, string> = {
  // Revenue
  '收入': 'revenue', '营收': 'revenue', 'revenue': 'revenue',
  // Growth
  '收入增速': 'revenueGrowth', '营收增速': 'revenueGrowth', '增速': 'revenueGrowth',
  '利润增速': 'netIncomeGrowth', '净利润增速': 'netIncomeGrowth',
  // Margins
  '毛利率': 'grossMargin', '净利率': 'netMargin',
  '利润率': 'netMargin', '毛利': 'grossMargin',
  // Balance
  '负债率': 'debtRatio', '资产负债率': 'debtRatio', '杠杆': 'debtRatio',
  'ROE': 'roe', 'roe': 'roe', '资产收益率': 'roe',
  'ROA': 'roa', 'roa': 'roa', '资产回报率': 'roa',
  // Valuation
  'PE': 'pe', 'pe': 'pe', '市盈率': 'pe', '市盈': 'pe',
  'PB': 'pb', 'pb': 'pb', '市净率': 'pb',
  'PS': 'ps', 'ps': 'ps', '市销率': 'ps',
  // Size
  '市值': 'marketCap', '总市值': 'marketCap', 'marketcap': 'marketCap',
  // Cash flow
  '现金流': 'cashFlow', '经营现金流': 'cashFlow',
}

const OP_ALIASES: Record<string, 'gt' | 'lt' | 'gte' | 'lte'> = {
  '>': 'gt', '＞': 'gt', '高于': 'gt', '超过': 'gt', '大于': 'gt', 'above': 'gt', 'more': 'gt',
  '<': 'lt', '＜': 'lt', '低于': 'lt', '不足': 'lt', '小于': 'lt', 'below': 'lt', 'less': 'lt',
  '≥': 'gte', '>=': 'gte', '不低于': 'gte', '以上': 'gte', '至少': 'gte',
  '≤': 'lte', '<=': 'lte', '不超过': 'lte', '以下': 'lte', '最多': 'lte',
}

function parseValue(text: string): number | null {
  const cleaned = text.replace(/[,%％]/g, '').trim()
  // Percentages
  const pctMatch = cleaned.match(/^(-?[\d.]+)\s*%$/)
  if (pctMatch) return parseFloat(pctMatch[1])
  // Billions/Millions
  const bMatch = cleaned.match(/^(-?[\d.]+)\s*[Bb亿]/)
  if (bMatch) return parseFloat(bMatch[1]) * 1e9
  const mMatch = cleaned.match(/^(-?[\d.]+)\s*[Mm百萬]/)
  if (mMatch) return parseFloat(mMatch[1]) * 1e6
  // Plain number
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

export function parseQuery(input: string): ParsedQuery {
  const filters: FilterClause[] = []
  const keywords: string[] = []
  let remaining = input.trim()

  // Try to match: [metric] [op] [value]
  for (const [alias, metric] of Object.entries(METRIC_ALIASES)) {
    for (const [opAlias, op] of Object.entries(OP_ALIASES)) {
      // Build regex: 收入 > 30%
      const pattern = new RegExp(
        `(${escapeRegex(alias)})\\s*${escapeRegex(opAlias)}\\s*([\\d.,]+\\s*[%％Bb亿Mm]?)`,
        'gi'
      )
      const match = pattern.exec(remaining)
      if (match) {
        const value = parseValue(match[3])
        if (value !== null) {
          filters.push({ metric, op, value, raw: match[0] })
          remaining = remaining.replace(match[0], '')
        }
      }
    }
  }

  // Remaining text = keywords (company names, industries, etc.)
  const kwText = remaining.replace(/[,，\s]+/g, ' ').trim()
  if (kwText && kwText.length > 1) {
    keywords.push(...kwText.split(/\s+/))
  }

  return { filters, keywords, raw: input }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Compute metrics from FinancialData for filtering
export interface CompanyMetrics {
  cik: string
  ticker: string
  name: string
  revenueGrowth: number | null
  netIncomeGrowth: number | null
  grossMargin: number | null
  netMargin: number | null
  debtRatio: number | null
  roe: number | null
  roa: number | null
  revenue: number | null
  netIncome: number | null
  totalAssets: number | null
  totalLiabilities: number | null
  grossProfit: number | null
  operatingCashFlow: number | null
  [key: string]: number | null | string
}

export function computeMetrics(d: { periods: string[]; revenue: (number | null)[]; netIncome: (number | null)[]; totalAssets: (number | null)[]; totalLiabilities: (number | null)[]; grossProfit: (number | null)[]; operatingCashFlow: (number | null)[] }, ticker: string, name: string, cik: string): CompanyMetrics {
  const scan = (arr: (number | null)[]) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i]; return null }
  const prev = (arr: (number | null)[]) => { let f = false; for (let i = arr.length - 1; i >= 0; i--) { if (arr[i] != null) { if (f) return arr[i]; f = true } } return null }

  const rev = scan(d.revenue), revP = prev(d.revenue)
  const ni = scan(d.netIncome), niP = prev(d.netIncome)
  const gp = scan(d.grossProfit)
  const ta = scan(d.totalAssets)
  const tl = scan(d.totalLiabilities)
  const ocf = scan(d.operatingCashFlow)

  return {
    cik, ticker, name,
    revenueGrowth: rev && revP ? ((rev - revP) / revP) * 100 : null,
    netIncomeGrowth: ni && niP ? ((ni - niP) / niP) * 100 : null,
    grossMargin: rev && gp ? (gp / rev) * 100 : null,
    netMargin: rev && ni ? (ni / rev) * 100 : null,
    debtRatio: ta && tl ? (tl / ta) * 100 : null,
    revenue: rev, netIncome: ni, totalAssets: ta, totalLiabilities: tl,
    grossProfit: gp, operatingCashFlow: ocf,
    roe: null, roa: null,
  }
}

export function matchesFilters(metrics: CompanyMetrics, filters: FilterClause[]): boolean {
  for (const f of filters) {
    const raw = metrics[f.metric]
    if (raw == null || typeof raw !== 'number') return false
    const val = raw as number
    if (f.op === 'gt' && val <= f.value) return false
    if (f.op === 'lt' && val >= f.value) return false
    if (f.op === 'gte' && val < f.value) return false
    if (f.op === 'lte' && val > f.value) return false
  }
  return true
}
