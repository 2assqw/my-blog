const WORKER_BASE = 'https://2assqw.cc/api'

export interface SearchResult {
  cik: string
  ticker: string
  name: string
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

export async function searchCompanies(query: string): Promise<SearchResult[]> {
  const res = await fetch(`${WORKER_BASE}/search?q=${encodeURIComponent(query)}`)
  const data = await res.json()
  return data.results || []
}

export async function fetchFinancials(cik: string, period: 'annual' | 'quarter'): Promise<FinancialData> {
  const res = await fetch(`${WORKER_BASE}/financials?cik=${cik}&period=${period}`)
  return res.json()
}
