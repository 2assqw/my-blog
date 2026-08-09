'use client'

import { useState } from 'react'
import type { DownloadFile } from '@/lib/types'

const WORKER_BASE = 'https://dl.2assqw.cc'

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

  const handleDownload = (file: DownloadFile) => {
    setDownloading(file.name)
    setCount((c) => c + 1)
    setTimeout(() => setDownloading(null), 1000)
  }

  if (files.length === 0) {
    return <p className="text-gray-400 text-sm py-8 text-center">No files uploaded yet.</p>
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Files</h2>
        {count > 0 && (
          <span className="text-xs text-gray-400">{count} downloads</span>
        )}
      </div>
      <div className="rounded-xl border border-gray-100 overflow-hidden">
        {files.map((file, i) => (
          <a
            key={file.r2Key}
            href={`${WORKER_BASE}/dl/${slug}/${fingerprint(file.r2Key)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleDownload(file)}
            className={`
              flex items-center justify-between px-6 py-4
              ${i < files.length - 1 ? 'border-b border-gray-50' : ''}
              hover:bg-gray-50 transition-colors group
            `}
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
            <span className={`
              shrink-0 ml-4 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
              ${downloading === file.name
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-brand-50 text-brand-600 group-hover:bg-brand-100'
              }
            `}>
              {downloading === file.name ? 'Downloaded!' : 'Download'}
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}
