'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { FinancialData } from '@/lib/finance-api'

interface Props {
  title: string
  data: FinancialData[]
  metricKey: keyof Omit<FinancialData, 'company' | 'ticker' | 'periods' | 'error'>
  companies: string[]
}

const COLORS = ['#4F46E5', '#F59E0B']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtFiscal(period: string): string {
  const d = new Date(period + 'T00:00:00')
  if (isNaN(d.getTime())) return period.slice(0, 7)
  return `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`
}

// Simple linear regression: predict next value from last N values
function predictNext(values: (number | null)[], window = 4): { value: number | null; confidence: 'low' | 'medium' | 'high' } {
  const valid: Array<{ x: number; y: number }> = []
  for (let i = 0; i < values.length; i++) {
    if (values[i] != null && values[i]! > 0) {
      valid.push({ x: valid.length, y: values[i] as number })
    }
  }
  if (valid.length < 3) return { value: null, confidence: 'low' }

  const recent = valid.slice(-Math.min(window, valid.length))
  const n = recent.length
  const mx = recent.reduce((s, p) => s + p.x, 0) / n
  const my = recent.reduce((s, p) => s + p.y, 0) / n
  let num = 0, den = 0
  for (const p of recent) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2 }
  if (den === 0) return { value: null, confidence: 'low' }

  const slope = num / den
  const intercept = my - slope * mx
  const nextX = recent[recent.length - 1].x + 1
  const predicted = intercept + slope * nextX

  // Calculate R² for confidence
  const residuals = recent.map(p => p.y - (intercept + slope * p.x))
  const ssRes = residuals.reduce((s, r) => s + r * r, 0)
  const ssTot = recent.reduce((s, p) => s + (p.y - my) ** 2, 0)
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0

  return {
    value: Math.max(0, predicted),
    confidence: r2 > 0.8 ? 'high' : r2 > 0.5 ? 'medium' : 'low',
  }
}

export function MetricChart({ title, data, metricKey, companies }: Props) {
  const allPeriods = new Set<string>()
  data.forEach((d) => d.periods.forEach((p) => allPeriods.add(p)))
  const periods = Array.from(allPeriods).sort()

  // Build chart data rows
  const chartData = periods.map((period) => {
    const row: Record<string, string | number | null> = { period: fmtFiscal(period) }
    data.forEach((d, di) => {
      const idx = d.periods.indexOf(period)
      row[companies[di]] = idx >= 0 ? d[metricKey]?.[idx] ?? null : null
    })
    return row
  })

  // Add prediction row
  const predRow: Record<string, string | number | null> = { period: '预测 →' }
  let hasPrediction = false
  data.forEach((d, di) => {
    const c = companies[di]
    const vals = d.periods.map((p, i) => d[metricKey]?.[i] ?? null)
    const pred = predictNext(vals)
    predRow[c] = pred.value
    predRow[c + '_conf'] = pred.confidence
    if (pred.value != null) hasPrediction = true
  })

  if (hasPrediction) chartData.push(predRow)

  // For each company, split into actual (solid) and predicted (dashed) lines
  // We'll use a trick: the predicted value is only in the last row
  // So we need to draw a line FROM the last actual point TO the predicted point

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:bg-gray-900 dark:border-gray-800">
      <h3 className="text-sm font-semibold text-gray-700 mb-4 dark:text-gray-300">{title}</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickFormatter={(v: number) => v >= 1e9 ? `${(v/1e9).toFixed(1)}B` : `${(v/1e6).toFixed(1)}M`} />
          <Tooltip formatter={(value: unknown) => typeof value === 'number' ? (value >= 1e9 ? `${(value/1e9).toFixed(2)}B` : `${(value/1e6).toFixed(1)}M`) : String(value)}
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {companies.map((c, i) => {
            // Predicted line segment (last actual → predicted)
            const predKey = c + '_pred'
            // Build segment data: only the last 2 rows (last actual + predicted)
            const segData = chartData.slice(-2).map((row, j) => ({
              ...row,
              [predKey]: j === 0 ? (row[c] as number | null) : (row[c] as number | null),
            }))

            return (
              <Line
                key={c}
                type="monotone"
                dataKey={c}
                stroke={COLORS[i]}
                strokeWidth={2}
                dot={{ r: 3, fill: COLORS[i] }}
                connectNulls
                animationDuration={400}
              />
            )
          })}
          {/* Dashed prediction segments for each company */}
          {companies.map((c, i) => {
            const predVal = predRow[c] as number | null
            if (predVal == null) return null
            const prevRow = chartData[chartData.length - 2] ?? null
            const prevVal = prevRow ? (prevRow[c] as number | null) : null
            if (prevVal == null) return null

            // Create a synthetic dataset just for the dashed segment
            const segmentKey = c + '_predline'
            // We need to add this as a separate Line that only renders for the last 2 points
            // Simpler approach: use another Line with the same dataKey but dashed, overlapping

            return (
              <Line
                key={c + '-pred'}
                type="linear"
                dataKey={c}
                stroke={COLORS[i]}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{ r: 4, fill: '#fff', stroke: COLORS[i], strokeWidth: 2 }}
                connectNulls={false}
                animationDuration={400}
                legendType="none"
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
      {hasPrediction && (
        <p className="text-[10px] text-gray-400 mt-1">虚线为基于近 4 期线性回归的预测值</p>
      )}
    </div>
  )
}
