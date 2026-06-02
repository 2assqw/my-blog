'use client'

import { useState } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { FinancialData } from '@/lib/finance-api'

interface Props {
  data: FinancialData[]
  companies: string[]
}

const METRICS: { key: keyof Omit<FinancialData, 'company' | 'ticker' | 'periods' | 'error'>; label: string }[] = [
  { key: 'revenue', label: '收入' },
  { key: 'netIncome', label: '净利润' },
  { key: 'totalAssets', label: '总资产' },
  { key: 'totalLiabilities', label: '总负债' },
  { key: 'operatingCashFlow', label: '经营现金流' },
  { key: 'grossProfit', label: '毛利润' },
]

const COLORS = ['#4F46E5', '#F59E0B']

export function ScatterCompare({ data, companies }: Props) {
  const [xKey, setXKey] = useState<typeof METRICS[0]['key']>('revenue')
  const [yKey, setYKey] = useState<typeof METRICS[0]['key']>('netIncome')

  const scatterData = data.map((d, di) => ({
    name: companies[di],
    data: d.periods
      .map((period, i) => ({
        x: d[xKey]?.[i] ?? 0,
        y: d[yKey]?.[i] ?? 0,
        period,
      }))
      .filter((p) => p.x !== 0 || p.y !== 0),
    fill: COLORS[di],
  }))

  if (data.every((d) => d.periods.length < 2)) {
    return <div className="text-gray-400 text-center py-12">数据不足，无法生成散点图</div>
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-700">散点对比</h3>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          X:
          <select value={xKey} onChange={(e) => setXKey(e.target.value as typeof xKey)}
            className="rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-brand">
            {METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          Y:
          <select value={yKey} onChange={(e) => setYKey(e.target.value as typeof yKey)}
            className="rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-brand">
            {METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={350}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="x" type="number" tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickFormatter={(v: number) => v >= 1e9 ? `${(v/1e9).toFixed(1)}B` : v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : String(v)} />
          <YAxis dataKey="y" type="number" tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickFormatter={(v: number) => v >= 1e9 ? `${(v/1e9).toFixed(1)}B` : v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : String(v)} />
          <ZAxis range={[60, 60]} />
          <Tooltip formatter={(value: unknown) => typeof value === 'number' ? (value >= 1e9 ? `${(value/1e9).toFixed(2)}B` : `${(value/1e6).toFixed(1)}M`) : String(value)}
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {scatterData.map((s) => (
            <Scatter key={s.name} name={s.name} data={s.data} fill={s.fill} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
