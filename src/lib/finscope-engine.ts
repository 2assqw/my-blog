// FinScope Adaptive Analytics Engine
// Custom algorithms: MWE, volatility bands, cross-metric correlation, pattern recognition, adaptive risk

import type { FinancialData } from '@/lib/finance-api'

// ---- Data Preparation ----

interface QRow {
  period: string; revenue: number; netIncome: number; grossProfit: number
  totalAssets: number; totalLiabilities: number; operatingCashFlow: number
  index: number
}

function toQuarters(d: FinancialData, maxQ = 12): QRow[] {
  const rows: QRow[] = []
  for (let i = Math.max(0, d.periods.length - maxQ); i < d.periods.length; i++) {
    rows.push({
      period: d.periods[i].slice(0, 7),
      revenue: d.revenue[i] ?? 0,
      netIncome: d.netIncome[i] ?? 0,
      grossProfit: d.grossProfit[i] ?? 0,
      totalAssets: d.totalAssets[i] ?? 0,
      totalLiabilities: d.totalLiabilities[i] ?? 0,
      operatingCashFlow: d.operatingCashFlow[i] ?? 0,
      index: rows.length,
    })
  }
  return rows
}

type MetricKey = 'revenue' | 'netIncome' | 'grossProfit' | 'totalAssets' | 'totalLiabilities' | 'operatingCashFlow'

// ---- Algorithm 1: Momentum-Weighted Extrapolation (MWE) ----

interface MweResult {
  predicted: number | null
  confidence: number           // 0-1
  upperBand: number | null     // volatility-adjusted upper bound
  lowerBand: number | null     // volatility-adjusted lower bound
  trendStrength: number        // -1 to 1
  momentum: number             // 0-1 recent bias indicator
}

function mwe(values: number[]): MweResult {
  const valid = values.filter(v => v > 0)
  if (valid.length < 3) return { predicted: null, confidence: 0, upperBand: null, lowerBand: null, trendStrength: 0, momentum: 0 }

  const n = valid.length
  const mean = valid.reduce((a, b) => a + b, 0) / n
  const sigma = Math.sqrt(valid.reduce((s, v) => s + (v - mean) ** 2, 0) / n)

  // Volatility-adaptive lambda: high volatility → more weight to recent data
  const cv = sigma / (Math.abs(mean) + 1)  // coefficient of variation
  const lambda = 0.2 + Math.min(cv * 0.3, 0.5)  // adaptive λ in [0.2, 0.7]

  // Compute exponential weights
  const weights: number[] = []
  for (let i = 0; i < n; i++) weights.push(Math.exp(-lambda * (n - 1 - i)))
  const wSum = weights.reduce((a, b) => a + b, 0)

  // Weighted mean
  let wMean = 0
  for (let i = 0; i < n; i++) wMean += valid[i] * weights[i] / wSum

  // Weighted trend (slope of weighted regression)
  let wNum = 0, wDen = 0
  const xMean = (n - 1) / 2
  for (let i = 0; i < n; i++) {
    const w = weights[i] / wSum
    wNum += w * (i - xMean) * (valid[i] - wMean)
    wDen += w * (i - xMean) ** 2
  }
  const wSlope = wDen > 0 ? wNum / wDen : 0

  // Prediction: weighted mean + slope * weighted trend
  const predicted = wMean + wSlope * 1  // 1 step ahead

  // Volatility-adjusted prediction bands
  // Band expands with prediction horizon: sigma * sqrt(steps)
  const bandFactor = sigma * Math.sqrt(1) * 1.5  // 1.5σ for 1-step ahead
  const upper = predicted + bandFactor
  const lower = Math.max(0, predicted - bandFactor)

  // Confidence: based on R² of weighted fit
  let ssRes = 0, ssTot = 0
  for (let i = 0; i < n; i++) {
    const w = weights[i] / wSum
    const fitted = wMean + wSlope * (i - xMean)
    ssRes += w * (valid[i] - fitted) ** 2
    ssTot += w * (valid[i] - wMean) ** 2
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0

  // Momentum: how much recent values deviate from long-term mean
  const recentAvg = valid.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, n)
  const momentum = Math.tanh((recentAvg - mean) / (sigma + 1)) // -1 to 1

  return {
    predicted: Math.max(0, predicted),
    confidence: Math.max(0, Math.min(1, r2)),
    upperBand: Math.max(0, upper),
    lowerBand: Math.max(0, lower),
    trendStrength: Math.tanh(wSlope / (sigma / n + 1)),
    momentum,
  }
}

// ---- Algorithm 2: Cross-Metric Correlation Engine ----

interface Correlation {
  a: MetricKey; b: MetricKey; correlation: number; significance: 'strong' | 'moderate' | 'weak'
  interpretation: string
}

function crossMetricCorrelation(rows: QRow[]): Correlation[] {
  const metrics: MetricKey[] = ['revenue', 'netIncome', 'grossProfit', 'totalAssets', 'totalLiabilities', 'operatingCashFlow']
  const results: Correlation[] = []

  for (let i = 0; i < metrics.length; i++) {
    for (let j = i + 1; j < metrics.length; j++) {
      const a = metrics[i], b = metrics[j]
      const va = rows.map(r => r[a]), vb = rows.map(r => r[b])
      const n = va.length
      const ma = va.reduce((s, v) => s + v, 0) / n, mb = vb.reduce((s, v) => s + v, 0) / n
      let num = 0, da = 0, db = 0
      for (let k = 0; k < n; k++) {
        num += (va[k] - ma) * (vb[k] - mb)
        da += (va[k] - ma) ** 2
        db += (vb[k] - mb) ** 2
      }
      const corr = (da > 0 && db > 0) ? num / Math.sqrt(da * db) : 0
      const abs = Math.abs(corr)

      // Generate interpretation
      let interp = ''
      if (a === 'revenue' && b === 'grossProfit' && corr < 0.7) interp = '收入与毛利相关性弱，成本结构可能不稳定'
      else if (a === 'revenue' && b === 'operatingCashFlow' && corr < 0.5) interp = '收入与现金流脱节，应收账款或库存可能膨胀'
      else if (a === 'netIncome' && b === 'operatingCashFlow' && corr < 0.6) interp = '利润与现金流不一致，盈利质量待考察'
      else if (a === 'totalAssets' && b === 'revenue' && corr > 0.9) interp = '资产增长与收入增长高度同步，资本效率稳定'
      else if (a === 'totalLiabilities' && b === 'totalAssets' && corr > 0.9) interp = '负债与资产同步增长，杠杆率稳定'

      if (abs > 0.3 || interp) {
        results.push({
          a, b,
          correlation: Math.round(corr * 1000) / 1000,
          significance: abs > 0.8 ? 'strong' : abs > 0.5 ? 'moderate' : 'weak',
          interpretation: interp || (corr > 0 ? '正相关' : '负相关'),
        })
      }
    }
  }

  return results.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)).slice(0, 6)
}

// ---- Algorithm 3: Pattern Recognition ----

type Pattern = 'V-recovery' | 'L-stagnation' | 'J-curve' | 'acceleration' | 'steady-growth' | 'volatile'

interface PatternResult {
  metric: string
  pattern: Pattern
  confidence: number
  description: string
}

function recognizePatterns(rows: QRow[]): PatternResult[] {
  const results: PatternResult[] = []
  const metrics: { key: MetricKey; label: string }[] = [
    { key: 'revenue', label: '收入' },
    { key: 'netIncome', label: '净利润' },
    { key: 'grossProfit', label: '毛利润' },
  ]

  for (const { key, label } of metrics) {
    const vals = rows.map(r => r[key]).filter(v => v > 0)
    if (vals.length < 6) continue
    const n = vals.length
    const firstThird = vals.slice(0, Math.floor(n / 3))
    const lastThird = vals.slice(-Math.floor(n / 3))
    const middle = vals.slice(Math.floor(n / 3), Math.ceil(2 * n / 3))

    const firstAvg = firstThird.reduce((a, b) => a + b, 0) / firstThird.length
    const lastAvg = lastThird.reduce((a, b) => a + b, 0) / lastThird.length
    const midAvg = middle.reduce((a, b) => a + b, 0) / middle.length

    const totalGrowth = firstAvg > 0 ? (lastAvg - firstAvg) / firstAvg : 0

    // V-recovery: mid < first AND last > first
    if (midAvg < firstAvg * 0.9 && lastAvg > firstAvg * 1.1) {
      results.push({ metric: label, pattern: 'V-recovery', confidence: 0.8, description: `${label}经历中期低谷后强劲恢复` })
    }
    // L-stagnation: mid ≈ last AND last < first
    else if (midAvg > 0 && lastAvg / midAvg < 1.05 && lastAvg / midAvg > 0.95 && totalGrowth < -0.1) {
      results.push({ metric: label, pattern: 'L-stagnation', confidence: 0.7, description: `${label}下降后持续低位运行，未见恢复迹象` })
    }
    // J-curve: first → mid decline, mid → last growth exceeding pre-decline
    else if (midAvg < firstAvg * 0.95 && lastAvg > firstAvg * 1.2) {
      results.push({ metric: label, pattern: 'J-curve', confidence: 0.75, description: `${label}先降后超预期增长，呈现J型曲线` })
    }
    // Acceleration: growth rate is increasing
    else if (n >= 8) {
      const growths: number[] = []
      for (let i = 1; i < n; i++) {
        if (vals[i - 1] > 0) growths.push((vals[i] - vals[i - 1]) / vals[i - 1])
      }
      const firstGrowths = growths.slice(0, Math.floor(growths.length / 2))
      const lastGrowths = growths.slice(-Math.floor(growths.length / 2))
      const firstGRate = firstGrowths.reduce((a, b) => a + b, 0) / firstGrowths.length
      const lastGRate = lastGrowths.reduce((a, b) => a + b, 0) / lastGrowths.length
      if (lastGRate > firstGRate * 2 && lastGRate > 0.05) {
        results.push({ metric: label, pattern: 'acceleration', confidence: 0.7, description: `${label}增速持续加快` })
      }
    }
    // Steady growth: consistent positive slope, low volatility
    if (results.length === 0) {
      const m = vals.reduce((a, b) => a + b, 0) / n
      const sd = Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / n) / (m + 1)
      if (totalGrowth > 0.1 && sd < 0.15) {
        results.push({ metric: label, pattern: 'steady-growth', confidence: 0.6, description: `${label}持续稳定增长` })
      } else if (sd > 0.3) {
        results.push({ metric: label, pattern: 'volatile', confidence: 0.5, description: `${label}波动性较大` })
      }
    }
  }

  return results
}

// ---- Algorithm 4: Adaptive Risk Score ----

interface RiskAssessment {
  totalScore: number        // 0-100
  volatilityScore: number   // 0-30
  momentumScore: number     // 0-30
  correlationScore: number  // 0-20
  patternScore: number      // 0-20
  breakdown: string[]
}

function adaptiveRisk(rows: QRow[], mweResults: Record<MetricKey, MweResult>, correlations: Correlation[], patterns: PatternResult[]): RiskAssessment {
  const breakdown: string[] = []

  // Volatility risk (0-30): high variance = risky
  const metrics: MetricKey[] = ['revenue', 'netIncome', 'grossProfit', 'totalLiabilities', 'operatingCashFlow']
  let volScore = 0
  for (const key of metrics) {
    const vals = rows.map(r => r[key]).filter(v => v > 0)
    if (vals.length < 3) continue
    const m = vals.reduce((a, b) => a + b, 0) / vals.length
    const cv = Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length) / (Math.abs(m) + 1)
    if (cv > 0.3) { volScore += 6; breakdown.push(`${key}波动性高(CV=${(cv*100).toFixed(0)}%)`) }
    else if (cv > 0.15) volScore += 3
  }
  volScore = Math.min(30, volScore)

  // Momentum risk (0-30): negative momentum signals
  let momScore = 0
  for (const key of ['revenue', 'netIncome', 'operatingCashFlow'] as MetricKey[]) {
    const m = mweResults[key]
    if (m.trendStrength < -0.3) { momScore += 10; breakdown.push(`${key}趋势下行`) }
    else if (m.trendStrength < 0) momScore += 5
    if (m.momentum < -0.3) { momScore += 5; breakdown.push(`${key}近期动量转弱`) }
  }
  momScore = Math.min(30, momScore)

  // Correlation risk (0-20): unexpected correlation breaks
  let corrScore = 0
  for (const c of correlations) {
    if (c.interpretation && c.interpretation.length > 6) {
      corrScore += 5
      breakdown.push(c.interpretation)
    }
  }
  corrScore = Math.min(20, corrScore)

  // Pattern risk (0-20): negative patterns
  let patScore = 0
  for (const p of patterns) {
    if (p.pattern === 'L-stagnation' || p.pattern === 'volatile') {
      patScore += 8; breakdown.push(p.description)
    }
  }
  patScore = Math.min(20, patScore)

  return {
    totalScore: volScore + momScore + corrScore + patScore,
    volatilityScore: volScore,
    momentumScore: momScore,
    correlationScore: corrScore,
    patternScore: patScore,
    breakdown,
  }
}

// ---- Main Engine Export ----

export interface EngineOutput {
  company: string
  quartersAnalyzed: number
  predictions: Record<string, MweResult>
  correlations: Correlation[]
  patterns: PatternResult[]
  risk: RiskAssessment
}

export function runEngine(d: FinancialData, company: string): EngineOutput {
  const rows = toQuarters(d, 12)

  const mweResults: Record<MetricKey, MweResult> = {
    revenue: mwe(rows.map(r => r.revenue)),
    netIncome: mwe(rows.map(r => r.netIncome)),
    grossProfit: mwe(rows.map(r => r.grossProfit)),
    totalAssets: mwe(rows.map(r => r.totalAssets)),
    totalLiabilities: mwe(rows.map(r => r.totalLiabilities)),
    operatingCashFlow: mwe(rows.map(r => r.operatingCashFlow)),
  }

  const correlations = crossMetricCorrelation(rows)
  const patterns = recognizePatterns(rows)
  const risk = adaptiveRisk(rows, mweResults, correlations, patterns)

  return {
    company,
    quartersAnalyzed: rows.length,
    predictions: {
      收入: mweResults.revenue,
      净利润: mweResults.netIncome,
      毛利润: mweResults.grossProfit,
      总资产: mweResults.totalAssets,
      总负债: mweResults.totalLiabilities,
      经营现金流: mweResults.operatingCashFlow,
    },
    correlations,
    patterns,
    risk,
  }
}
