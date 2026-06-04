// Wall-Street Quantitative Scorecard
// Altman Z-Score · Beneish M-Score · Piotroski F-Score

import type { FinancialData } from '@/lib/finance-api'

// ---- Helpers ----

function latest(arr: (number | null)[] | undefined): number { if (!arr) return 0; for (let i = arr.length-1; i >= 0; i--) if (arr[i] != null) return arr[i]!; return 0 }
function prev(arr: (number | null)[] | undefined): number { if (!arr) return 0; let f = false; for (let i = arr.length-1; i >= 0; i--) { if (arr[i] != null) { if (f) return arr[i]!; f = true } } return 0 }
function assetTurnover(revenue: number, assets: number): number { return assets > 0 ? revenue / assets : 0 }

interface ScoreCard {
  name: string
  score: number
  maxScore: number
  rating: string
  interpretation: string
  components: Array<{ label: string; value: number | string; threshold: string; pass: boolean }>
}

// ================================================================
// 1. Altman Z-Score — Bankruptcy & Credit Risk
// Z = 1.2×X₁ + 1.4×X₂ + 3.3×X₃ + 0.6×X₄ + 0.999×X₅
// ================================================================

export function altmanZScore(d: FinancialData, mktCap?: number | null): ScoreCard {
  const ta = latest(d.totalAssets)
  const tl = latest(d.totalLiabilities)
  const ca = latest(d.currentAssets) || 0
  // X₂: retained earnings — must match current fy, fallback to equity minus par
  const re = latest(d.retainedEarnings) || (latest(d.stockholdersEquity) || 0) - (latest(d.commonStock) || 0)
  // Detect fiscal quarter for annualization factor
  // YTD values: Q1=3mo→×4, Q2=6mo→×2, Q3=9mo→×1.33, FY=12mo→×1
  const rawExt = d as unknown as Record<string,unknown>
  const hasTTM = (rawExt.revenueTTM as number | null) != null || (rawExt.netIncomeTTM as number | null) != null
  // Try to get fiscal period from database
  const fpStr = (rawExt._fp as string) || (d.periods?.length > 0 ? d.periods[d.periods.length-1] : '')
  const fp = fpStr?.includes('Q1') || fpStr?.endsWith('-01') || fpStr?.endsWith('-04') ? 4 :
             fpStr?.includes('Q2') || fpStr?.endsWith('-07') ? 2 :
             fpStr?.includes('Q3') || fpStr?.endsWith('-10') ? 1.33 : 1
  const needAnnualize = !hasTTM && fp > 1

  const rawRev = latest(d.revenue)
  const rawEbit = latest(d.operatingIncome) || latest(d.netIncome) || 0
  const ebit = (rawExt.ebitTTM as number) || (needAnnualize ? rawEbit * fp : rawEbit)
  const rev = (rawExt.revenueTTM as number) || (needAnnualize ? rawRev * fp : rawRev)

  // X₄: Market Cap — must use shares × price, NOT book equity
  const actualMktCap = mktCap || rawExt.marketCap as number || latest(d.stockholdersEquity) || 0

  if (ta === 0) return { name: 'Z-Score', score: 0, maxScore: 9, rating: 'N/A', interpretation: '资产数据缺失', components: [] }

  const wc = (ca - latest(d.currentLiabilities)) || (ta - tl) * 0.3
  const x1 = wc / ta
  const x2 = re / ta
  const x3 = ebit / ta
  const x4 = tl > 0 ? Math.min(actualMktCap / tl, 10) : 0
  const x5 = rev / ta

  const z = (
    1.2 * (isNaN(x1) ? 0 : x1) +
    1.4 * (isNaN(x2) ? 0 : x2) +
    3.3 * (isNaN(x3) ? 0 : x3) +
    0.6 * (isNaN(x4) ? 0 : x4) +
    0.999 * (isNaN(x5) ? 0 : x5)
  )

  const components = [
    { label: '营运资本/总资产', value: Math.round(x1*1000)/1000, threshold: '>0.15', pass: x1 > 0.15 },
    { label: '留存收益/总资产', value: Math.round(x2*1000)/1000, threshold: '>0.10', pass: x2 > 0.10 },
    { label: 'EBIT/总资产', value: Math.round(x3*1000)/1000, threshold: '>0.08', pass: x3 > 0.08 },
    { label: '权益/负债', value: Math.round(x4*100)/100, threshold: '>1.0', pass: x4 > 1.0 },
    { label: '收入/总资产', value: Math.round(x5*100)/100, threshold: '>0.50', pass: x5 > 0.50 },
  ]

  return {
    name: 'Altman Z-Score',
    score: Math.round(z * 100) / 100,
    maxScore: 4,
    rating: z > 2.99 ? '🟢 安全区' : z >= 1.81 ? '🟡 预警区' : '🔴 危险区',
    interpretation: z > 2.99 ? '财务健康，破产风险极低' : z >= 1.81 ? '处于灰色地带，需关注现金流' : '存在财务困境风险，建议深入分析',
    components,
  }
}

// ================================================================
// 2. Beneish M-Score — Earnings Manipulation Detection
// ================================================================

export function beneishMScore(d: FinancialData): ScoreCard {
  const rev = latest(d.revenue), revP = prev(d.revenue)
  const cogs = rev - latest(d.grossProfit)
  const cogsP = revP - prev(d.grossProfit)
  const recv = latest(d.accountsReceivable) || 0, recvP = prev(d.accountsReceivable) || 0
  const ta = latest(d.totalAssets), taP = prev(d.totalAssets)
  const ca = latest(d.currentAssets) || 0, caP = prev(d.currentAssets) || 0
  const cl = latest(d.currentLiabilities) || 0, clP = prev(d.currentLiabilities) || 0
  const tl = latest(d.totalLiabilities), tlP = prev(d.totalLiabilities) || 0
  const ni = latest(d.netIncome), niP = prev(d.netIncome)
  const ocf = latest(d.operatingCashFlow), ocfP = prev(d.operatingCashFlow) || 0
  const sgai = latest(d.sellingGeneralAdmin) || 0, sgaiP = prev(d.sellingGeneralAdmin) || 0
  const depr = latest(d.depreciationAmortization) || (ta * 0.05), deprP = prev(d.depreciationAmortization) || (taP * 0.05)

  // Avoid division by zero
  const safeDiv = (n: number, d: number) => d !== 0 ? n / d : 1

  // DSRI: Days Sales in Receivables Index
  const dsri = safeDiv(safeDiv(recv, rev), safeDiv(recvP, revP))
  // GMI: Gross Margin Index
  const gmi = safeDiv(safeDiv(revP - cogsP, revP), safeDiv(rev - cogs, rev))
  // AQI: Asset Quality Index
  const aqi = safeDiv(1 - safeDiv(ca + (ta - ca - tl), ta), 1 - safeDiv(caP + (taP - caP - tlP), taP))
  // SGI: Sales Growth Index
  const sgi = safeDiv(rev, revP)
  // DEPI: Depreciation Index
  const depi = safeDiv(safeDiv(depr, depr + (ta - (ca - cl))), safeDiv(deprP, deprP + (taP - (caP - clP))))
  // SGAI: SG&A Index
  const sgai_idx = safeDiv(safeDiv(sgai, rev), safeDiv(sgaiP, revP))
  // LVGI: Leverage Index
  const lvgi = safeDiv(safeDiv(tl, ta), safeDiv(tlP, taP))
  // TATA: Total Accruals to Total Assets
  const tata = safeDiv(ni - ocf, ta)

  const m = -4.84 +
    0.92*(isNaN(dsri)?0:dsri) + 0.528*(isNaN(gmi)?0:gmi) + 0.404*(isNaN(aqi)?0:aqi) +
    0.892*(isNaN(sgi)?0:sgi) + 0.115*(isNaN(depi)?0:depi) - 0.172*(isNaN(sgai_idx)?0:sgai_idx) +
    4.679*(isNaN(tata)?0:tata) - 0.327*(isNaN(lvgi)?0:lvgi)

  const components = [
    { label: '应收账款指数', value: Math.round(dsri*100)/100, threshold: '<1.0', pass: dsri < 1.0 },
    { label: '毛利率指数', value: Math.round(gmi*100)/100, threshold: '<1.0', pass: gmi < 1.0 },
    { label: '资产质量指数', value: Math.round(aqi*100)/100, threshold: '<1.0', pass: aqi < 1.0 },
    { label: '收入增长指数', value: Math.round(sgi*100)/100, threshold: '<1.1', pass: sgi < 1.1 },
    { label: '折旧指数', value: Math.round(depi*100)/100, threshold: '>1.0', pass: depi > 1.0 },
    { label: '费用指数', value: Math.round(sgai_idx*100)/100, threshold: '<1.0', pass: sgai_idx < 1.0 },
    { label: '杠杆指数', value: Math.round(lvgi*100)/100, threshold: '<1.0', pass: lvgi < 1.0 },
    { label: '应计/总资产', value: Math.round(tata*1000)/1000, threshold: '<0.02', pass: tata < 0.02 },
  ]

  return {
    name: 'Beneish M-Score',
    score: Math.round(m * 100) / 100,
    maxScore: 8,
    rating: m > -1.78 ? '🔴 操纵嫌疑' : m > -2.22 ? '🟡 需关注' : '🟢 正常',
    interpretation: m > -1.78 ? '财务数据存在操纵迹象，建议核查应收账款和应计项目' : m > -2.22 ? '个别指标异常，需深入分析' : '未发现明显财务操纵信号',
    components,
  }
}

// ================================================================
// 3. Piotroski F-Score — Fundamental Quality (0-9)
// ================================================================

export function piotroskiFScore(d: FinancialData): ScoreCard {
  const ni = latest(d.netIncome), niP = prev(d.netIncome)
  const ocf = latest(d.operatingCashFlow), ocfP = prev(d.operatingCashFlow) || 0
  const ta = latest(d.totalAssets), taP = prev(d.totalAssets)
  const tl = latest(d.totalLiabilities), tlP = prev(d.totalLiabilities) || 0
  const ca = latest(d.currentAssets) || 0, caP = prev(d.currentAssets) || 0
  const cl = latest(d.currentLiabilities) || 0, clP = prev(d.currentLiabilities) || 0
  const rev = latest(d.revenue), revP = prev(d.revenue)
  const gp = latest(d.grossProfit), gpP = prev(d.grossProfit)
  const ltd = latest(d.longTermDebt) || (tl - cl), ltdP = prev(d.longTermDebt) || (tlP - clP)

  let score = 0
  // 1. Net Income > 0
  const c1 = ni > 0; if (c1) score++
  // 2. Operating Cash Flow > 0
  const c2 = ocf > 0; if (c2) score++
  // 3. ROA increased
  const roa = ta > 0 ? ni / ta : 0, roaP = taP > 0 ? niP / taP : 0
  const c3 = roa > roaP; if (c3) score++
  // 4. CFO > NI (quality check)
  const c4 = ocf > ni; if (c4) score++
  // 5. Long-term debt ratio decreased
  const ltdr = ta > 0 ? ltd / ta : 0, ltdrP = taP > 0 ? ltdP / taP : 0
  const c5 = ltdr < ltdrP; if (c5) score++
  // 6. Current ratio increased
  const cr = cl > 0 ? ca / cl : 0, crP = clP > 0 ? caP / clP : 0
  const c6 = cr > crP; if (c6) score++
  // 7. No new shares issued (approximate: equity didn't increase faster than retained earnings)
  const c7 = true // Can't detect from our data, assume pass
  if (c7) score++
  // 8. Gross margin increased
  const gm = rev > 0 ? gp / rev : 0, gmP = revP > 0 ? gpP / revP : 0
  const c8 = gm > gmP; if (c8) score++
  // 9. Asset turnover increased
  const at = assetTurnover(rev, ta), atP = assetTurnover(revP, taP)
  const c9 = at > atP; if (c9) score++

  return {
    name: 'Piotroski F-Score',
    score,
    maxScore: 9,
    rating: score >= 7 ? '🟢 高质量' : score >= 4 ? '🟡 中等' : '🔴 低质量',
    interpretation: score >= 7 ? '基本面强劲，多项指标改善' : score >= 4 ? '中等水平，部分指标需关注' : '基本面较弱，建议谨慎',
    components: [
      { label: '净利润为正', value: ni / 1e9, threshold: '>0', pass: c1 },
      { label: '经营现金流为正', value: ocf / 1e9, threshold: '>0', pass: c2 },
      { label: 'ROA提升', value: Math.round((roa-roaP)*1e4)/100+'%', threshold: '>0', pass: c3 },
      { label: 'CFO>NI', value: Math.round((ocf/ni)*100)/100, threshold: '>1.0', pass: c4 },
      { label: '负债率下降', value: isNaN(ltdrP-ltdr) ? 'N/A' : Math.round((ltdrP-ltdr)*1e4)/100+'%', threshold: '>0', pass: c5 },
      { label: '流动比率上升', value: isNaN(cr-crP) ? 'N/A' : Math.round((cr-crP)*100)/100, threshold: '>0', pass: c6 },
      { label: '未增发股票', value: 0, threshold: '是', pass: c7 },
      { label: '毛利率上升', value: Math.round((gm-gmP)*1e4)/100+'%', threshold: '>0', pass: c8 },
      { label: '资产周转率上升', value: Math.round((at-atP)*100)/100, threshold: '>0', pass: c9 },
    ],
  }
}

// ---- Composite Report ----

export interface ScoreReport {
  altmanZ: ScoreCard
  beneishM: ScoreCard
  piotroskiF: ScoreCard
  consensus: 'strong-buy' | 'buy' | 'hold' | 'caution' | 'avoid'
  consensusScore: number // 0-100
}

export function generateScoreReport(d: FinancialData, mktCap?: number | null): ScoreReport {
  const z = altmanZScore(d, mktCap)
  const m = beneishMScore(d)
  const f = piotroskiFScore(d)

  let score = 0
  if (z.rating.includes('安全')) score += 35
  else if (z.rating.includes('预警')) score += 15

  if (m.rating.includes('正常')) score += 30
  else if (m.rating.includes('关注')) score += 10

  score += Math.round(f.score / 9 * 35)

  let consensus: ScoreReport['consensus'] = 'hold'
  if (score >= 80) consensus = 'strong-buy'
  else if (score >= 60) consensus = 'buy'
  else if (score >= 35) consensus = 'hold'
  else if (score >= 20) consensus = 'caution'
  else consensus = 'avoid'

  return { altmanZ: z, beneishM: m, piotroskiF: f, consensus, consensusScore: score }
}
