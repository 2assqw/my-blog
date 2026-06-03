// FinScope Management Sentiment Analyzer
// Lexicon-based algorithm — no AI, wholly deterministic

// ---- Financial Sentiment Lexicons ----

// Optimistic/expansion language
const OPTIMISTIC = new Set([
  'growth','accelerating','momentum','expanding','strengthening','robust','record',
  'opportunity','upside','outperform','beat','exceed','raise guidance','upgrade',
  'confident','optimistic','positive','favorable','strong','exceptional','impressive',
  'milestone','breakthrough','leadership','dominant','gaining share','winning',
  'innovation','transformative','revolutionary','disruptive','best-in-class',
  '增长','加速','扩张','强劲','历史新高','超出预期','上调指引','乐观','信心',
  '领先','突破','创新','转型','里程碑','机遇','优势','卓越','显著增长',
  'improving','rebound','recovering','turnaround','restructuring complete',
  'productivity gains','efficiency','margin expansion','cash generation',
  'returning capital','buyback','dividend increase','deleveraging','debt reduction',
])

// Cautious/pessimistic language
const CAUTIOUS = new Set([
  'challenging','headwind','uncertainty','volatility','pressure','decline',
  'softening','weakness','slowdown','contraction','deterioration','impairment',
  'restructuring','layoff','workforce reduction','cost cutting','downsizing',
  'impairment charge','write-down','write-off','goodwill impairment',
  'litigation','investigation','regulatory','compliance','sanction','fine',
  'supply chain disruption','shortage','inflation','rising costs','input costs',
  'competitive pressure','pricing pressure','market saturation','demand weakness',
  'churn','attrition','customer loss','contract termination',
  '谨慎','挑战','逆风','不确定性','波动','压力','下滑','疲软','放缓','萎缩',
  '重组','裁员','减值','诉讼','调查','监管','处罚','供应链','短缺','通胀',
  '竞争压力','定价压力','需求疲软','客户流失',
  'macroeconomic','geopolitical','trade tension','tariff','currency headwind',
  'seasonal weakness','cyclical downturn','recession','contraction',
  'liquidity concern','going concern','covenant breach','default risk',
])

// Forward-looking cues (amplifies sentiment — indicates management is projecting ahead)
const FORWARD_LOOKING = new Set([
  'expect','anticipate','project','forecast','guidance','outlook','pipeline',
  'target','goal','plan','strategy','roadmap','vision','long-term','trajectory',
  '预计','预期','展望','指引','目标','规划','战略','路线图','愿景','长期',
  'believe','estimate','intend','seek','aim','commit','pledge',
  'will','shall','going to','positioned to','well-positioned','poised',
  'on track','in line with','consistent with','as planned',
])

// Uncertainty markers (dampens sentiment)
const UNCERTAINTY = new Set([
  'subject to','depending on','if','may','might','could','potentially',
  'remains to be seen','unknown','unclear','unpredictable','volatile',
  'depending','contingent','conditional','preliminary','tentative',
  '可能','或许','取决于','不确定','尚未明朗','难以预测',
  'risk factor','risk factors','exposed to','sensitive to','susceptible',
])

// ---- Scoring Algorithm ----

export interface SentimentScore {
  period: string
  optimistic: number        // 0-100
  cautious: number          // 0-100
  forwardLooking: number    // 0-100
  uncertainty: number       // 0-100
  netSentiment: number      // -100 to 100 (optimistic - cautious)
  conviction: number        // 0-100 (forwardLooking - uncertainty)
  compositeScore: number    // -100 to 100
  wordCount: number
}

function tokenize(text: string): string[] {
  // Split into words, lowercase, handle both English and Chinese
  return text.toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1)
}

function ngramMatch(tokens: string[], phrases: Set<string>): number {
  let count = 0
  // Check 1-3 word phrases
  for (let i = 0; i < tokens.length; i++) {
    // Single word
    if (phrases.has(tokens[i])) count++
    // Two-word phrase
    if (i + 1 < tokens.length) {
      const bigram = tokens[i] + ' ' + tokens[i + 1]
      if (phrases.has(bigram)) count++
    }
    // Three-word phrase
    if (i + 2 < tokens.length) {
      const trigram = tokens[i] + ' ' + tokens[i + 1] + ' ' + tokens[i + 2]
      if (phrases.has(trigram)) count++
    }
  }
  return count
}

export function analyzeSentiment(text: string, period: string): SentimentScore {
  if (!text || text.length < 100) {
    return { period, optimistic: 0, cautious: 0, forwardLooking: 0, uncertainty: 0, netSentiment: 0, conviction: 0, compositeScore: 0, wordCount: 0 }
  }

  const tokens = tokenize(text)
  const wordCount = tokens.length
  if (wordCount === 0) return { period, optimistic: 0, cautious: 0, forwardLooking: 0, uncertainty: 0, netSentiment: 0, conviction: 0, compositeScore: 0, wordCount: 0 }

  const optCount = ngramMatch(tokens, OPTIMISTIC)
  const cauCount = ngramMatch(tokens, CAUTIOUS)
  const fwdCount = ngramMatch(tokens, FORWARD_LOOKING)
  const uncCount = ngramMatch(tokens, UNCERTAINTY)

  // Normalize to per-1000-words for comparability
  const scale = 1000 / wordCount

  const optimistic = Math.min(100, optCount * scale * 10)
  const cautious = Math.min(100, cauCount * scale * 10)
  const forwardLooking = Math.min(100, fwdCount * scale * 5)
  const uncertainty = Math.min(100, uncCount * scale * 5)

  const netSentiment = optimistic - cautious // -100 to 100
  const conviction = forwardLooking - uncertainty // higher = more confident outlook

  // Composite: net sentiment weighted by conviction
  const compositeScore = Math.max(-100, Math.min(100,
    netSentiment * 0.6 + conviction * 0.4
  ))

  return {
    period,
    optimistic: Math.round(optimistic),
    cautious: Math.round(cautious),
    forwardLooking: Math.round(forwardLooking),
    uncertainty: Math.round(uncertainty),
    netSentiment: Math.round(netSentiment),
    conviction: Math.round(conviction),
    compositeScore: Math.round(compositeScore),
    wordCount,
  }
}

// Extract relevant sections from SEC filing text
export function extractMDAText(html: string): string {
  // Remove HTML tags and scripts
  const clean = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()

  // Try to find MD&A section (Item 7 or Item 2 for quarterly)
  const mdaPatterns = [
    /Item\s*7[.:\s]*Management.s Discussion/i,
    /Item\s*2[.:\s]*Management.s Discussion/i,
    /MANAGEMENT.S DISCUSSION AND ANALYSIS/i,
    /Management.s Discussion and Analysis of Financial Condition/i,
  ]

  let startIdx = 0
  for (const pattern of mdaPatterns) {
    const match = clean.match(pattern)
    if (match && match.index !== undefined) {
      startIdx = match.index
      break
    }
  }

  // Extract ~5000 chars from MD&A start, or beginning of document
  return clean.slice(startIdx, startIdx + 8000)
}

export interface SentimentTrend {
  scores: SentimentScore[]
  trend: 'improving' | 'declining' | 'stable' | 'volatile'
  avgComposite: number
  latestComposite: number
  change: number
}

export function analyzeTrend(scores: SentimentScore[]): SentimentTrend {
  if (scores.length === 0) {
    return { scores: [], trend: 'stable', avgComposite: 0, latestComposite: 0, change: 0 }
  }

  const composites = scores.map(s => s.compositeScore)
  const avg = composites.reduce((a, b) => a + b, 0) / composites.length
  const latest = composites[composites.length - 1]
  const change = composites.length >= 2 ? latest - composites[composites.length - 2] : 0

  // Determine trend
  let trend: SentimentTrend['trend'] = 'stable'
  if (composites.length >= 4) {
    const firstHalf = composites.slice(0, Math.floor(composites.length / 2))
    const secondHalf = composites.slice(-Math.floor(composites.length / 2))
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
    const diff = secondAvg - firstAvg

    // Check volatility
    const variance = composites.reduce((s, c) => s + (c - avg) ** 2, 0) / composites.length
    const cv = Math.sqrt(variance) / (Math.abs(avg) + 1)

    if (cv > 0.5) trend = 'volatile'
    else if (diff > 8) trend = 'improving'
    else if (diff < -8) trend = 'declining'
  }

  return {
    scores,
    trend,
    avgComposite: Math.round(avg),
    latestComposite: latest,
    change: Math.round(change),
  }
}
