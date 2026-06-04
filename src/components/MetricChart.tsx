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

export function MetricChart({ title, data, metricKey, companies }: Props) {
  const allPeriods = new Set<string>()
  data.forEach((d) => d.periods.forEach((p) => allPeriods.add(p)))
  const periods = Array.from(allPeriods).sort()

  const chartData = periods.map((period) => {
    const row: Record<string, string | number | null> = { period: fmtFiscal(period) }
    data.forEach((d, di) => {
      const idx = d.periods.indexOf(period)
      row[companies[di]] = idx >= 0 ? d[metricKey]?.[idx] ?? null : null
    })
    return row
  })

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
          {companies.map((c, i) => (
            <Line key={c} type="monotone" dataKey={c} stroke={COLORS[i]} strokeWidth={2}
              dot={{ r: 3, fill: COLORS[i] }} connectNulls animationDuration={400} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
