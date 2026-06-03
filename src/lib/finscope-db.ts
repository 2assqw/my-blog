// FinScope IndexedDB persistence layer — store analysis results for accumulated comparison

import type { FinancialData } from '@/lib/finance-api'

const DB = 'finscope-db', STORE = 'analyses', V = 1

interface StoredAnalysis {
  cik: string; ticker: string; name: string; date: string
  indicators: Record<string, number | null>
  totalScore: number; categoryScores: Array<{ name: string; score: number }>
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, V)
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'cik' }) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveAnalysis(
  cik: string, ticker: string, name: string,
  d: FinancialData,
  computeIndicators: (d: FinancialData) => { categoryScores: Array<{ name: string; score: number }>; totalScore: number }
): Promise<void> {
  try {
    const { categoryScores, totalScore } = computeIndicators(d)
    const db = await openDB()
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    store.put({
      cik, ticker, name, date: new Date().toISOString().slice(0, 10),
      totalScore, categoryScores,
      indicators: Object.fromEntries(
        ['revenueGrowth', 'netIncomeGrowth', 'grossMargin', 'netMargin', 'debtRatio', 'roa', 'cashFlowRatio']
          .map((k, i) => [k, d.revenue[i] ?? null])
      ),
    })
  } catch { /* IndexedDB not available */ }
}

export async function loadHistory(): Promise<StoredAnalysis[]> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    return new Promise((resolve) => {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result.reverse())
      req.onerror = () => resolve([])
    })
  } catch { return [] }
}

export async function clearHistory(): Promise<void> {
  try {
    const db = await openDB()
    db.transaction(STORE, 'readwrite').objectStore(STORE).clear()
  } catch { }
}
