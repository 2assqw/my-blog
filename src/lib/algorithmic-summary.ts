// Algorithmic financial analysis — pure math, no AI

export interface Anomaly {
  metric: string
  period: string
  value: number
  expected: number
  deviation: number  // Z-score
  severity: 'warning' | 'critical'
  description: string
}

export interface RiskItem {
  category: string
  level: 'low' | 'medium' | 'high' | 'critical'
  score: number  // 0-25 per category, 0-100 total
  detail: string
}

export interface Summary {
  title: string
  anomalies: Anomaly[]
  risks: RiskItem[]
  totalRiskScore: number
  summaryText: string
  quartersAnalyzed: number
}

// Data shape
interface QData {
  period: string
  revenue: number
  netIncome: number
  grossProfit: number
  totalAssets: number
  totalLiabilities: number
  operatingCashFlow: number
}

function prepareData(
  periods: string[],
  revenue: (number | null)[],
  netIncome: (number | null)[],
  grossProfit: (number | null)[],
  totalAssets: (number | null)[],
  totalLiabilities: (number | null)[],
  cashFlow: (number | null)[]
): QData[] {
  const data: QData[] = []
  for (let i = 0; i < periods.length; i++) {
    const rev = revenue[i] ?? 0
    const ni = netIncome[i] ?? 0
    const gp = grossProfit[i] ?? 0
    const ta = totalAssets[i] ?? 0
    const tl = totalLiabilities[i] ?? 0
    const cf = cashFlow[i] ?? 0
    if (rev === 0 && ni === 0 && ta === 0) continue // skip completely empty
    data.push({ period: periods[i], revenue: rev, netIncome: ni, grossProfit: gp, totalAssets: ta, totalLiabilities: tl, operatingCashFlow: cf })
  }
  return data
}

// ---- Statistical helpers ----

function mean(arr: number[]): number { return arr.reduce((a, b) => a + b, 0) / arr.length }
function stdDev(arr: number[], m: number): number {
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length)
}
function linearSlope(y: number[]): number {
  const n = y.length
  const x = Array.from({ length: n }, (_, i) => i)
  const mx = mean(x), my = mean(y)
  let num = 0, den = 0
  for (let i = 0; i < n; i++) { num += (x[i] - mx) * (y[i] - my); den += (x[i] - mx) ** 2 }
  return den === 0 ? 0 : num / den
}

Function IQR(arr: number[]): { q1: number; q3: number; iqr: number } {
  const sorted = [...arr].sort((a, b) => a - b)
  const q1 = sorted[Math.floor(sorted.length * 0.25)]
  const q3 = sorted[Math.floor(sorted.length * 0.75)]
  return { q1, q3, iqr: q3 - q1 }
}

// ---- Anomaly Detection ----

const METRICS = [
  { key: 'revenue' as const, label: '收入', expectedGrowth: true },
  { key: 'netIncome' as const, label: '净利润', expectedGrowth: true },
  { key: 'grossProfit' as const, label: '毛利润', expectedGrowth: true },
  { key: 'totalLiabilities' as const, label: '负债', expectedGrowth: false },
  { key: 'operatingCashFlow' as const, label: '经营现金流', expectedGrowth: true },
]

function detectAnomalies(data: QData[]): Anomaly[] {
  const anomalies: Anomaly[] = []
  if (data.length < 4) return anomalies

  for (const { key, label, expectedGrowth } of METRICS) {
    const values = data.map(d => d[key])
    const valid = values.filter(v => v > 0)
    if (valid.length < 4) continue

    const m = mean(valid)
    const sd = stdDev(valid, m)
    if (sd === 0) continue

    // Z-score on last 2 quarters
    for (let i = data.length - 1; i >= Math.max(0, data.length - 3); i--) {
      const v = data[i][key]
      if (v <= 0) continue
      const z = Math.abs(v - m) / sd
      if (z > 2.5) {
        anomalies.push({
          metric: label,
          period: data[i].period.slice(0, 7),
          value: v,
          expected: m,
          deviation: Math.round(z * 100) / 100,
          severity: z > 3.5 ? 'critical' : 'warning',
          description: `${label}${v > m ? '异常偏高' : '异常偏低'} (Z=${z.toFixed(1)})`,
        })
      }
    }

    // IQR outlier on most recent
    const { q1, q3, iqr } = IQR(valid)
    const latest = data[data.length - 1][key]
    if (latest > 0 && (latest < q1 - 1.5 * iqr || latest > q3 + 1.5 * iqr)) {
      if (!anomalies.some(a => a.metric === label && a.period === data[data.length - 1].period.slice(0, 7))) {
        anomalies.push({
          metric: label,
          period: data[data.length - 1].period.slice(0, 7),
          value: latest,
          expected: (q1 + q3) / 2,
          deviation: Math.round((Math.abs(latest - (q1 + q3) / 2) / ((q1 + q3) / 2)) * 100) / 100,
          severity: 'warning',
          description: `${label}偏离四分位范围 (IQR法)`,
        })
      }
    }
  }

  // Consecutive decline detection (3+ quarters)
  for (const { key, label } of METRICS.filter(m => m.expectedGrowth)) {
    let declineStreak = 0
    for (let i = data.length - 1; i > 0; i--) {
      if (data[i][key] > 0 && data[i - 1][key] > 0 && data[i][key] < data[i - 1][key]) {
        declineStreak++
      } else {
        break
      }
    }
    if (declineStreak >= 3) {
      anomalies.push({
        metric: label,
        period: `${data[data.length - declineStreak].period.slice(0, 7)} ~ ${data[data.length - 1].period.slice(0, 7)}`,
        value: data[data.length - 1][key],
        expected: data[data.length - declineStreak - 1]?.[key] ?? 0,
        deviation: declineStreak,
        severity: declineStreak >= 4 ? 'critical' : 'warning',
        description: `${label}连续${declineStreak}个季度下降`,
      })
    }
  }

  return anomalies
}

// ---- Risk Assessment ----

function assessRisks(data: QData[], anomalies: Anomaly[]): RiskItem[] {
  const risks: RiskItem[] = []

  // 1. Growth risk: revenue/net income trending down
  const revSlope = linearSlope(data.map(d => d.revenue).filter(v => v > 0))
  const niSlope = linearSlope(data.map(d => d.netIncome).filter(v => v > 0))
  const revLatest = data[data.length - 1]?.revenue ?? 0
  const revSlopePct = revLatest > 0 ? (revSlope / (revLatest / data.length)) * 100 : 0

  let growthScore = 0
  if (revSlope <= 0) growthScore += 10
  if (niSlope <= 0) growthScore += 10
  if (revSlopePct < -10) growthScore += 5
  risks.push({
    category: '增长风险',
    level: growthScore >= 20 ? 'high' : growthScore >= 10 ? 'medium' : 'low',
    score: growthScore,
    detail: `收入趋势${revSlope > 0 ? '上升' : '下降'}(${revSlopePct.toFixed(1)}%/q)，利润趋势${niSlope > 0 ? '上升' : '下降'}`,
  })

  // 2. Leverage risk
  const latestTA = data[data.length - 1]?.totalAssets ?? 0
  const latestTL = data[data.length - 1]?.totalLiabilities ?? 0
  const debtRatio = latestTA > 0 ? (latestTL / latestTA) * 100 : 0
  const debtSlope = linearSlope(data.map(d => d.totalLiabilities).filter(v => v > 0))
  const debtSlopePct = latestTL > 0 ? (debtSlope / (latestTL / data.length)) * 100 : 0

  let leverageScore = 0
  if (debtRatio > 40) leverageScore += 7
  if (debtRatio > 60) leverageScore += 8
  if (debtSlopePct > 5) leverageScore += 10
  risks.push({
    category: '杠杆风险',
    level: leverageScore >= 15 ? 'high' : leverageScore >= 7 ? 'medium' : 'low',
    score: leverageScore,
    detail: `负债率${debtRatio.toFixed(1)}%，${debtSlopePct > 0 ? '负债持续增长' : '负债稳定'}(${debtSlopePct.toFixed(1)}%/q)`,
  })

  // 3. Cash flow quality
  const latestNI = data[data.length - 1]?.netIncome ?? 0
  const latestCF = data[data.length - 1]?.operatingCashFlow ?? 0
  const cfRatio = latestNI > 0 ? latestCF / latestNI : 0
  const cfNegativeCount = data.filter(d => d.operatingCashFlow < 0).length

  let cashScore = 0
  if (cfRatio < 0.5) cashScore += 10
  if (cfRatio < 0) cashScore += 10
  if (cfNegativeCount >= 2) cashScore += 5
  risks.push({
    category: '现金流风险',
    level: cashScore >= 20 ? 'high' : cashScore >= 10 ? 'medium' : 'low',
    score: cashScore,
    detail: `经营现金流/净利润=${cfRatio.toFixed(2)}，${cfNegativeCount}个季度负现金流`,
  })

  // 4. Margin compression
  const gpSlope = linearSlope(data.map(d => d.grossProfit).filter(v => v > 0))
  const latestGP = data[data.length - 1]?.grossProfit ?? 0
  const gpSlopePct = latestGP > 0 ? (gpSlope / (latestGP / data.length)) * 100 : 0

  let marginScore = 0
  if (gpSlopePct < -5) marginScore += 10
  if (gpSlope < 0 && revSlope > 0) marginScore += 15 // revenue up but gross profit down = margin squeeze
  risks.push({
    category: '利润率风险',
    level: marginScore >= 15 ? 'high' : marginScore >= 7 ? 'medium' : 'low',
    score: marginScore,
    detail: `毛利润趋势${gpSlopePct > 0 ? '上升' : '下降'}(${gpSlopePct.toFixed(1)}%/q)${gpSlope < 0 && revSlope > 0 ? '，收入增但毛利降——利润率承压' : ''}`,
  })

  return risks
}

// ---- Summary Generation ----

function generateSummary(data: QData[], anomalies: Anomaly[], risks: RiskItem[]): string {
  const parts: string[] = []

  const n = data.length
  if (n < 2) return '数据不足，无法生成摘要。'

  const latest = data[n - 1]
  const prev = data[n - 2]

  // Revenue trend
  const revChange = prev.revenue > 0 ? ((latest.revenue - prev.revenue) / prev.revenue * 100) : 0
  parts.push(`最近一季度收入${revChange >= 0 ? '增长' : '下降'}${Math.abs(revChange).toFixed(1)}%。`)

  // Net income trend
  if (latest.netIncome > 0 && prev.netIncome > 0) {
    const niChange = ((latest.netIncome - prev.netIncome) / prev.netIncome * 100)
    parts.push(`净利润${niChange >= 0 ? '增长' : '下降'}${Math.abs(niChange).toFixed(1)}%。`)
  }

  // Anomalies found
  const criticalAnomalies = anomalies.filter(a => a.severity === 'critical')
  if (criticalAnomalies.length > 0) {
    parts.push(`检测到${criticalAnomalies.length}项严重异常：${criticalAnomalies.map(a => a.description).join('；')}。`)
  }

  // Risk level
  const highRisks = risks.filter(r => r.level === 'high' || r.level === 'critical')
  if (highRisks.length > 0) {
    parts.push(`主要风险集中在${highRisks.map(r => r.category).join('、')}，需要关注。`)
  }

  // Debt status
  const latestDebt = latest.totalLiabilities / latest.totalAssets * 100
  if (!isNaN(latestDebt)) {
    parts.push(`当前资产负债率${latestDebt.toFixed(1)}%${latestDebt > 50 ? '，杠杆水平偏高' : '，杠杆水平健康'}。`)
  }

  return parts.join('')
}

// ---- Main Export ----

export function analyze(data: {
  periods: string[]; revenue: (number | null)[]; netIncome: (number | null)[];
  grossProfit: (number | null)[]; totalAssets: (number | null)[]; totalLiabilities: (number | null)[];
  operatingCashFlow: (number | null)[];
}): Summary {
  const qData = prepareData(
    data.periods.slice(-12),
    data.revenue.slice(-12), data.netIncome.slice(-12),
    data.grossProfit.slice(-12), data.totalAssets.slice(-12),
    data.totalLiabilities.slice(-12), data.operatingCashFlow.slice(-12)
  )

  const anomalies = detectAnomalies(qData)
  const risks = assessRisks(qData, anomalies)
  const totalRiskScore = risks.reduce((s, r) => s + r.score, 0)
  const summaryText = generateSummary(qData, anomalies, risks)

  return {
    title: '算法分析摘要',
    anomalies,
    risks,
    totalRiskScore,
    summaryText,
    quartersAnalyzed: qData.length,
  }
}
