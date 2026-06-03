// FinScope Pattern Recognition Engine
// 40-quarter multi-dimensional data → proprietary signal generation

import type { FinancialData } from '@/lib/finance-api'

// ---- Quarter-level unified data ----

export interface QuarterRecord {
  period: string                     // YYYY-MM-DD
  revenue: number
  netIncome: number
  grossProfit: number
  totalAssets: number
  totalLiabilities: number
  operatingCashFlow: number
  // Derived
  margin: number                     // gross profit / revenue
  netMargin: number                  // net income / revenue
  revenueQoQ: number                 // quarter-over-quarter growth %
  earningsQoQ: number                // net income QoQ %
  marginChange: number               // margin QoQ change (pp)
  // Guidance (approximated: predicted vs actual)
  guidanceDelta: number | null       // (actual - predicted) / predicted %
  // Market reaction (requires price data — filled separately)
  priceReaction: number | null       // % price change ±5 days around filing
  priceReturn: number | null         // quarterly price return
}

export interface PatternMatch {
  name: string
  description: string
  signal: 'strong-bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong-bearish'
  confidence: number                  // 0-100
  matchedFeatures: string[]
  historicalFrequency: number         // how often this pattern appeared
}

export interface PatternReport {
  company: string
  quarters: QuarterRecord[]
  patterns: PatternMatch[]
  compositeSignal: { direction: string; strength: number; score: number }
  dimensions: {
    revenue: { trend: string; volatility: number; momentum: number }
    margin: { trend: string; volatility: number; level: number }
    guidance: { accuracy: number; bias: string; consistency: number }
    reaction: { avgReaction: number; positivePct: number; magnitude: number }
    price: { return: number; volatility: number; sharpe: number }
  }
}

// ---- Build quarter records from financial data ----

export function buildQuarters(d: FinancialData): QuarterRecord[] {
  const records: QuarterRecord[] = []

  for (let i = 0; i < d.periods.length; i++) {
    const rev = d.revenue[i] ?? 0
    const ni = d.netIncome[i] ?? 0
    const gp = d.grossProfit[i] ?? 0
    const ta = d.totalAssets[i] ?? 0
    const tl = d.totalLiabilities[i] ?? 0
    const ocf = d.operatingCashFlow[i] ?? 0

    if (rev === 0 && ni === 0) continue

    const margin = rev > 0 ? (gp / rev) * 100 : 0
    const netMargin = rev > 0 ? (ni / rev) * 100 : 0
    const prev = records.length > 0 ? records[records.length - 1] : null

    // Guidance: use linear extrapolation of last 3 quarters as "expected"
    let guidanceDelta: number | null = null
    if (records.length >= 3) {
      const recent = records.slice(-3).map(r => r.revenue)
      const predicted = recent[2] + (recent[2] - recent[0]) / 2 // simple extrapolation
      if (predicted > 0) guidanceDelta = ((rev - predicted) / predicted) * 100
    }

    records.push({
      period: d.periods[i],
      revenue: rev, netIncome: ni, grossProfit: gp,
      totalAssets: ta, totalLiabilities: tl, operatingCashFlow: ocf,
      margin, netMargin,
      revenueQoQ: prev && prev.revenue > 0 ? ((rev - prev.revenue) / prev.revenue) * 100 : 0,
      earningsQoQ: prev && prev.netIncome > 0 ? ((ni - prev.netIncome) / prev.netIncome) * 100 : 0,
      marginChange: prev ? margin - prev.margin : 0,
      guidanceDelta,
      priceReaction: null,
      priceReturn: null,
    })
  }

  return records.slice(-40) // last 40 quarters
}

// ---- Feature extraction by dimension ----

interface DimensionFeatures {
  trend: { direction: string; slope: number; consistency: number }
  volatility: number
  recent: { avg: number; latest: number; change: number }
  extreme: { max: number; min: number; range: number }
  momentum: number  // -1 to +1
  signal: number    // -100 to +100
}

function analyzeDimension(values: number[], positiveIsGood = true): DimensionFeatures {
  const n = values.length
  if (n < 4) return {
    trend: { direction: 'neutral', slope: 0, consistency: 0 },
    volatility: 0, recent: { avg: 0, latest: 0, change: 0 },
    extreme: { max: 0, min: 0, range: 0 }, momentum: 0, signal: 0,
  }

  const avg = values.reduce((a, b) => a + b, 0) / n
  const v = Math.sqrt(values.reduce((s, v) => s + (v - avg) ** 2, 0) / n)
  const cv = Math.abs(avg) > 0.001 ? v / Math.abs(avg) : 0

  // Trend: linear slope, consistency = R²
  const xs = Array.from({ length: n }, (_, i) => i)
  const mx = (n - 1) / 2
  let num = 0, den = 0
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (values[i] - avg); den += (xs[i] - mx) ** 2 }
  const slope = den > 0 ? num / den : 0
  const normalizedSlope = Math.abs(avg) > 0.001 ? slope / Math.abs(avg) : 0

  // Consistency: how many points are on the same side of the trend line
  const intercept = avg - slope * mx
  let consistentCount = 0
  for (let i = 0; i < n; i++) {
    const expected = intercept + slope * xs[i]
    const residual = values[i] - expected
    if (Math.abs(residual) < v) consistentCount++
  }
  const consistency = consistentCount / n

  // Recent (last 4)
  const recent4 = values.slice(-4)
  const rAvg = recent4.reduce((a, b) => a + b, 0) / recent4.length
  const latest = values[n - 1]
  const change = latest - values[n - 4]

  // Momentum: weighted recent vs long-term
  const momentum = Math.tanh(normalizedSlope * 5)

  // Signal: combine trend + momentum + consistency
  const signal = Math.max(-100, Math.min(100,
    (positiveIsGood ? 1 : -1) * normalizedSlope * 100 * 0.4 +
    momentum * 100 * 0.3 +
    consistency * 100 * 0.3
  ))

  return {
    trend: {
      direction: normalizedSlope > 0.05 ? 'up' : normalizedSlope < -0.05 ? 'down' : 'flat',
      slope: normalizedSlope,
      consistency,
    },
    volatility: cv,
    recent: { avg: rAvg, latest, change },
    extreme: { max: Math.max(...values), min: Math.min(...values), range: Math.max(...values) - Math.min(...values) },
    momentum,
    signal: Math.round(signal),
  }
}

// ---- Pattern Library ----

function recognizePatterns(records: QuarterRecord[]): PatternMatch[] {
  const patterns: PatternMatch[] = []
  const n = records.length
  if (n < 8) return patterns

  const recent = records.slice(-4)
  const revQoQ = recent.map(r => r.revenueQoQ)
  const marginChg = recent.map(r => r.marginChange)
  const earnQoQ = recent.map(r => r.earningsQoQ)
  const guidance = recent.filter(r => r.guidanceDelta != null).map(r => r.guidanceDelta!)

  // Pattern 1: Accelerating revenue + expanding margin
  // Revenue QoQ is increasing AND margin is rising
  if (revQoQ.length >= 3) {
    const revAccel = revQoQ[2] > revQoQ[0] && revQoQ[1] > revQoQ[0]
    const marginUp = marginChg.reduce((a, b) => a + b, 0) > 0.5

    if (revAccel && marginUp) {
      patterns.push({
        name: '营收加速 + 利润率扩张',
        description: '收入增速逐季加快，毛利持续改善——典型的戴维斯双击前兆',
        signal: 'strong-bullish',
        confidence: 85,
        matchedFeatures: ['revAccel', 'marginUp'],
        historicalFrequency: recent.filter(r => r.revenueQoQ > records.slice(0, -4).reduce((a, b) => a + b.revenueQoQ, 0) / (n - 4)).length,
      })
    }
  }

  // Pattern 2: Revenue growing but margin compressing
  if (revQoQ.every(r => r > 0) && marginChg.some(m => m < -0.5)) {
    patterns.push({
      name: '增收不增利',
      description: '收入保持增长但利润率承压——可能面临成本上升或竞争加剧',
      signal: 'bearish',
      confidence: 70,
      matchedFeatures: ['revUp', 'marginDown'],
      historicalFrequency: 0,
    })
  }

  // Pattern 3: Positive guidance surprise × 2+ quarters
  if (guidance.length >= 2 && guidance.every(g => g > 2)) {
    patterns.push({
      name: '连续超预期',
      description: '连续 2+ 季度实际收入超出预测值——管理层保守或业务加速',
      signal: 'bullish',
      confidence: 75,
      matchedFeatures: ['guidanceBeat'],
      historicalFrequency: guidance.filter(g => g > 0).length,
    })
  }

  // Pattern 4: Revenue decline deceleration (bottoming signal)
  if (n >= 8) {
    const older = records.slice(-8, -4)
    const olderAvg = older.reduce((a, r) => a + r.revenueQoQ, 0) / 4
    const newerAvg = revQoQ.reduce((a, b) => a + b, 0) / 4
    if (olderAvg < 0 && newerAvg > olderAvg && newerAvg > -2) {
      patterns.push({
        name: '收入下滑趋缓',
        description: '收入下降速度减缓，可能出现业绩拐点',
        signal: 'bullish',
        confidence: 60,
        matchedFeatures: ['declineDecelerating'],
        historicalFrequency: 0,
      })
    }
  }

  // Pattern 5: Margin wild swings
  if (marginChg.length >= 3) {
    const swings = marginChg.reduce((c, m) => c + (Math.abs(m) > 2 ? 1 : 0), 0)
    if (swings >= 3) {
      patterns.push({
        name: '利润率剧烈波动',
        description: '毛利大幅波动——成本结构不稳定，可预测性差',
        signal: 'bearish',
        confidence: 65,
        matchedFeatures: ['marginVolatility'],
        historicalFrequency: swings,
      })
    }
  }

  // Pattern 6: Earnings miss with margin collapse (double whammy)
  if (guidance.some(g => g < -5) && marginChg.some(m => m < -1)) {
    patterns.push({
      name: '业绩不及预期 + 利润率下降',
      description: '收入不达预期且利润率同时恶化——基本面恶化信号',
      signal: 'strong-bearish',
      confidence: 80,
      matchedFeatures: ['earningsMiss', 'marginCollapse'],
      historicalFrequency: 0,
    })
  }

  // Pattern 7: Cash flow diverges from earnings
  const recentCF = recent.map(r => r.operatingCashFlow / Math.max(1, r.netIncome))
  const cfDiverging = recentCF.some(c => c < 0.5)
  if (cfDiverging && earnQoQ.some(e => e > 0)) {
    patterns.push({
      name: '利润增长但现金流恶化',
      description: '账面利润增长但现金转化率下降——盈利质量存疑',
      signal: 'bearish',
      confidence: 70,
      matchedFeatures: ['cfDivergence'],
      historicalFrequency: 0,
    })
  }

  // Pattern 8: All signals positive (perfect storm)
  const positiveCount = patterns.filter(p => p.signal.includes('bullish')).length
  const negativeCount = patterns.filter(p => p.signal.includes('bearish')).length
  if (positiveCount >= 3 && negativeCount === 0) {
    patterns.push({
      name: '多项利好共振',
      description: '多个指标同时发出正面信号——基本面全面向好',
      signal: 'strong-bullish',
      confidence: 90,
      matchedFeatures: ['multiPositive'],
      historicalFrequency: positiveCount,
    })
  }

  return patterns
}

// ---- Main Engine ----

export function analyzePatterns(d: FinancialData, company: string): PatternReport {
  const quarters = buildQuarters(d)
  const n = quarters.length

  // Dimension analysis
  const rev = quarters.map(q => q.revenueQoQ)
  const margin = quarters.map(q => q.margin)
  const guidance = quarters.filter(q => q.guidanceDelta != null).map(q => q.guidanceDelta!)
  const priceQ = quarters.filter(q => q.priceReturn != null).map(q => q.priceReturn!)
  const reaction = quarters.filter(q => q.priceReaction != null).map(q => q.priceReaction!)

  const dimensions: PatternReport['dimensions'] = {
    revenue: {
      trend: analyzeDimension(rev, true).trend.direction,
      volatility: Math.round(analyzeDimension(rev, true).volatility * 100),
      momentum: Math.round(analyzeDimension(rev, true).momentum * 100),
    },
    margin: {
      trend: analyzeDimension(margin, true).trend.direction,
      volatility: Math.round(analyzeDimension(margin, true).volatility * 100),
      level: quarters.length > 0 ? Math.round(quarters[quarters.length - 1].margin) : 0,
    },
    guidance: {
      accuracy: guidance.length > 0 ? Math.round(guidance.filter(g => g > 0).length / guidance.length * 100) : 0,
      bias: guidance.length > 0 ? (guidance.reduce((a, b) => a + b, 0) > 0 ? '乐观超预期' : '保守预期') : '数据不足',
      consistency: guidance.length > 2 ? Math.round(analyzeDimension(guidance, true).trend.consistency * 100) : 0,
    },
    reaction: {
      avgReaction: reaction.length > 0 ? Math.round(reaction.reduce((a, b) => a + b, 0) / reaction.length * 100) / 100 : 0,
      positivePct: reaction.length > 0 ? Math.round(reaction.filter(r => r > 0).length / reaction.length * 100) : 0,
      magnitude: reaction.length > 0 ? Math.round(reaction.reduce((a, b) => a + Math.abs(b), 0) / reaction.length * 100) / 100 : 0,
    },
    price: {
      return: priceQ.length > 0 ? Math.round(priceQ.reduce((a, b) => a + b, 0) / priceQ.length * 100) / 100 : 0,
      volatility: priceQ.length > 1 ? Math.round(analyzeDimension(priceQ, true).volatility * 100) : 0,
      sharpe: priceQ.length > 1 ? Math.round(priceQ.reduce((a, b) => a + b, 0) / Math.max(0.001, Math.sqrt(priceQ.reduce((s, p) => s + (p - priceQ.reduce((a, b) => a + b, 0) / priceQ.length) ** 2, 0) / priceQ.length)) * 100) / 100 : 0,
    },
  }

  const patterns = recognizePatterns(quarters)

  // Composite signal
  const signalScore = patterns.reduce((s, p) => {
    if (p.signal === 'strong-bullish') return s + 2 * p.confidence / 100
    if (p.signal === 'bullish') return s + 1 * p.confidence / 100
    if (p.signal === 'bearish') return s - 1 * p.confidence / 100
    if (p.signal === 'strong-bearish') return s - 2 * p.confidence / 100
    return s
  }, 0)

  const compositeSignal = {
    direction: signalScore > 1 ? '看多' : signalScore < -1 ? '看空' : '中性',
    strength: Math.round(Math.abs(signalScore) * 25),
    score: Math.round(Math.max(-100, Math.min(100, signalScore * 25))),
  }

  return { company, quarters, patterns, compositeSignal, dimensions }
}
