'use client'

import { useState, useEffect, useRef } from 'react'
import type { DownloadFile } from '@/lib/types'

declare global {
  interface Window {
    turnstile: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      remove: (id: string) => void
      reset: (id: string) => void
    }
  }
}

const WORKER_BASE = 'https://dl.2assqw.cc'
const TURNSTILE_SITE_KEY = '0x4AAAAAAEL3k-Sgu2JRtUt4'

function formatSize(bytes?: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function fingerprint(r2Key: string): string {
  const last = r2Key.split('/').pop() || r2Key
  return encodeURIComponent(last)
}

interface FileDownloadTableProps {
  slug: string
  files: DownloadFile[]
  initialCount: number
}

export function FileDownloadTable({ slug, files, initialCount }: FileDownloadTableProps) {
  const [count, setCount] = useState(initialCount)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [challenge, setChallenge] = useState<DownloadFile | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef('')

  useEffect(() => {
    if (!challenge || !containerRef.current) return

    const file = challenge
    const timer = setTimeout(() => {
      if (window.turnstile && containerRef.current) {
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'light',
          callback: () => {
            const url = `${WORKER_BASE}/dl/${slug}/${fingerprint(file.r2Key)}`
            setDownloading(file.name)
            setCount((c) => c + 1)
            setChallenge(null)
            window.open(url, '_blank')
            setTimeout(() => setDownloading(null), 1000)
          },
        })
      }
    }, 100)

    return () => {
      clearTimeout(timer)
      if (widgetId.current) {
        window.turnstile?.remove(widgetId.current)
        widgetId.current = ''
      }
    }
  }, [challenge, slug])

  if (files.length === 0) {
    return <p className="text-gray-400 text-sm py-8 text-center">暂无文件</p>
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold text-gray-900">文件列表</h2>
        {count > 0 && (
          <span className="text-xs text-gray-400">{count} 次下载</span>
        )}
      </div>

      {challenge && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          onClick={() => setChallenge(null)}
        >
          <div
            className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-1">验证</h3>
            <p className="text-sm text-gray-500 mb-6">
              确认你不是机器人后即可下载「{challenge.name}」
            </p>
            <div ref={containerRef} className="flex justify-center" />
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-100 overflow-hidden">
        {files.map((file, i) => (
          <button
            key={file.r2Key}
            onClick={() => setChallenge(file)}
            className={`w-full text-left flex items-center justify-between px-6 py-4 ${
              i < files.length - 1 ? 'border-b border-gray-50' : ''
            } hover:bg-gray-50 transition-colors group`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <svg className="w-5 h-5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
              </div>
            </div>
            <span
              className={`shrink-0 ml-4 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                downloading === file.name
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-brand-50 text-brand-600 group-hover:bg-brand-100'
              }`}
            >
              {downloading === file.name ? '已下载!' : '下载'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
