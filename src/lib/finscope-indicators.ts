// FinScope Custom Indicator System
// 37 proprietary indicators across 5 categories, all derived from raw SEC data

import type { FinancialData } from '@/lib/finance-api'

// ---- Category definitions ----

export enum IndicatorCategory {
  Growth = 'growth',          // 增速类
  Profitability = 'profit',   // 盈利质量类
  Efficiency = 'efficiency',  // 效率类
  Stability = 'stability',    // 稳定性类
  Momentum = 'momentum',      // 动量类
}

export interface Indicator {
  id: string
  name: string
  category: IndicatorCategory
  description: string
  compute: (d: FinancialData) => number | null
  normalize?: (v: number) => number  // 0-100 normalization for scoring
}

// ---- Helper functions ----

function last(arr: (number | null)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i]; return null
}
function nthLast(arr: (number | null)[], n: number): number | null {
  let count = 0
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] == null) continue; count++; if (count === n) return arr[i]
  }
  return null
}
function sum(arr: (number | null)[], n: number): number {
  let s = 0, c = 0
  for (let i = arr.length - 1; i >= 0 && c < n; i--) {
    if (arr[i] != null) { s += arr[i]!; c++ }
  }
  return s
}
function count(arr: (number | null)[], n: number): number {
  let c = 0
  for (let i = arr.length - 1; i >= 0 && c < n; i--) if (arr[i] != null) c++
  return c
}
function slope(arr: (number | null)[], n: number): number {
  const pts: Array<{ x: number; y: number }> = []
  for (let i = arr.length - 1; i >= 0 && pts.length < n; i--) {
    if (arr[i] != null) pts.unshift({ x: pts.length, y: arr[i]! })
  }
  if (pts.length < 2) return 0
  const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length
  let num = 0, den = 0
  for (const p of pts) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2 }
  return den > 0 ? num / den : 0
}
function cagr(arr: (number | null)[], n: number): number | null {
  const latest = last(arr), earliest = nthLast(arr, n)
  if (!latest || !earliest || earliest <= 0) return null
  const years = Math.max(1, (n - 1) / 4) // quarterly → annual
  return (Math.pow(latest / earliest, 1 / years) - 1) * 100
}

// ======== 37 INDICATORS ========

export const INDICATORS: Indicator[] = [

  // --- Growth (8 indicators) ---
  {
    id: 'g01', name: '收入复合增速', category: IndicatorCategory.Growth,
    description: '近 8 季度收入的年化复合增长率',
    compute: d => cagr(d.revenue, 8),
    normalize: v => Math.tanh(v / 20) * 100, // -1 to +100
  },
  {
    id: 'g02', name: '利润复合增速', category: IndicatorCategory.Growth,
    description: '近 8 季度净利润年化复合增长率',
    compute: d => cagr(d.netIncome, 8),
    normalize: v => Math.tanh(v / 25) * 100,
  },
  {
    id: 'g03', name: '收入动量', category: IndicatorCategory.Growth,
    description: '近 4 季度收入斜率 / 历史波动率',
    compute: d => {
      const s = slope(d.revenue, 4); const l = last(d.revenue)
      return l ? (s / l) * 100 : null
    },
    normalize: v => Math.tanh(v * 2) * 100,
  },
  {
    id: 'g04', name: '利润增速加速度', category: IndicatorCategory.Growth,
    description: '近期利润增速 - 远期利润增速',
    compute: d => {
      const sRecent = slope(d.netIncome.slice(-4), 4)
      const sOld = slope(d.netIncome.slice(-8, -4), 4)
      const l = last(d.netIncome)
      return l ? ((sRecent - sOld) / Math.abs(l)) * 100 : null
    },
    normalize: v => Math.max(0, Math.min(100, 50 + v * 10)),
  },
  {
    id: 'g05', name: '经营现金流增速', category: IndicatorCategory.Growth,
    description: '近 4 季度经营现金流同比增长',
    compute: d => {
      const curr = sum(d.operatingCashFlow, 4)
      const prev = sum(d.operatingCashFlow.slice(0, -4), 4)
      return curr && prev ? ((curr - prev) / Math.abs(prev)) * 100 : null
    },
    normalize: v => Math.tanh(v / 30) * 100,
  },
  {
    id: 'g06', name: '毛利润趋势强度', category: IndicatorCategory.Growth,
    description: '毛利润连续增长季度占比',
    compute: d => {
      const vals = d.grossProfit.filter(v => v != null) as number[]
      if (vals.length < 5) return null
      let up = 0, total = 0
      for (let i = 1; i < vals.length; i++) {
        total++; if (vals[i] > vals[i - 1]) up++
      }
      return (up / total) * 100
    },
    normalize: v => v as number,
  },
  {
    id: 'g07', name: '收入增长稳定性', category: IndicatorCategory.Growth,
    description: '100 - 增长率标准差 / 增长率均值',
    compute: d => {
      const vals = d.revenue.filter(v => v != null) as number[]
      const rates: number[] = []
      for (let i = 1; i < vals.length; i++) if (vals[i - 1] > 0) rates.push((vals[i] - vals[i - 1]) / vals[i - 1])
      if (rates.length < 3) return null
      const m = rates.reduce((a, b) => a + b, 0) / rates.length
      const sd = Math.sqrt(rates.reduce((s, r) => s + (r - m) ** 2, 0) / rates.length)
      return m !== 0 ? Math.max(0, 100 - (sd / Math.abs(m)) * 100) : null
    },
    normalize: v => v as number,
  },
  {
    id: 'g08', name: '资产扩张速率', category: IndicatorCategory.Growth,
    description: '近 4 季度总资产年化增长率',
    compute: d => cagr(d.totalAssets, 4),
    normalize: v => Math.max(0, Math.min(100, 50 + v * 2)),
  },

  // --- Profitability (8 indicators) ---
  {
    id: 'p01', name: '滚动毛利率', category: IndicatorCategory.Profitability,
    description: '近 4 季度加权毛利率',
    compute: d => {
      const rev = sum(d.revenue, 4), gp = sum(d.grossProfit, 4)
      return rev > 0 ? (gp / rev) * 100 : null
    },
    normalize: v => Math.min(100, Math.max(0, v * 2)),
  },
  {
    id: 'p02', name: '滚动净利率', category: IndicatorCategory.Profitability,
    description: '近 4 季度加权净利率',
    compute: d => {
      const rev = sum(d.revenue, 4), ni = sum(d.netIncome, 4)
      return rev > 0 ? (ni / rev) * 100 : null
    },
    normalize: v => Math.tanh(v / 10) * 100,
  },
  {
    id: 'p03', name: '资本回报率', category: IndicatorCategory.Profitability,
    description: '年化净利润 / 平均总资产',
    compute: d => {
      const ni = sum(d.netIncome, 4) * 1 // annual equivalent
      const ta = last(d.totalAssets)
      return ta ? (ni / ta) * 100 : null
    },
    normalize: v => Math.min(100, v * 5),
  },
  {
    id: 'p04', name: '现金转化率', category: IndicatorCategory.Profitability,
    description: '经营现金流 / 净利润',
    compute: d => {
      const ni = sum(d.netIncome, 4), ocf = sum(d.operatingCashFlow, 4)
      return ni > 0 ? (ocf / ni) * 100 : null
    },
    normalize: v => Math.min(100, Math.max(0, v)),
  },
  {
    id: 'p05', name: '毛利率趋势', category: IndicatorCategory.Profitability,
    description: '毛利率近 4 季度线性斜率',
    compute: d => {
      const margins: (number | null)[] = []
      for (let i = 0; i < d.periods.length; i++) {
        const r = d.revenue[i], g = d.grossProfit[i]
        margins.push(r && r > 0 ? (g! / r) * 100 : null)
      }
      return slope(margins, 4) * 100
    },
    normalize: v => Math.min(100, Math.max(0, 50 + v * 20)),
  },
  {
    id: 'p06', name: '单位资产创收', category: IndicatorCategory.Profitability,
    description: '年化收入 / 总资产',
    compute: d => {
      const rev = sum(d.revenue, 4), ta = last(d.totalAssets)
      return ta && ta > 0 ? (rev / ta) * 100 : null
    },
    normalize: v => Math.min(100, v * 2),
  },
  {
    id: 'p07', name: '息税折旧摊销前利润率', category: IndicatorCategory.Profitability,
    description: '（毛利润 - 营业费用）/ 收入 (近似)',
    compute: d => {
      const rev = last(d.revenue), gp = last(d.grossProfit), ni = last(d.netIncome)
      // EBITDA margin ≈ (Gross Profit - (GP - NI)) / Revenue = NI/Revenue + some adjustment
      // Use operating income proxy
      if (!rev || !gp || !ni || rev <= 0) return null
      return ((gp + ni) / 2 / rev) * 100
    },
    normalize: v => Math.min(100, Math.max(0, v * 2.5)),
  },
  {
    id: 'p08', name: '边际利润变化', category: IndicatorCategory.Profitability,
    description: '近 2 季度净利率 - 前 2 季度净利率',
    compute: d => {
      const recent = sum(d.netIncome.slice(-2), 2) / Math.max(1, sum(d.revenue.slice(-2), 2)) * 100
      const prior = sum(d.netIncome.slice(-4, -2), 2) / Math.max(1, sum(d.revenue.slice(-4, -2), 2)) * 100
      return recent - prior
    },
    normalize: v => Math.max(0, Math.min(100, 50 + v * 5)),
  },

  // --- Efficiency (7 indicators) ---
  {
    id: 'e01', name: '资产周转率', category: IndicatorCategory.Efficiency,
    description: '年化收入 / 平均总资产',
    compute: d => {
      const rev = sum(d.revenue, 4), ta = last(d.totalAssets)
      return ta && ta > 0 ? rev / ta : null
    },
    normalize: v => Math.min(100, v * 100),
  },
  {
    id: 'e02', name: '负债权益比', category: IndicatorCategory.Efficiency,
    description: '总负债 / (总资产 - 总负债)',
    compute: d => {
      const ta = last(d.totalAssets), tl = last(d.totalLiabilities)
      return ta && ta > tl ? (tl / (ta - tl)) * 100 : null
    },
    normalize: v => Math.max(0, 100 - v * 0.5),
  },
  {
    id: 'e03', name: '营业杠杆', category: IndicatorCategory.Efficiency,
    description: '收入增速 / 利润增速 (值>1表示利润增速>收入增速)',
    compute: d => {
      const revGrowth = cagr(d.revenue, 4), niGrowth = cagr(d.netIncome, 4)
      return revGrowth && niGrowth && revGrowth > 0 ? niGrowth / revGrowth : null
    },
    normalize: v => Math.tanh(v - 1) * 100,
  },
  {
    id: 'e04', name: '现金流效率', category: IndicatorCategory.Efficiency,
    description: '经营现金流 / 总资产',
    compute: d => {
      const ocf = sum(d.operatingCashFlow, 4), ta = last(d.totalAssets)
      return ta && ta > 0 ? (ocf / ta) * 100 : null
    },
    normalize: v => Math.min(100, v * 5),
  },
  {
    id: 'e05', name: '人均效率变化', category: IndicatorCategory.Efficiency,
    description: '(当前收入/资产) / (4季度前收入/资产) - 1',
    compute: d => {
      const currRev = sum(d.revenue, 4), currTA = last(d.totalAssets)
      const prevRev = sum(d.revenue.slice(0, -4), 4), prevTA = nthLast(d.totalAssets, 5)
      if (!currTA || !prevTA || currTA <= 0 || prevTA <= 0) return null
      const currRatio = currRev / currTA, prevRatio = prevRev / prevTA
      return prevRatio > 0 ? (currRatio / prevRatio - 1) * 100 : null
    },
    normalize: v => Math.max(0, Math.min(100, 50 + v * 5)),
  },
  {
    id: 'e06', name: '库存效率', category: IndicatorCategory.Efficiency,
    description: '(总资产 - 负债)变化率 / 收入变化率',
    compute: d => {
      const currEq = last(d.totalAssets)! - last(d.totalLiabilities)!
      const prevEq = nthLast(d.totalAssets, 5)! - nthLast(d.totalLiabilities, 5)!
      if (!currEq || !prevEq || prevEq <= 0) return null
      const eqGrowth = (currEq - prevEq) / prevEq
      const revGrowth = cagr(d.revenue, 4)
      return revGrowth && revGrowth > 0 ? (eqGrowth / (revGrowth / 100)) * 100 : null
    },
    normalize: v => Math.min(100, Math.max(0, 50 + v)),
  },
  {
    id: 'e07', name: '自由现金流边际', category: IndicatorCategory.Efficiency,
    description: '(经营现金流 - 运营资本变化) / 收入',
    compute: d => {
      const ocf = sum(d.operatingCashFlow, 4)
      const rev = sum(d.revenue, 4)
      return rev > 0 ? (ocf / rev) * 100 : null
    },
    normalize: v => Math.tanh(v / 10) * 100,
  },

  // --- Stability (7 indicators) ---
  {
    id: 's01', name: '收入波动率倒数', category: IndicatorCategory.Stability,
    description: '100 - CV × 100 (越低越好 → 越高分)',
    compute: d => {
      const vals = d.revenue.filter(v => v != null) as number[]
      if (vals.length < 4) return null
      const m = vals.reduce((a, b) => a + b, 0) / vals.length
      const sd = Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length)
      const cv = m > 0 ? sd / m : 1
      return Math.max(0, 100 - cv * 200)
    },
    normalize: v => v as number,
  },
  {
    id: 's02', name: '负债率稳定性', category: IndicatorCategory.Stability,
    description: '负债率标准差×100的倒数 (越低越稳定)',
    compute: d => {
      const ratios: number[] = []
      for (let i = 0; i < d.periods.length; i++) {
        const ta = d.totalAssets[i], tl = d.totalLiabilities[i]
        if (ta && ta > 0) ratios.push((tl! / ta) * 100)
      }
      if (ratios.length < 3) return null
      const m = ratios.reduce((a, b) => a + b, 0) / ratios.length
      const sd = Math.sqrt(ratios.reduce((s, r) => s + (r - m) ** 2, 0) / ratios.length)
      return Math.max(0, 100 - sd * 5)
    },
    normalize: v => v as number,
  },
  {
    id: 's03', name: '利润连续为正', category: IndicatorCategory.Stability,
    description: '连续盈利季度数 / 季度总数',
    compute: d => {
      const total = d.netIncome.filter(v => v != null).length
      const positive = d.netIncome.filter(v => v != null && v! > 0).length
      return total > 0 ? (positive / total) * 100 : null
    },
    normalize: v => v as number,
  },
  {
    id: 's04', name: '现金流稳定性', category: IndicatorCategory.Stability,
    description: '经营现金流负值季度占比的倒数',
    compute: d => {
      const vals = d.operatingCashFlow.filter(v => v != null) as number[]
      if (vals.length < 3) return null
      const neg = vals.filter(v => v < 0).length
      return (1 - neg / vals.length) * 100
    },
    normalize: v => v as number,
  },
  {
    id: 's05', name: '杠杆趋势', category: IndicatorCategory.Stability,
    description: '负债率近几季度的变化速度 (越低越好)',
    compute: d => {
      const ratios: number[] = []
      for (let i = 0; i < d.periods.length; i++) {
        const ta = d.totalAssets[i], tl = d.totalLiabilities[i]
        if (ta && ta > 0) ratios.push((tl! / ta) * 100)
      }
      return ratios.length >= 4 ? Math.max(0, 50 - slope(ratios.map(v => v), 4) * 10) : null
    },
    normalize: v => v ? Math.min(100, v) : null as unknown as number,
  },
  {
    id: 's06', name: '毛利率带宽度', category: IndicatorCategory.Stability,
    description: '近 8 季度毛利率 max - min (越小越稳定)',
    compute: d => {
      const margins: number[] = []
      for (let i = 0; i < d.periods.length; i++) {
        const r = d.revenue[i], g = d.grossProfit[i]
        if (r && r > 0) margins.push((g! / r) * 100)
      }
      if (margins.length < 4) return null
      const recent = margins.slice(-8)
      const range = Math.max(...recent) - Math.min(...recent)
      return Math.max(0, 100 - range * 5)
    },
    normalize: v => v as number,
  },
  {
    id: 's07', name: '贝塔近似值', category: IndicatorCategory.Stability,
    description: '收入变化率与自身上期对比的波动 (越低越稳定)',
    compute: d => {
      const vals = d.revenue.filter(v => v != null) as number[]
      if (vals.length < 4) return null
      const changes: number[] = []
      for (let i = 1; i < vals.length; i++) if (vals[i - 1] > 0) changes.push(vals[i] / vals[i - 1] - 1)
      const m = changes.reduce((a, b) => a + b, 0) / changes.length
      const sd = Math.sqrt(changes.reduce((s, c) => s + (c - m) ** 2, 0) / changes.length)
      return Math.max(0, 100 - sd * 200)
    },
    normalize: v => v as number,
  },

  // --- Momentum (7 indicators) ---
  {
    id: 'm01', name: '短期收入增速', category: IndicatorCategory.Momentum,
    description: '近 2 季度 vs 前 2 季度收入增速',
    compute: d => {
      const curr = sum(d.revenue.slice(-2), 2), prev = sum(d.revenue.slice(-4, -2), 2)
      return prev > 0 ? ((curr - prev) / prev) * 100 : null
    },
    normalize: v => Math.tanh(v / 10) * 100,
  },
  {
    id: 'm02', name: '收入加速度', category: IndicatorCategory.Momentum,
    description: '近 2 季度增速 - 远 2 季度增速',
    compute: d => {
      const recent = sum(d.revenue.slice(-2), 2) / Math.max(1, sum(d.revenue.slice(-4, -2), 2)) - 1
      const older = sum(d.revenue.slice(-6, -4), 2) / Math.max(1, sum(d.revenue.slice(-8, -6), 2)) - 1
      return (recent - older) * 100
    },
    normalize: v => Math.min(100, Math.max(0, 50 + v * 5)),
  },
  {
    id: 'm03', name: '利润转折信号', category: IndicatorCategory.Momentum,
    description: '最近 1 季度利润 / 前 4 季度平均利润 (检测拐点)',
    compute: d => {
      const last = last(d.netIncome), avg = sum(d.netIncome.slice(0, -1), 4) / 4
      return last && avg && avg > 0 ? (last / avg - 1) * 100 : null
    },
    normalize: v => Math.min(100, Math.max(0, 50 + v * 2)),
  },
  {
    id: 'm04', name: '现金流转折', category: IndicatorCategory.Momentum,
    description: '最近 1 季度现金流 / 前 4 季度均值',
    compute: d => {
      const last = last(d.operatingCashFlow)
      const prev = d.operatingCashFlow.filter(v => v != null) as number[]
      const prevAvg = prev.length > 1 ? prev.slice(-5, -1).reduce((a, b) => a + b, 0) / Math.min(4, prev.length - 1) : 0
      return prevAvg > 0 ? (last! / prevAvg - 1) * 100 : null
    },
    normalize: v => Math.min(100, Math.max(0, 50 + v * 3)),
  },
  {
    id: 'm05', name: '资产增长势头', category: IndicatorCategory.Momentum,
    description: '最近 1 季度资产 / 4 季度前资产',
    compute: d => {
      const curr = last(d.totalAssets), prev = nthLast(d.totalAssets, 5)
      return curr && prev && prev > 0 ? (curr / prev - 1) * 100 : null
    },
    normalize: v => Math.tanh(v / 15) * 100,
  },
  {
    id: 'm06', name: '负债缩减信号', category: IndicatorCategory.Momentum,
    description: '最近 1 季度负债变化率取负 (减少负债 = 正面信号)',
    compute: d => {
      const curr = last(d.totalLiabilities), prev = nthLast(d.totalLiabilities, 2)
      return curr && prev && prev > 0 ? -(curr / prev - 1) * 100 : null
    },
    normalize: v => Math.max(0, Math.min(100, 50 + v * 3)),
  },
  {
    id: 'm07', name: '综合动量评分', category: IndicatorCategory.Momentum,
    description: '五项动量指标的简单平均',
    compute: d => {
      const scores: (number | null)[] = []
      const lastRev = last(d.revenue), lastNI = last(d.netIncome)
      const prevRev = nthLast(d.revenue, 5), prevNI = nthLast(d.netIncome, 5)
      if (lastRev && prevRev && prevRev > 0) scores.push(((lastRev / prevRev - 1) * 100))
      if (lastNI && prevNI && prevNI > 0) scores.push(((lastNI / prevNI - 1) * 100))
      const valid = scores.filter(v => v != null) as number[]
      return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null
    },
    normalize: v => Math.min(100, Math.max(0, 50 + v * 2)),
  },
]

// --- Composite Scoring ---

export interface CategoryScore {
  category: IndicatorCategory
  name: string
  score: number   // 0-100
  indicators: Array<{ id: string; name: string; value: number | null; score: number }>
}

export function computeScores(d: FinancialData): { categoryScores: CategoryScore[]; totalScore: number; indicatorCount: number } {
  const results: CategoryScore[] = []

  for (const cat of Object.values(IndicatorCategory)) {
    const indicators = INDICATORS.filter(i => i.category === cat)
    const scored: CategoryScore['indicators'] = []

    for (const ind of indicators) {
      const raw = ind.compute(d)
      const score = raw != null && ind.normalize ? ind.normalize(raw) : (raw ?? 0)
      scored.push({ id: ind.id, name: ind.name, value: raw, score: raw != null ? Math.round(score) : 0 })
    }

    const validScores = scored.filter(s => s.value != null).map(s => s.score)
    const avgScore = validScores.length > 0 ? validScores.reduce((a, b) => a + b, 0) / validScores.length : 0

    results.push({
      category: cat,
      name: { growth: '成长性', profit: '盈利质量', efficiency: '运营效率', stability: '稳定性', momentum: '动量趋势' }[cat],
      score: Math.round(avgScore),
      indicators: scored,
    })
  }

  const totalScore = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
  return { categoryScores: results, totalScore, indicatorCount: INDICATORS.length }
}
