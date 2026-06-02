'use client'

import type { FinancialData } from '@/lib/finance-api'

interface Props {
  data: FinancialData[]
  companies: string[]
}

interface RatioSet {
  revenueGrowth: number | null
  netIncomeGrowth: number | null
  grossMargin: number | null
  netMargin: number | null
  roa: number | null
  debtRatio: number | null
  cashFlowRatio: number | null
}

// Find latest non-null value scanning backward
function latest(arr: (number | null)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i]
  return null
}
function prevVal(arr: (number | null)[]): number | null {
  let found = false
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] != null) {
      if (found) return arr[i]
      found = true
    }
  }
  return null
}

function computeRatios(d: FinancialData): RatioSet {
  const rev = latest(d.revenue)
  const revPrev = prevVal(d.revenue)
  const ni = latest(d.netIncome)
  const niPrev = prevVal(d.netIncome)
  const gp = latest(d.grossProfit)
  const ta = latest(d.totalAssets)
  const tl = latest(d.totalLiabilities)
  const ocf = latest(d.operatingCashFlow)

  return {
    revenueGrowth: rev && revPrev ? ((rev - revPrev) / revPrev) * 100 : null,
    netIncomeGrowth: ni && niPrev ? ((ni - niPrev) / niPrev) * 100 : null,
    grossMargin: rev && gp ? (gp / rev) * 100 : null,
    netMargin: rev && ni ? (ni / rev) * 100 : null,
    roa: ta && ni ? (ni / ta) * 100 : null,
    debtRatio: ta && tl ? (tl / ta) * 100 : null,
    cashFlowRatio: rev && ocf ? (ocf / rev) * 100 : null,
  }
}

interface RatioDef {
  key: keyof RatioSet
  label: string
  higherBetter: boolean
  fmt: (v: number) => string
}

const RATIOS: RatioDef[] = [
  { key: 'revenueGrowth', label: '收入增速', higherBetter: true, fmt: v => v.toFixed(1) + '%' },
  { key: 'netIncomeGrowth', label: '利润增速', higherBetter: true, fmt: v => v.toFixed(1) + '%' },
  { key: 'grossMargin', label: '毛利率', higherBetter: true, fmt: v => v.toFixed(1) + '%' },
  { key: 'netMargin', label: '净利率', higherBetter: true, fmt: v => v.toFixed(1) + '%' },
  { key: 'roa', label: 'ROA', higherBetter: true, fmt: v => v.toFixed(1) + '%' },
  { key: 'debtRatio', label: '负债率', higherBetter: false, fmt: v => v.toFixed(1) + '%' },
  { key: 'cashFlowRatio', label: '现金流/收入', higherBetter: true, fmt: v => v.toFixed(1) + '%' },
]

export function CompanyScore({ data, companies }: Props) {
  const ratios = data.map(computeRatios)
  const colors = ['#4F46E5', '#F59E0B']

  // Score each ratio
  let scores = [0, 0]
  RATIOS.forEach(r => {
    const a = ratios[0][r.key]
    const b = ratios[1]?.[r.key]
    if (a == null || b == null) return
    if (r.higherBetter) {
      if (a > b) scores[0]++
      else if (b > a) scores[1]++
    } else {
      if (a < b) scores[0]++
      else if (b < a) scores[1]++
    }
  })

  const winner = scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : -1

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">财务比率对比</h3>

      {/* Score banner */}
      <div className="flex items-center justify-center gap-6 mb-6 bg-gray-50 rounded-lg py-4">
        {companies.map((c, i) => (
          <div key={c} className="text-center">
            <span className="text-xs text-gray-400">{c}</span>
            <div className={`text-2xl font-bold ${i === winner ? 'text-brand' : scores[i] === scores[1-i] ? 'text-gray-400' : 'text-gray-300'}`}>
              {scores[i]}
              <span className="text-xs font-normal text-gray-400">/7</span>
            </div>
          </div>
        ))}
        {winner >= 0 && (
          <div className="text-center">
            <span className="text-xs text-gray-400">领先</span>
            <div className="text-sm font-semibold text-brand">{companies[winner]}</div>
          </div>
        )}
      </div>

      {/* Ratio comparison rows */}
      <div className="space-y-2 sm:space-y-3">
        {RATIOS.map(r => {
          const a = ratios[0][r.key]
          const b = ratios[1]?.[r.key]
          const aWins = a != null && b != null && (r.higherBetter ? a > b : a < b)
          const bWins = a != null && b != null && (r.higherBetter ? b > a : b < a)

          return (
            <div key={r.key} className="flex items-center gap-2 sm:gap-4">
              <span className="text-[11px] sm:text-xs text-gray-500 w-16 sm:w-24 shrink-0">{r.label}</span>
              <div className={`flex-1 text-right text-xs sm:text-sm font-medium ${aWins ? 'text-brand' : 'text-gray-400'}`}>
                {a != null ? r.fmt(a) : '—'}
                {aWins && <span className="ml-0.5 text-[10px]">★</span>}
              </div>
              <div className={`flex-1 text-left text-xs sm:text-sm font-medium ${bWins ? 'text-amber-600' : 'text-gray-400'}`}>
                {bWins && <span className="mr-0.5 text-[10px]">★</span>}
                {b != null ? r.fmt(b) : '—'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
